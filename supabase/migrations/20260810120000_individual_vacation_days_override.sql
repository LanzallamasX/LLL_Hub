-- Optional per-person annual vacation entitlement.
-- NULL keeps the organization seniority policy; a value overrides every annual grant.

alter table public.profiles
  add column if not exists vacation_days_override int null;

alter table public.profiles
  drop constraint if exists profiles_vacation_days_override_range;

alter table public.profiles
  add constraint profiles_vacation_days_override_range
  check (
    vacation_days_override is null
    or vacation_days_override between 1 and 366
  );

comment on column public.profiles.vacation_days_override is
  'Annual vacation days agreed for this employee. NULL uses the general seniority policy.';

-- profiles_update_own allows employees to edit their personal data. Protect
-- this policy field at the database boundary so only an owner can change it.
create or replace function public.protect_vacation_days_override()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vacation_days_override is distinct from old.vacation_days_override
    and auth.uid() is not null
    and not public.is_owner(auth.uid())
  then
    raise exception 'Only an owner can change the vacation days override'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_vacation_days_override() from public;

drop trigger if exists trg_protect_vacation_days_override on public.profiles;
create trigger trg_protect_vacation_days_override
before update of vacation_days_override on public.profiles
for each row execute function public.protect_vacation_days_override();

-- Anniversary policy: this function is the single entitlement source used by
-- both the employee and owner balance RPCs.
create or replace function public.vacation_entitlement_days_at_date(
  p_user_id uuid,
  p_at date
)
returns int
language plpgsql
stable
as $$
declare
  v_start date;
  v_override int;
  v_years int;
  v_schema jsonb;
  v_days int := 14;
begin
  select start_date, vacation_days_override
    into v_start, v_override
  from public.profiles
  where id = p_user_id;

  if v_override is not null then
    return v_override;
  end if;

  if v_start is null then
    return null;
  end if;

  v_years := date_part('year', age(p_at, v_start))::int;
  if v_years < 0 then v_years := 0; end if;

  select entitlement_schema into v_schema
  from public.org_settings
  where id = 1;

  select (e->>'days')::int
    into v_days
  from jsonb_array_elements(v_schema) e
  where (e->>'min_years')::int <= v_years
  order by (e->>'min_years')::int desc
  limit 1;

  return coalesce(v_days, 14);
end;
$$;

-- October policy: keep the existing balance behavior, but resolve every grant
-- through vacation_entitlement_days_at_date so the individual override applies.
create or replace function public.get_vacation_balance_october_preview_for_user_at(
  p_user_id uuid,
  p_at date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at date := coalesce(p_at, current_date);
  v_profile profiles%rowtype;
  v_cycle_month int := 10;
  v_period_start date;
  v_period_end date;
  v_period_label text;
  v_snapshot vacation_balance_snapshots%rowtype;
  v_base_date date;
  v_base_available numeric := 0;
  v_first_grant_date date;
  v_granted numeric := 0;
  v_current_period_grant numeric := 0;
  v_used numeric := 0;
  v_reserved numeric := 0;
  v_pending numeric := 0;
  v_total numeric := 0;
  v_available numeric := 0;
begin
  select coalesce(cycle_start_month, 10)
    into v_cycle_month
  from vacation_policy_settings
  where id = true;

  select *
    into v_profile
  from profiles
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() <> p_user_id
    and not exists (
      select 1
      from profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
        and p.active = true
    )
  then
    raise exception 'Not authorized';
  end if;

  select period_start, period_end, period_label
    into v_period_start, v_period_end, v_period_label
  from vacation_period_for_date(v_at, v_cycle_month);

  select *
    into v_snapshot
  from vacation_balance_snapshots
  where user_id = p_user_id
    and policy_mode = 'october'
    and snapshot_date <= v_at
  order by snapshot_date desc, created_at desc
  limit 1;

  if found then
    v_base_date := v_snapshot.snapshot_date;
    v_base_available := coalesce(v_snapshot.available_at_snapshot, 0);
  else
    v_base_date := coalesce(v_profile.vacation_migration_date, v_period_start);
    v_base_available := coalesce(v_profile.vacation_available_at_migration, 0);
  end if;

  select period_start
    into v_first_grant_date
  from vacation_period_for_date(v_base_date, v_cycle_month);

  if v_first_grant_date < v_base_date then
    v_first_grant_date := (v_first_grant_date + interval '1 year')::date;
  end if;

  if v_first_grant_date <= v_period_start and v_at >= v_first_grant_date then
    select coalesce(
      sum(
        coalesce(
          vacation_entitlement_days_at_date(p_user_id, grant_date::date),
          vacation_days_by_seniority(
            vacation_seniority_years_at(v_profile.start_date, grant_date::date)
          )
        )
      ),
      0
    )
      into v_granted
    from generate_series(v_first_grant_date, v_period_start, interval '1 year') grant_date
    where grant_date::date <= v_at;
  end if;

  if v_at >= v_period_start then
    v_current_period_grant := coalesce(
      vacation_entitlement_days_at_date(p_user_id, v_period_start),
      vacation_days_by_seniority(
        vacation_seniority_years_at(v_profile.start_date, v_period_start)
      )
    );
  end if;

  with scoped_absences as (
    select
      a.*,
      greatest(a.date_from, v_base_date) as scoped_from,
      least(a.date_to, v_period_end) as scoped_to
    from absences a
    where a.user_id = p_user_id
      and a.type = 'vacaciones'
      and a.status in ('aprobado', 'pendiente')
      and a.date_to >= v_base_date
      and a.date_from <= v_period_end
  ),
  counted as (
    select
      status,
      date_from,
      date_to,
      vacation_chargeable_days(scoped_from, scoped_to) as amount
    from scoped_absences
    where scoped_to >= scoped_from
  )
  select
    coalesce(sum(amount) filter (where status = 'aprobado' and date_to < v_at), 0),
    coalesce(sum(amount) filter (where status = 'aprobado' and date_to >= v_at), 0),
    coalesce(sum(amount) filter (where status = 'pendiente'), 0)
  into v_used, v_reserved, v_pending
  from counted;

  v_total := v_base_available + v_granted;
  v_available := greatest(0, v_total - v_used - v_reserved - v_pending);

  return jsonb_build_object(
    'policy_mode', 'october',
    'period_start', v_period_start,
    'period_end', v_period_end,
    'period_label', v_period_label,
    'base_date', v_base_date,
    'base_available', floor(v_base_available),
    'granted', floor(v_total),
    'granted_current_period', floor(v_current_period_grant),
    'used', floor(v_used),
    'reserved', floor(v_reserved),
    'reserved_pending', floor(v_pending),
    'available', floor(v_available),
    'next_expiration', null,
    'buckets', jsonb_build_array()
  );
end;
$$;

grant execute on function public.get_vacation_balance_october_preview_for_user_at(uuid, date)
  to authenticated;
