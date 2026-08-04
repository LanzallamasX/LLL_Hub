-- Per-recipient unread state for absence conversations.

create table if not exists public.absence_message_recipients (
  message_id uuid not null references public.absence_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz null,
  primary key (message_id, user_id)
);

create index if not exists absence_message_recipients_user_unread_idx
  on public.absence_message_recipients(user_id, read_at);

alter table public.absence_message_recipients enable row level security;

drop policy if exists "absence_message_recipients_select_own"
  on public.absence_message_recipients;
create policy "absence_message_recipients_select_own"
on public.absence_message_recipients
for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.absence_message_recipients
  from anon, authenticated;
grant select on public.absence_message_recipients to authenticated;

create or replace function public.add_absence_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_absence_user_id uuid;
  v_notify_owner_ids uuid[];
  v_selected_owner_count int := 0;
begin
  select a.user_id, a.notify_owner_ids
    into v_absence_user_id, v_notify_owner_ids
  from public.absences a
  where a.id = new.absence_id;

  if v_absence_user_id is null then
    return new;
  end if;

  if new.author_id = v_absence_user_id then
    select count(*)
      into v_selected_owner_count
    from public.profiles p
    where p.role = 'owner'
      and p.active = true
      and p.id = any(coalesce(v_notify_owner_ids, array[]::uuid[]));

    insert into public.absence_message_recipients(message_id, user_id)
    select new.id, p.id
    from public.profiles p
    where p.role = 'owner'
      and p.active = true
      and p.id <> new.author_id
      and (
        v_selected_owner_count = 0
        or p.id = any(coalesce(v_notify_owner_ids, array[]::uuid[]))
      )
    on conflict (message_id, user_id) do nothing;
  else
    insert into public.absence_message_recipients(message_id, user_id)
    select new.id, p.id
    from public.profiles p
    where p.id = v_absence_user_id
      and p.active = true
      and p.id <> new.author_id
    on conflict (message_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.add_absence_message_recipients() from public;

drop trigger if exists trg_add_absence_message_recipients
  on public.absence_messages;
create trigger trg_add_absence_message_recipients
after insert on public.absence_messages
for each row execute function public.add_absence_message_recipients();

-- Historical messages predate read receipts. Mark them as already read so only
-- messages created after this migration appear as new.
insert into public.absence_message_recipients(message_id, user_id, read_at)
select m.id, recipient.id, now()
from public.absence_messages m
join public.absences a on a.id = m.absence_id
join public.profiles recipient
  on (
    (
      m.author_id = a.user_id
      and recipient.role = 'owner'
      and recipient.active = true
      and recipient.id <> m.author_id
      and (
        not exists (
          select 1
          from public.profiles selected_owner
          where selected_owner.role = 'owner'
            and selected_owner.active = true
            and selected_owner.id = any(coalesce(a.notify_owner_ids, array[]::uuid[]))
        )
        or recipient.id = any(coalesce(a.notify_owner_ids, array[]::uuid[]))
      )
    )
    or
    (
      m.author_id <> a.user_id
      and recipient.id = a.user_id
      and recipient.active = true
      and recipient.id <> m.author_id
    )
  )
on conflict (message_id, user_id) do nothing;

create or replace function public.list_my_absence_message_unread_counts()
returns table (
  absence_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select m.absence_id, count(*)::bigint as unread_count
  from public.absence_message_recipients recipient
  join public.absence_messages m on m.id = recipient.message_id
  where recipient.user_id = auth.uid()
    and recipient.read_at is null
  group by m.absence_id;
$$;

revoke all on function public.list_my_absence_message_unread_counts() from public;
grant execute on function public.list_my_absence_message_unread_counts() to authenticated;

create or replace function public.mark_absence_messages_read(p_absence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.absence_message_recipients recipient
  set read_at = now()
  from public.absence_messages message
  where message.id = recipient.message_id
    and message.absence_id = p_absence_id
    and recipient.user_id = auth.uid()
    and recipient.read_at is null;
end;
$$;

revoke all on function public.mark_absence_messages_read(uuid) from public;
grant execute on function public.mark_absence_messages_read(uuid) to authenticated;
