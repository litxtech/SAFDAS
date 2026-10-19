-- Fix infinite recursion on conversation_members RLS.
-- Policy previously queried conversation_members inside its own USING clause.

create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = cid
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists members_select on public.conversation_members;
create policy members_select on public.conversation_members for select using (
  user_id = auth.uid()
  or public.is_conversation_member(conversation_id)
);

drop policy if exists conversations_member on public.conversations;
create policy conversations_member on public.conversations for select using (
  public.is_conversation_member(id)
);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (
  public.is_conversation_member(conversation_id)
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and deleted_at is null
  and public.is_conversation_member(conversation_id)
  and not exists (
    select 1 from public.conversation_members other
    where other.conversation_id = messages.conversation_id
      and other.user_id <> auth.uid()
      and public.is_blocked(auth.uid(), other.user_id)
  )
);

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update using (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);
