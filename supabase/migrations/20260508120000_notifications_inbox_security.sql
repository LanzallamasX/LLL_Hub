-- Harden notification inbox visibility.
-- A normal Postgres view can bypass table RLS depending on ownership/security mode,
-- so the view itself must filter by auth.uid().

create or replace view public.my_inbox
with (security_invoker = true)
as
select
  r.user_id,
  r.notification_id,
  r.read_at,
  n.type,
  n.title,
  n.body,
  n.actor_id,
  n.entity_type,
  n.entity_id,
  n.created_at
from public.notification_recipients r
join public.notifications n on n.id = r.notification_id
where r.user_id = auth.uid();

grant select on public.my_inbox to authenticated;
