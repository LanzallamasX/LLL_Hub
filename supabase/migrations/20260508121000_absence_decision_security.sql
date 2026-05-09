-- Keep decision audit correct when status changes are performed by the secure API
-- with a service-role database client after verifying the owner session.

create or replace function public.set_absence_decision_audit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pendiente' and new.status in ('aprobado','rechazado') then
    new.decided_by = coalesce(auth.uid(), new.decided_by);
    new.decided_at = coalesce(new.decided_at, now());
  end if;

  if new.status = 'pendiente' then
    new.decided_by = null;
    new.decided_at = null;
  end if;

  return new;
end;
$$;

-- This legacy RPC is no longer used by the app route. Keeping anon off avoids
-- direct public status changes if an older grant exists in the database.
revoke execute on function public.set_absence_status(uuid, text) from anon;
