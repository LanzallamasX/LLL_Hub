-- Allow partial hours while keeping the two-hour daily maximum.
create or replace function public.validate_prolonged_health()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'licencia' and new.subtype = 'TRATAMIENTO_SALUD_PROLONGADO' then
    -- Serialize requests for the same employee so concurrent submissions cannot
    -- bypass the daily limit.
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if new.date_from <> new.date_to
      or new.hours is null or new.hours <= 0 or new.hours > 2
      or new.time_from is null or new.time_to is null
      or new.time_to <= new.time_from
      or new.time_to - new.time_from > interval '2 hours'
      or abs(new.hours - extract(epoch from (new.time_to - new.time_from)) / 3600) > 0.000001 then
      raise exception 'Solicitá un horario de duración mayor a cero y de hasta 2 horas en un único día.';
    end if;
    if new.prescription_path is null or not exists (
      select 1 from storage.objects where bucket_id = 'medical-prescriptions'
      and name = new.prescription_path
      and (storage.foldername(name))[1] = new.user_id::text
    ) then
      raise exception 'Adjuntá una foto de la prescripción médica con firma y sello.';
    end if;
    if new.status <> 'rechazado' and exists (
      select 1 from public.absences a where a.user_id = new.user_id
      and a.id <> new.id and a.type = 'licencia'
      and a.subtype = 'TRATAMIENTO_SALUD_PROLONGADO'
      and a.status <> 'rechazado' and a.date_from = new.date_from
    ) then
      raise exception 'Ya tenés una solicitud de tratamiento de salud prolongado para ese día.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_prolonged_health() from public;
