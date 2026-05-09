-- Additive vacation policy preview objects.
-- This does not replace or modify the existing vacation RPCs.
-- Existing app behavior remains unchanged until the frontend calls these new RPCs.

create table if not exists public.vacation_policy_settings (
  id boolean primary key default true,
  policy_mode text not null default 'anniversary',
  cycle_start_month int not null default 10,
  effective_from date null,
  preview_enabled boolean not null default true,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  constraint vacation_policy_settings_singleton check (id = true),
  constraint vacation_policy_settings_mode check (policy_mode in ('anniversary', 'october')),
  constraint vacation_policy_settings_cycle_month check (cycle_start_month between 1 and 12)
);

insert into public.vacation_policy_settings (id, policy_mode, cycle_start_month, preview_enabled)
values (true, 'anniversary', 10, true)
on conflict (id) do nothing;

alter table public.vacation_policy_settings enable row level security;

drop policy if exists "authenticated can read vacation policy settings"
  on public.vacation_policy_settings;

create policy "authenticated can read vacation policy settings"
  on public.vacation_policy_settings
  for select
  to authenticated
  using (true);

create table if not exists public.vacation_policy_changes (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid null,
  old_mode text null,
  new_mode text not null,
  old_effective_from date null,
  new_effective_from date null,
  old_cycle_start_month int null,
  new_cycle_start_month int not null default 10,
  note text null,
  created_at timestamptz not null default now(),
  constraint vacation_policy_changes_new_mode check (new_mode in ('anniversary', 'october')),
  constraint vacation_policy_changes_old_mode check (old_mode is null or old_mode in ('anniversary', 'october')),
  constraint vacation_policy_changes_cycle_month check (new_cycle_start_month between 1 and 12)
);

alter table public.vacation_policy_changes enable row level security;

create table if not exists public.vacation_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_mode text not null default 'october',
  period_start date not null,
  period_end date not null,
  snapshot_date date not null,
  available_at_snapshot numeric not null default 0,
  note text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  constraint vacation_balance_snapshots_mode check (policy_mode in ('anniversary', 'october')),
  constraint vacation_balance_snapshots_available_nonnegative check (available_at_snapshot >= 0),
  constraint vacation_balance_snapshots_period_order check (period_end >= period_start)
);

alter table public.vacation_balance_snapshots enable row level security;

create index if not exists vacation_balance_snapshots_user_mode_date_idx
  on public.vacation_balance_snapshots (user_id, policy_mode, snapshot_date desc);

create or replace function public.vacation_period_for_date(
  p_at date,
  p_cycle_start_month int default 10
)
returns table (
  period_start date,
  period_end date,
  period_label text
)
language sql
stable
as $$
  with x as (
    select
      coalesce(p_at, current_date) as at_date,
      greatest(1, least(12, coalesce(p_cycle_start_month, 10))) as start_month
  ),
  y as (
    select
      case
        when extract(month from at_date)::int >= start_month
          then make_date(extract(year from at_date)::int, start_month, 1)
        else make_date(extract(year from at_date)::int - 1, start_month, 1)
      end as start_date
    from x
  )
  select
    start_date as period_start,
    (start_date + interval '1 year' - interval '1 day')::date as period_end,
    extract(year from start_date)::int || '/' || extract(year from start_date + interval '1 year')::int as period_label
  from y;
$$;

create or replace function public.vacation_seniority_years_at(
  p_start_date date,
  p_at date
)
returns int
language sql
stable
as $$
  select case
    when p_start_date is null or p_at is null then 0
    else greatest(
      0,
      extract(year from age(p_at::timestamp, p_start_date::timestamp))::int
    )
  end;
$$;

create or replace function public.vacation_days_by_seniority(
  p_years int
)
returns int
language sql
stable
as $$
  select case
    when coalesce(p_years, 0) >= 20 then 35
    when coalesce(p_years, 0) >= 10 then 28
    when coalesce(p_years, 0) >= 5 then 21
    else 14
  end;
$$;

create or replace function public.vacation_chargeable_days(
  p_from date,
  p_to date
)
returns int
language sql
stable
as $$
  select coalesce(count(*), 0)::int
  from generate_series(p_from, p_to, interval '1 day') d(day)
  where extract(isodow from d.day)::int between 1 and 5;
$$;

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

  -- October model: one global grant at every cycle start since the base date.
  -- Snapshot convention: available_at_snapshot is the balance before grants on/after snapshot_date.
  if v_first_grant_date <= v_period_start and v_at >= v_first_grant_date then
    select coalesce(
      sum(
        vacation_days_by_seniority(
          vacation_seniority_years_at(v_profile.start_date, grant_date::date)
        )
      ),
      0
    )
      into v_granted
    from generate_series(v_first_grant_date, v_period_start, interval '1 year') grant_date
    where grant_date::date <= v_at;
  end if;

  if v_at >= v_period_start then
    v_current_period_grant := vacation_days_by_seniority(
      vacation_seniority_years_at(v_profile.start_date, v_period_start)
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

grant execute on function public.vacation_period_for_date(date, int) to authenticated;
grant execute on function public.get_vacation_balance_october_preview_for_user_at(uuid, date) to authenticated;
