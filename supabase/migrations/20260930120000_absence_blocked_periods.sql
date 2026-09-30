-- Owner-managed periods in which vacation and/or home-office requests are disabled.

create table if not exists public.absence_blocked_periods (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  absence_types text[] not null,
  reason text not null,
  active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absence_blocked_periods_date_order check (date_to >= date_from),
  constraint absence_blocked_periods_types_not_empty check (cardinality(absence_types) > 0),
  constraint absence_blocked_periods_types_allowed check (
    absence_types <@ array['vacaciones', 'home_office']::text[]
  ),
  constraint absence_blocked_periods_reason_not_empty check (length(btrim(reason)) > 0)
);

create index if not exists absence_blocked_periods_active_dates_idx
  on public.absence_blocked_periods (active, date_from, date_to);

alter table public.absence_blocked_periods enable row level security;
grant select on table public.absence_blocked_periods to authenticated;

drop policy if exists "authenticated can read active blocked periods"
  on public.absence_blocked_periods;
create policy "authenticated can read active blocked periods"
  on public.absence_blocked_periods
  for select
  to authenticated
  using (active or public.is_owner());

-- Writes intentionally go through the owner-only server route (service role).

create or replace function public.set_absence_blocked_period_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_absence_blocked_period_updated_at() from public;

drop trigger if exists trg_absence_blocked_period_updated_at
  on public.absence_blocked_periods;
create trigger trg_absence_blocked_period_updated_at
before update on public.absence_blocked_periods
for each row execute function public.set_absence_blocked_period_updated_at();

create or replace function public.enforce_absence_blocked_periods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block public.absence_blocked_periods%rowtype;
begin
  if new.type not in ('vacaciones', 'home_office') then
    return new;
  end if;

  select period.*
    into v_block
  from public.absence_blocked_periods period
  where period.active = true
    and new.type = any(period.absence_types)
    and daterange(period.date_from, period.date_to, '[]')
      && daterange(new.date_from, new.date_to, '[]')
  order by period.date_from
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = format(
        'ABSENCE_BLOCKED_PERIOD|%s|%s|%s',
        v_block.date_from,
        v_block.date_to,
        v_block.reason
      );
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_absence_blocked_periods() from public;

drop trigger if exists trg_enforce_absence_blocked_periods on public.absences;
create trigger trg_enforce_absence_blocked_periods
before insert or update of date_from, date_to, type on public.absences
for each row execute function public.enforce_absence_blocked_periods();

-- Initial request: no vacation or home-office requests from November 1–15, 2026.
insert into public.absence_blocked_periods (
  date_from,
  date_to,
  absence_types,
  reason,
  active
)
select
  date '2026-11-01',
  date '2026-11-15',
  array['vacaciones', 'home_office']::text[],
  'Período operativo bloqueado',
  true
where not exists (
  select 1
  from public.absence_blocked_periods
  where date_from = date '2026-11-01'
    and date_to = date '2026-11-15'
    and absence_types @> array['vacaciones', 'home_office']::text[]
);
