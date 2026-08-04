-- Email the other side of an absence conversation after a message is stored.
-- Users notify the selected owners (or every active owner as a fallback), while
-- an owner reply notifies the user who created the absence.

create or replace function public.notify_absence_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_absence_user_id uuid;
  v_notify_owner_ids uuid[];
  v_author_name text;
  v_author_name_html text;
  v_author_role text;
  v_selected_owner_count int := 0;
  v_message_url text;
begin
  select a.user_id, a.notify_owner_ids
    into v_absence_user_id, v_notify_owner_ids
  from public.absences a
  where a.id = new.absence_id;

  select
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.email), ''),
      case when p.role = 'owner' then 'Owner' else 'Usuario' end
    ),
    p.role
    into v_author_name, v_author_role
  from public.profiles p
  where p.id = new.author_id;

  if v_absence_user_id is null or v_author_role not in ('owner', 'user') then
    return new;
  end if;

  -- Prevent profile data from being interpreted as markup in the email.
  v_author_name_html := replace(
    replace(
      replace(coalesce(v_author_name, 'Usuario'), '&', '&amp;'),
      '<', '&lt;'
    ),
    '>', '&gt;'
  );

  if v_author_role = 'user' then
    select count(*)
      into v_selected_owner_count
    from public.profiles p
    where p.role = 'owner'
      and p.active = true
      and p.id = any(coalesce(v_notify_owner_ids, array[]::uuid[]));

    v_message_url :=
      'https://lll-hub.vercel.app/owner/dashboard?focus=' || new.absence_id::text;
  else
    v_message_url :=
      'https://lll-hub.vercel.app/dashboard?focus=' || new.absence_id::text;
  end if;

  insert into public.email_outbox (user_id, to_email, subject, html)
  select
    recipient.id,
    recipient.email,
    'LLL Hub - Tenés un mensaje nuevo de ' ||
      left(regexp_replace(v_author_name, E'[\\r\\n]+', ' ', 'g'), 100),
    (
      '<html><body style="background:#f3f4f6;padding:30px 10px;font-family:Arial,sans-serif;margin:0">' ||
      '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' ||
      '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">' ||
      '<tr><td style="background:#111827;padding:0;text-align:center">' ||
      '<img src="https://lanzallamas.tv/lll-hub/mails/images/gif.gif" alt="LLL Hub" style="display:block;margin:auto;max-width:100%" />' ||
      '</td></tr>' ||
      '<tr><td style="padding:24px">' ||
      '<h2 style="margin:0 0 12px;color:#111827">Tenés un mensaje nuevo de ' ||
        v_author_name_html || '</h2>' ||
      '<p style="margin:0 0 16px;color:#374151">' ||
        v_author_name_html || ' te dejó un mensaje en la conversación de una ausencia.</p>' ||
      '<table cellpadding="0" cellspacing="0"><tr><td style="background:#111827;border-radius:6px">' ||
      '<a href="' || v_message_url || '" style="display:inline-block;padding:10px 16px;color:#ffffff;text-decoration:none">Ver mensaje</a>' ||
      '</td></tr></table>' ||
      '</td></tr></table>' ||
      '</td></tr></table>' ||
      '</body></html>'
    )
  from public.profiles recipient
  where recipient.active = true
    and coalesce(recipient.email, '') <> ''
    and recipient.id <> new.author_id
    and (
      (
        v_author_role = 'owner'
        and recipient.id = v_absence_user_id
      )
      or
      (
        v_author_role = 'user'
        and recipient.role = 'owner'
        and (
          v_selected_owner_count = 0
          or recipient.id = any(coalesce(v_notify_owner_ids, array[]::uuid[]))
        )
      )
    );

  return new;
end;
$$;

revoke all on function public.notify_absence_message_created() from public;

drop trigger if exists trg_notify_absence_message_created on public.absence_messages;
create trigger trg_notify_absence_message_created
after insert on public.absence_messages
for each row execute function public.notify_absence_message_created();
