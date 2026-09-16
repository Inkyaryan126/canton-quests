-- THE GRID — Comms 3A: party lifecycle management.

create or replace function public.grid_set_party_chat_member_role(
  p_channel_id uuid,
  p_actor_player_id uuid,
  p_target_player_id uuid,
  p_role text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if p_role not in ('member', 'moderator') then raise exception 'PARTY_ROLE_INVALID'; end if;
  if not exists (
    select 1 from public.grid_chat_channels c
     where c.id = p_channel_id and c.channel_type = 'party' and not c.is_archived
  ) then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;

  select role into v_actor_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_actor_player_id and left_at is null;
  if v_actor_role is distinct from 'owner' then raise exception 'PARTY_OWNER_REQUIRED'; end if;
  if p_actor_player_id = p_target_player_id then raise exception 'PARTY_OWNER_ROLE_LOCKED'; end if;

  select role into v_target_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_target_player_id and left_at is null;
  if not found then raise exception 'PARTY_MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'PARTY_OWNER_ROLE_LOCKED'; end if;

  update public.grid_chat_members
     set role = p_role
   where channel_id = p_channel_id and player_id = p_target_player_id;
  update public.grid_chat_channels set updated_at = p_now where id = p_channel_id;

  return jsonb_build_object('channelId', p_channel_id, 'playerId', p_target_player_id, 'role', p_role);
end;
$$;

create or replace function public.grid_remove_party_chat_member(
  p_channel_id uuid,
  p_actor_player_id uuid,
  p_target_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if p_actor_player_id = p_target_player_id then raise exception 'PARTY_REMOVE_SELF_USE_LEAVE'; end if;
  if not exists (
    select 1 from public.grid_chat_channels c
     where c.id = p_channel_id and c.channel_type = 'party' and not c.is_archived
  ) then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;

  select role into v_actor_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_actor_player_id and left_at is null;
  if v_actor_role not in ('owner', 'moderator') then raise exception 'PARTY_MODERATION_FORBIDDEN'; end if;

  select role into v_target_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_target_player_id and left_at is null;
  if not found then raise exception 'PARTY_MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'PARTY_OWNER_CANNOT_BE_REMOVED'; end if;
  if v_actor_role = 'moderator' and v_target_role <> 'member' then raise exception 'PARTY_MODERATOR_SCOPE_FORBIDDEN'; end if;

  update public.grid_chat_members
     set left_at = p_now
   where channel_id = p_channel_id and player_id = p_target_player_id;
  update public.grid_chat_channels set updated_at = p_now where id = p_channel_id;

  return jsonb_build_object('channelId', p_channel_id, 'playerId', p_target_player_id, 'removed', true);
end;
$$;

create or replace function public.grid_transfer_party_chat_owner(
  p_channel_id uuid,
  p_owner_player_id uuid,
  p_target_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_role text;
begin
  if p_owner_player_id = p_target_player_id then raise exception 'PARTY_OWNER_TRANSFER_SELF'; end if;
  if not exists (
    select 1 from public.grid_chat_channels c
     where c.id = p_channel_id and c.channel_type = 'party' and not c.is_archived
  ) then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;

  select role into v_owner_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_owner_player_id and left_at is null;
  if v_owner_role is distinct from 'owner' then raise exception 'PARTY_OWNER_REQUIRED'; end if;

  if not exists (
    select 1 from public.grid_chat_members
     where channel_id = p_channel_id and player_id = p_target_player_id and left_at is null
  ) then raise exception 'PARTY_MEMBER_NOT_FOUND'; end if;

  update public.grid_chat_members set role = 'moderator'
   where channel_id = p_channel_id and player_id = p_owner_player_id;
  update public.grid_chat_members set role = 'owner'
   where channel_id = p_channel_id and player_id = p_target_player_id;
  update public.grid_chat_channels set updated_at = p_now where id = p_channel_id;

  return jsonb_build_object(
    'channelId', p_channel_id,
    'previousOwnerPlayerId', p_owner_player_id,
    'ownerPlayerId', p_target_player_id
  );
end;
$$;

revoke all on function public.grid_set_party_chat_member_role(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_set_party_chat_member_role(uuid, uuid, uuid, text, timestamptz) to service_role;
revoke all on function public.grid_remove_party_chat_member(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_remove_party_chat_member(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_transfer_party_chat_owner(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_transfer_party_chat_owner(uuid, uuid, uuid, timestamptz) to service_role;
