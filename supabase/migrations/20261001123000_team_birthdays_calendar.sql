-- Privacy-safe birthday feed for authenticated calendars.
-- Exposes only the employee id, display name, month and day (never birth year).

create or replace function public.list_team_birthdays()
returns table (
  id uuid,
  display_name text,
  birth_month integer,
  birth_day integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.id,
    coalesce(
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      'Integrante del equipo'
    ) as display_name,
    extract(month from profile.birth_date)::integer as birth_month,
    extract(day from profile.birth_date)::integer as birth_day
  from public.profiles profile
  where auth.uid() is not null
    and profile.active = true
    and profile.birth_date is not null
  order by birth_month, birth_day, display_name;
$$;

revoke all on function public.list_team_birthdays() from public;
grant execute on function public.list_team_birthdays() to authenticated;
