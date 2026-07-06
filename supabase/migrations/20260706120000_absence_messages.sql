-- Threaded conversation for absence requests.

create table if not exists public.absence_messages (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references public.absences(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists absence_messages_absence_created_idx
  on public.absence_messages(absence_id, created_at asc);

create index if not exists absence_messages_author_idx
  on public.absence_messages(author_id);

alter table public.absence_messages enable row level security;

drop policy if exists "absence_messages_select_participants" on public.absence_messages;
create policy "absence_messages_select_participants"
on public.absence_messages
for select to authenticated
using (
  public.is_owner()
  or exists (
    select 1
    from public.absences a
    where a.id = absence_messages.absence_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "absence_messages_insert_participants" on public.absence_messages;
create policy "absence_messages_insert_participants"
on public.absence_messages
for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_owner()
    or exists (
      select 1
      from public.absences a
      where a.id = absence_messages.absence_id
        and a.user_id = auth.uid()
    )
  )
);

grant select, insert on public.absence_messages to authenticated;

create or replace function public.list_absence_messages(p_absence_id uuid)
returns table (
  id uuid,
  absence_id uuid,
  author_id uuid,
  body text,
  created_at timestamptz,
  author_full_name text,
  author_email text,
  author_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.absence_id,
    m.author_id,
    m.body,
    m.created_at,
    p.full_name::text as author_full_name,
    p.email::text as author_email,
    p.role::text as author_role
  from public.absence_messages m
  join public.absences a on a.id = m.absence_id
  left join public.profiles p on p.id = m.author_id
  where m.absence_id = p_absence_id
    and (
      public.is_owner()
      or a.user_id = auth.uid()
    )
  order by m.created_at asc;
$$;

revoke all on function public.list_absence_messages(uuid) from public;
grant execute on function public.list_absence_messages(uuid) to authenticated;
