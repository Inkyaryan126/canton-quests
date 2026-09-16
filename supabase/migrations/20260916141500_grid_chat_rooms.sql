-- THE GRID — public social chat rooms.
-- Persistent player-created rooms reuse the authoritative Grid chat message stack.

alter table public.grid_chat_channels
  drop constraint if exists grid_chat_channels_channel_type_check;

alter table public.grid_chat_channels
  add constraint grid_chat_channels_channel_type_check
  check (channel_type in ('city', 'district', 'party', 'direct', 'system', 'room'));

create table public.grid_chat_rooms (
  channel_id uuid primary key references public.grid_chat_channels(id) on delete cascade,
  topic text not null default '' check (length(topic) <= 240),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted')),
  member_limit integer not null default 50 check (member_limit between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grid_chat_rooms_visibility_created_idx
  on public.grid_chat_rooms (visibility, created_at desc);

alter table public.grid_chat_rooms enable row level security;
revoke all on public.grid_chat_rooms from anon, authenticated;
grant select, insert, update, delete on public.grid_chat_rooms to service_role;

create or replace function public.grid_create_public_chat_room(
  p_season_id uuid,
  p_owner_player_id uuid,
  p_display_name text,
  p_topic text default '',
  p_member_limit integer default 50,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_city_id uuid;
  v_channel_id uuid := gen_random_uuid();
  v_name text := regexp_replace(btrim(p_display_name), '\s+', ' ', 'g');
  v_topic text := regexp_replace(btrim(coalesce(p_topic, '')), '\s+', ' ', 'g');
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'ROOM_NAME_INVALID';
  end if;
  if length(v_topic) > 240 then raise exception 'ROOM_TOPIC_TOO_LONG'; end if;
  if p_member_limit is null or p_member_limit < 2 or p_member_limit > 200 then
    raise exception 'ROOM_MEMBER_LIMIT_INVALID';
  end if;

  select city_id into v_city_id from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id and state.player_id = p_owner_player_id
  ) then raise exception 'PLAYER_NOT_IN_SEASON'; end if;

  insert into public.grid_chat_channels (
    id, city_id, season_id, channel_type, scope_key, display_name,
    created_by_player_id, created_at, updated_at
  ) values (
    v_channel_id, v_city_id, p_season_id, 'room', 'room:' || v_channel_id::text,
    v_name, p_owner_player_id, p_now, p_now
  );

  insert into public.grid_chat_rooms (
    channel_id, topic, visibility, member_limit, created_at, updated_at
  ) values (
    v_channel_id, v_topic, 'public', p_member_limit, p_now, p_now
  );

  insert into public.grid_chat_members (channel_id, player_id, role, joined_at)
  values (v_channel_id, p_owner_player_id, 'owner', p_now);

  return jsonb_build_object(
    'channelId', v_channel_id,
    'displayName', v_name,
    'topic', v_topic,
    'memberLimit', p_member_limit
  );
end;
$$;

create or replace function public.grid_join_public_chat_room(
  p_channel_id uuid,
  p_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel public.grid_chat_channels%rowtype;
  v_room public.grid_chat_rooms%rowtype;
  v_member_count integer;
begin
  select * into v_channel
    from public.grid_chat_channels
   where id = p_channel_id
   for update;
  if not found or v_channel.channel_type <> 'room' then raise exception 'CHAT_ROOM_NOT_FOUND'; end if;
  if v_channel.is_archived then raise exception 'CHAT_ROOM_ARCHIVED'; end if;
  if v_channel.is_locked then raise exception 'CHAT_ROOM_LOCKED'; end if;

  select * into v_room
    from public.grid_chat_rooms
   where channel_id = p_channel_id
   for update;
  if not found then raise exception 'CHAT_ROOM_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = v_channel.season_id and state.player_id = p_player_id
  ) then raise exception 'PLAYER_NOT_IN_SEASON'; end if;

  if exists (
    select 1 from public.grid_chat_members member
     where member.channel_id = p_channel_id
       and member.player_id = p_player_id
       and member.left_at is null
  ) then
    return jsonb_build_object('channelId', p_channel_id, 'joined', true, 'duplicate', true);
  end if;

  select count(*) into v_member_count
    from public.grid_chat_members member
   where member.channel_id = p_channel_id
     and member.left_at is null;
  if v_member_count >= v_room.member_limit then raise exception 'ROOM_FULL'; end if;

  insert into public.grid_chat_members (channel_id, player_id, role, joined_at, left_at)
  values (p_channel_id, p_player_id, 'member', p_now, null)
  on conflict (channel_id, player_id) do update
    set role = 'member', joined_at = p_now, left_at = null;

  return jsonb_build_object('channelId', p_channel_id, 'joined', true, 'duplicate', false);
end;
$$;

create or replace function public.grid_leave_public_chat_room(
  p_channel_id uuid,
  p_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
begin
  if not exists (
    select 1 from public.grid_chat_channels channel
     where channel.id = p_channel_id
       and channel.channel_type = 'room'
       and not channel.is_archived
  ) then raise exception 'CHAT_ROOM_NOT_FOUND'; end if;

  select role into v_role
    from public.grid_chat_members
   where channel_id = p_channel_id
     and player_id = p_player_id
     and left_at is null;
  if not found then raise exception 'CHAT_MEMBERSHIP_REQUIRED'; end if;
  if v_role = 'owner' then raise exception 'ROOM_OWNER_CANNOT_LEAVE'; end if;

  update public.grid_chat_members
     set left_at = p_now
   where channel_id = p_channel_id
     and player_id = p_player_id;

  return jsonb_build_object('channelId', p_channel_id, 'left', true);
end;
$$;

revoke all on function public.grid_create_public_chat_room(uuid, uuid, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_create_public_chat_room(uuid, uuid, text, text, integer, timestamptz) to service_role;
revoke all on function public.grid_join_public_chat_room(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_join_public_chat_room(uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_leave_public_chat_room(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_leave_public_chat_room(uuid, uuid, timestamptz) to service_role;
