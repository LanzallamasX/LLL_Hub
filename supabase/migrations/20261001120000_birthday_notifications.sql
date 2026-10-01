-- Daily birthday notifications and email reminders.
-- Delivery is idempotent per employee and calendar date.

-- Keep queue mutation behind the service-role worker and recover claims left
-- in "sending" if a previous function invocation stopped unexpectedly.
create or replace function public.claim_pending_emails(p_limit int default 25)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select email.id
    from public.email_outbox email
    where (
        email.status = 'pending'
        or (
          email.status = 'sending'
          and email.updated_at < now() - interval '15 minutes'
        )
      )
      and coalesce(email.to_email, '') <> ''
    order by email.created_at asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  )
  update public.email_outbox email
  set status = 'sending', updated_at = now()
  from claimed
  where email.id = claimed.id
  returning email.*;
end;
$$;

revoke all on function public.claim_pending_emails(int) from public;
revoke execute on function public.claim_pending_emails(int) from anon, authenticated;
grant execute on function public.claim_pending_emails(int) to service_role;

revoke execute on function public.mark_email_sent(uuid, text) from anon, authenticated;
revoke execute on function public.mark_email_error(uuid, text, int) from anon, authenticated;
grant execute on function public.mark_email_sent(uuid, text) to service_role;
grant execute on function public.mark_email_error(uuid, text, int) to service_role;

create table if not exists public.birthday_notification_runs (
  id uuid primary key default gen_random_uuid(),
  birthday_user_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null,
  reminder_notification_id uuid null references public.notifications(id) on delete set null,
  greeting_notification_id uuid null references public.notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint birthday_notification_runs_unique unique (birthday_user_id, event_date)
);

create index if not exists birthday_notification_runs_event_date_idx
  on public.birthday_notification_runs (event_date desc);

alter table public.birthday_notification_runs enable row level security;
grant select on table public.birthday_notification_runs to authenticated;

drop policy if exists "owners can read birthday notification runs"
  on public.birthday_notification_runs;
create policy "owners can read birthday notification runs"
  on public.birthday_notification_runs
  for select
  to authenticated
  using (public.is_owner());

create or replace function public.enqueue_daily_birthday_notifications(
  p_event_date date
)
returns table (
  employee_id uuid,
  employee_name text,
  email_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birthday record;
  v_run_id uuid;
  v_reminder_notification_id uuid;
  v_greeting_notification_id uuid;
  v_name text;
  v_first_name text;
  v_name_html text;
  v_first_name_html text;
  v_general_email_count integer;
  v_greeting_email_count integer;
begin
  if p_event_date is null then
    raise exception 'event date is required';
  end if;

  for v_birthday in
    select
      p.id,
      p.email,
      p.full_name,
      p.first_name,
      p.last_name
    from public.profiles p
    where p.active = true
      and p.birth_date is not null
      and extract(month from p.birth_date) = extract(month from p_event_date)
      and extract(day from p.birth_date) = extract(day from p_event_date)
    order by coalesce(p.full_name, p.first_name, p.email)
  loop
    v_run_id := null;
    v_reminder_notification_id := null;
    v_greeting_notification_id := null;
    v_general_email_count := 0;
    v_greeting_email_count := 0;

    insert into public.birthday_notification_runs (birthday_user_id, event_date)
    values (v_birthday.id, p_event_date)
    on conflict (birthday_user_id, event_date) do nothing
    returning id into v_run_id;

    -- Already created for this employee and date: do not enqueue duplicates.
    if v_run_id is null then
      continue;
    end if;

    v_name := coalesce(
      nullif(btrim(v_birthday.full_name), ''),
      nullif(btrim(concat_ws(' ', v_birthday.first_name, v_birthday.last_name)), ''),
      nullif(btrim(v_birthday.email), ''),
      'un integrante del equipo'
    );
    v_first_name := coalesce(
      nullif(btrim(v_birthday.first_name), ''),
      split_part(v_name, ' ', 1),
      'te'
    );
    v_name_html := replace(replace(replace(v_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
    v_first_name_html := replace(replace(replace(v_first_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

    insert into public.notifications (type, title, body, entity_type, entity_id)
    values (
      'birthday_reminder',
      'Hoy es el cumpleaños de ' || v_name || ' 🎂',
      '¡Acordate de saludar a ' || v_name || ' en su día!',
      'birthday',
      v_birthday.id
    )
    returning id into v_reminder_notification_id;

    insert into public.notification_recipients (notification_id, user_id)
    select v_reminder_notification_id, recipient.id
    from public.profiles recipient
    where recipient.active = true
      and recipient.id <> v_birthday.id;

    insert into public.email_outbox (
      user_id,
      notification_id,
      to_email,
      subject,
      html
    )
    select
      recipient.id,
      v_reminder_notification_id,
      recipient.email,
      'Hoy es el cumpleaños de ' || v_name || ' 🎂',
      '<html><body style="background:#f3f4f6;padding:30px 10px;font-family:Arial,sans-serif;margin:0">' ||
      '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' ||
      '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden">' ||
      '<tr><td style="background:#111827;padding:28px;text-align:center;color:#ffffff">' ||
      '<div style="font-size:42px;line-height:1">🎂</div>' ||
      '<h1 style="margin:12px 0 0;font-size:24px">Hoy cumple años ' || v_name_html || '</h1>' ||
      '</td></tr><tr><td style="padding:28px;color:#374151">' ||
      '<p style="margin:0;font-size:16px;line-height:1.6">¡Acordate de saludar a <b>' || v_name_html || '</b> en su día!</p>' ||
      '<p style="margin:18px 0 0;color:#6b7280;font-size:13px">Este recordatorio fue enviado por LLL Hub.</p>' ||
      '</td></tr></table></td></tr></table></body></html>'
    from public.profiles recipient
    where recipient.active = true
      and recipient.id <> v_birthday.id
      and coalesce(btrim(recipient.email), '') <> '';

    get diagnostics v_general_email_count = row_count;

    insert into public.notifications (type, title, body, entity_type, entity_id)
    values (
      'birthday_greeting',
      '¡Feliz cumpleaños, ' || v_first_name || '! 🎉',
      'Todo el equipo de Lanzallamas te desea un gran día.',
      'birthday',
      v_birthday.id
    )
    returning id into v_greeting_notification_id;

    insert into public.notification_recipients (notification_id, user_id)
    values (v_greeting_notification_id, v_birthday.id);

    if coalesce(btrim(v_birthday.email), '') <> '' then
      insert into public.email_outbox (
        user_id,
        notification_id,
        to_email,
        subject,
        html
      )
      values (
        v_birthday.id,
        v_greeting_notification_id,
        v_birthday.email,
        '¡Feliz cumpleaños, ' || v_first_name || '! 🎉',
        '<html><body style="background:#f3f4f6;padding:30px 10px;font-family:Arial,sans-serif;margin:0">' ||
        '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' ||
        '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden">' ||
        '<tr><td style="background:#111827;padding:32px;text-align:center;color:#ffffff">' ||
        '<div style="font-size:48px;line-height:1">🎉</div>' ||
        '<h1 style="margin:14px 0 0;font-size:28px">¡Feliz cumpleaños, ' || v_first_name_html || '!</h1>' ||
        '</td></tr><tr><td style="padding:30px;text-align:center;color:#374151">' ||
        '<p style="margin:0;font-size:17px;line-height:1.6">Todo el equipo de Lanzallamas te desea un gran día.</p>' ||
        '<p style="margin:18px 0 0;color:#6b7280;font-size:13px">¡Que lo disfrutes mucho! 🔥</p>' ||
        '</td></tr></table></td></tr></table></body></html>'
      );
      v_greeting_email_count := 1;
    end if;

    update public.birthday_notification_runs
    set
      reminder_notification_id = v_reminder_notification_id,
      greeting_notification_id = v_greeting_notification_id
    where id = v_run_id;

    employee_id := v_birthday.id;
    employee_name := v_name;
    email_count := v_general_email_count + v_greeting_email_count;
    return next;
  end loop;
end;
$$;

revoke all on function public.enqueue_daily_birthday_notifications(date) from public;
revoke all on function public.enqueue_daily_birthday_notifications(date) from anon, authenticated;
grant execute on function public.enqueue_daily_birthday_notifications(date) to service_role;
