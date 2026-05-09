-- Allow each absence request to target selected owner recipients.
-- If notify_owner_ids is empty/null, the existing fallback remains: all active owners.

alter table public.absences
  add column if not exists notify_owner_ids uuid[] null;

create or replace function public.list_active_owner_notification_recipients()
returns table (
  id uuid,
  email text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email::text, p.full_name::text
  from public.profiles p
  where p.role = 'owner'
    and p.active = true
  order by p.full_name asc nulls last, p.email asc nulls last;
$$;

revoke all on function public.list_active_owner_notification_recipients() from public;
grant execute on function public.list_active_owner_notification_recipients() to authenticated;

create or replace function public.notify_absence_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_id uuid;
  v_user_name text;
  v_type text;
  v_from text;
  v_to text;
  v_selected_owner_count int := 0;
begin
  v_user_name := new.user_name;
  v_type := new.type;
  v_from := new.date_from::text;
  v_to := new.date_to::text;

  select count(*)
    into v_selected_owner_count
  from public.profiles p
  where p.role = 'owner'
    and p.active = true
    and p.id = any(coalesce(new.notify_owner_ids, array[]::uuid[]));

  insert into public.notifications(type, title, body, entity_type, entity_id)
  values (
    'absence_created',
    'Nueva solicitud',
    v_user_name || ' solicito ' || v_type || ' (' || v_from || ' - ' || v_to || ')',
    'absence',
    new.id
  )
  returning id into n_id;

  insert into public.notification_recipients(notification_id, user_id)
  select n_id, p.id
  from public.profiles p
  where p.role = 'owner'
    and p.active = true
    and (
      v_selected_owner_count = 0
      or p.id = any(coalesce(new.notify_owner_ids, array[]::uuid[]))
    );

  insert into public.email_outbox (user_id, notification_id, to_email, subject, html)
  select
    p.id,
    n_id,
    p.email,
    'LLL Hub - Nueva solicitud de ausencia',
    (
      '<html><body style="background:#f3f4f6;padding:30px 10px;font-family:Arial,sans-serif;margin:0">' ||
      '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' ||
      '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">' ||
      '<tr><td style="background:#111827;padding:0px;text-align:center">' ||
      '<img src="https://lanzallamas.tv/lll-hub/mails/images/gif.gif" style="display:block;margin:auto" />' ||
      '</td></tr>' ||
      '<tr><td style="padding:24px">' ||
      '<h2 style="margin:0 0 12px;color:#111827">Nueva solicitud</h2>' ||
      '<p style="margin:0 0 10px;color:#374151"><b>' || v_user_name || '</b> solicito <b>' || v_type || '</b></p>' ||
      '<p style="margin:0 0 16px;color:#6b7280">Fecha: ' || v_from || ' - ' || v_to || '</p>' ||
      '<table cellpadding="0" cellspacing="0"><tr><td style="background:#111827;border-radius:6px">' ||
      '<a href="https://lll-hub.vercel.app/owner/dashboard" style="display:inline-block;padding:10px 16px;color:#ffffff;text-decoration:none">Ver solicitud</a>' ||
      '</td></tr></table>' ||
      '</td></tr></table>' ||
      '</td></tr></table>' ||
      '</body></html>'
    )
  from public.profiles p
  where p.role = 'owner'
    and p.active = true
    and coalesce(p.email,'') <> ''
    and (
      v_selected_owner_count = 0
      or p.id = any(coalesce(new.notify_owner_ids, array[]::uuid[]))
    )
    and not exists (
      select 1
      from public.email_outbox eo
      where eo.notification_id = n_id
        and eo.user_id = p.id
    );

  return new;
end;
$$;

drop trigger if exists trg_notify_absence_created on public.absences;
create trigger trg_notify_absence_created
after insert on public.absences
for each row execute function public.notify_absence_created();
