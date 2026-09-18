-- THE GRID — Comms 6: consent-based party invitations.
-- Party membership must be accepted by the invited player.

create table public.grid_chat_party_invites (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.grid_chat_channels(id) on delete cascade,
  inviter_player_id uuid not null references public.players(id) on delete cascade,
  invitee_player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (inviter_player_id <> invitee_player_id),
  check (expires_at > created_at)
);

create unique index grid_chat_party_invites_pending_unique
  on public.grid_chat_party_invites (channel_id, invitee_player_id)
  where status = 'pending';

create index grid_chat_party_invites_invitee_pending_idx
  on public.grid_chat_party_invites (invitee_player_id, created_at desc)
  where status = 'pending';

alter table public.grid_chat_party_invites enable row level security;

revoke all on table public.grid_chat_party_invites from public;
revoke all on table public.grid_chat_party_invites from anon, authenticated;
grant select, insert, update, delete on table public.grid_chat_party_invites to service_role;
create or replace function public.grid_invite_party_chat_member(
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
  v_channel public.grid_chat_channels%rowtype;
  v_actor_role text;
  v_actor_minor boolean;
  v_target_minor boolean;
  v_invite_id uuid := gen_random_uuid();
  v_expires_at timestamptz := p_now + interval '24 hours';
begin
  if p_actor_player_id = p_target_player_id then
    raise exception 'PARTY_INVITE_SELF';
  end if;

  select * into v_channel
    from public.grid_chat_channels
   where id = p_channel_id
   for update;
  if not found then raise exception 'CHAT_CHANNEL_NOT_FOUND'; end if;
  if v_channel.channel_type <> 'party' then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;
  if v_channel.is_archived then raise exception 'CHAT_CHANNEL_ARCHIVED'; end if;
  select role into v_actor_role
    from public.grid_chat_members
   where channel_id = p_channel_id
     and player_id = p_actor_player_id
     and left_at is null;
  if not found or v_actor_role not in ('owner', 'moderator') then
    raise exception 'PARTY_INVITE_FORBIDDEN';
  end if;

  if not exists (
    select 1
      from public.grid_player_season_state state
     where state.season_id = v_channel.season_id
       and state.player_id = p_target_player_id
  ) then
    raise exception 'PLAYER_NOT_IN_SEASON';
  end if;

  if exists (
    select 1
      from public.grid_chat_members
     where channel_id = p_channel_id
       and player_id = p_target_player_id
       and left_at is null
  ) then
    raise exception 'PARTY_MEMBER_ALREADY_ACTIVE';
  end if;

  select coalesce(is_minor, false)
    into v_actor_minor
    from public.players
   where id = p_actor_player_id;
  select coalesce(is_minor, false)
    into v_target_minor
    from public.players
   where id = p_target_player_id;
  if coalesce(v_actor_minor, false) or coalesce(v_target_minor, false) then
    raise exception 'PRIVATE_CHAT_MINOR_RESTRICTED';
  end if;

  if exists (
    select 1
      from public.grid_chat_blocks b
     where (b.blocker_player_id = p_actor_player_id and b.blocked_player_id = p_target_player_id)
        or (b.blocker_player_id = p_target_player_id and b.blocked_player_id = p_actor_player_id)
  ) then
    raise exception 'CHAT_BLOCKED';
  end if;

  update public.grid_chat_party_invites
     set status = 'expired',
         responded_at = p_now
   where channel_id = p_channel_id
     and invitee_player_id = p_target_player_id
     and status = 'pending'
     and expires_at <= p_now;

  if exists (
    select 1
      from public.grid_chat_party_invites
     where channel_id = p_channel_id
       and invitee_player_id = p_target_player_id
       and status = 'pending'
  ) then
    raise exception 'PARTY_INVITE_ALREADY_PENDING';
  end if;

  insert into public.grid_chat_party_invites (
    id, channel_id, inviter_player_id, invitee_player_id,
    status, created_at, expires_at
  ) values (
    v_invite_id, p_channel_id, p_actor_player_id, p_target_player_id,
    'pending', p_now, v_expires_at
  );
  return jsonb_build_object(
    'inviteId', v_invite_id,
    'channelId', p_channel_id,
    'inviteePlayerId', p_target_player_id,
    'status', 'pending',
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.grid_accept_party_chat_invite(
  p_invite_id uuid,
  p_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.grid_chat_party_invites%rowtype;
  v_channel public.grid_chat_channels%rowtype;
  v_inviter_role text;
  v_inviter_minor boolean;
  v_invitee_minor boolean;
begin
  select * into v_invite
    from public.grid_chat_party_invites
   where id = p_invite_id
   for update;
  if not found then raise exception 'PARTY_INVITE_NOT_FOUND'; end if;
  if v_invite.invitee_player_id <> p_player_id then
    raise exception 'PARTY_INVITE_RESPONSE_FORBIDDEN';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'PARTY_INVITE_NOT_PENDING';
  end if;

  if v_invite.expires_at <= p_now then
    update public.grid_chat_party_invites
       set status = 'expired',
           responded_at = p_now
     where id = p_invite_id;
    return jsonb_build_object(
      'inviteId', p_invite_id,
      'channelId', v_invite.channel_id,
      'accepted', false,
      'status', 'expired'
    );
  end if;

  select * into v_channel
    from public.grid_chat_channels
   where id = v_invite.channel_id
   for update;
  if not found then raise exception 'CHAT_CHANNEL_NOT_FOUND'; end if;
  if v_channel.channel_type <> 'party' then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;
  if v_channel.is_archived then raise exception 'CHAT_CHANNEL_ARCHIVED'; end if;

  select role into v_inviter_role
    from public.grid_chat_members
   where channel_id = v_invite.channel_id
     and player_id = v_invite.inviter_player_id
     and left_at is null;
  if not found or v_inviter_role not in ('owner', 'moderator') then
    raise exception 'PARTY_INVITE_FORBIDDEN';
  end if;
  if not exists (
    select 1
      from public.grid_player_season_state state
     where state.season_id = v_channel.season_id
       and state.player_id = p_player_id
  ) then
    raise exception 'PLAYER_NOT_IN_SEASON';
  end if;

  select coalesce(is_minor, false)
    into v_inviter_minor
    from public.players
   where id = v_invite.inviter_player_id;
  select coalesce(is_minor, false)
    into v_invitee_minor
    from public.players
   where id = p_player_id;

  if coalesce(v_inviter_minor, false) or coalesce(v_invitee_minor, false) then
    raise exception 'PRIVATE_CHAT_MINOR_RESTRICTED';
  end if;

  if exists (
    select 1
      from public.grid_chat_blocks b
     where (b.blocker_player_id = v_invite.inviter_player_id and b.blocked_player_id = p_player_id)
        or (b.blocker_player_id = p_player_id and b.blocked_player_id = v_invite.inviter_player_id)
  ) then
    raise exception 'CHAT_BLOCKED';
  end if;

  insert into public.grid_chat_members (
    channel_id, player_id, role, joined_at, left_at
  ) values (
    v_invite.channel_id, p_player_id, 'member', p_now, null
  )
  on conflict (channel_id, player_id)
  do update set role = 'member', joined_at = p_now, left_at = null;
  update public.grid_chat_party_invites
     set status = 'accepted',
         responded_at = p_now
   where id = p_invite_id;

  update public.grid_chat_channels
     set updated_at = p_now
   where id = v_invite.channel_id;

  return jsonb_build_object(
    'inviteId', p_invite_id,
    'channelId', v_invite.channel_id,
    'playerId', p_player_id,
    'accepted', true,
    'status', 'accepted'
  );
end;
$$;

create or replace function public.grid_decline_party_chat_invite(
  p_invite_id uuid,
  p_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.grid_chat_party_invites%rowtype;
  v_status text;
begin
  select * into v_invite
    from public.grid_chat_party_invites
   where id = p_invite_id
   for update;
  if not found then raise exception 'PARTY_INVITE_NOT_FOUND'; end if;
  if v_invite.invitee_player_id <> p_player_id then
    raise exception 'PARTY_INVITE_RESPONSE_FORBIDDEN';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'PARTY_INVITE_NOT_PENDING';
  end if;

  v_status := case
    when v_invite.expires_at <= p_now then 'expired'
    else 'declined'
  end;

  update public.grid_chat_party_invites
     set status = v_status,
         responded_at = p_now
   where id = p_invite_id;

  return jsonb_build_object(
    'inviteId', p_invite_id,
    'channelId', v_invite.channel_id,
    'declined', v_status = 'declined',
    'status', v_status
  );
end;
$$;

revoke all on function public.grid_invite_party_chat_member(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_invite_party_chat_member(uuid, uuid, uuid, timestamptz)
  to service_role;

revoke all on function public.grid_accept_party_chat_invite(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_accept_party_chat_invite(uuid, uuid, timestamptz)
  to service_role;

revoke all on function public.grid_decline_party_chat_invite(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_decline_party_chat_invite(uuid, uuid, timestamptz)
  to service_role;
-- Retire the old force-add command. Existing code can no longer bypass consent.
revoke all on function public.grid_add_party_chat_member(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.grid_add_party_chat_member(uuid, uuid, uuid, timestamptz)
  from service_role;
