-- Exact time ranges for hour-based absence requests.
-- Existing requests remain valid with NULL times and keep their numeric hours.

alter table public.absences
  add column if not exists time_from time without time zone null,
  add column if not exists time_to time without time zone null;

alter table public.absences
  drop constraint if exists absences_time_range_complete;

alter table public.absences
  add constraint absences_time_range_complete
  check (
    (time_from is null and time_to is null)
    or
    (time_from is not null and time_to is not null and time_to > time_from)
  );

comment on column public.absences.time_from is
  'Local start time for hour-based requests such as medical appointments.';

comment on column public.absences.time_to is
  'Local end time for hour-based requests; it must be later than time_from.';
