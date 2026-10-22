alter table public.absences add column if not exists prescription_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-prescriptions', 'medical-prescriptions', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "employees upload prescriptions" on storage.objects
for insert to authenticated with check (
  bucket_id = 'medical-prescriptions' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "employees and owners read prescriptions" on storage.objects
for select to authenticated using (
  bucket_id = 'medical-prescriptions' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_owner()
  )
);

create or replace function public.validate_prolonged_health()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'licencia' and new.subtype = 'TRATAMIENTO_SALUD_PROLONGADO' then
    -- Serialize requests for the same employee so concurrent submissions cannot
    -- bypass the daily limit.
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if new.date_from <> new.date_to or new.hours is distinct from 2
      or new.time_from is null or new.time_to is null
      or new.time_to - new.time_from <> interval '2 hours' then
      raise exception 'Esta licencia debe solicitarse por exactamente 2 horas en un único día.';
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
create trigger validate_prolonged_health before insert or update on public.absences
for each row execute function public.validate_prolonged_health();
