-- THE GRID — Comms 2: district and private party/scrimmage channels.

create or replace function public.grid_join_district_chat_channel(
  p_season_id uuid,
  p_player_id uuid,
  p_district_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_city_id uuid;
  v_district public.grid_districts%rowtype;
  v_channel_id uuid;
begin
  select city_id into v_city_id from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id and state.player_id = p_player_id
  ) then raise exception 'PLAYER_NOT_IN_SEASON'; end if;

  select * into v_district from public.grid_districts where id = p_district_id;
  if not found or v_district.city_id <> v_city_id then raise exception 'DISTRICT_NOT_IN_CITY'; end if;

  insert into public.grid_chat_channels (
    city_id, season_id, channel_type, scope_key, display_name,
    created_by_player_id, created_at, updated_at
  ) values (
    v_city_id, p_season_id, 'district', 'district:' || p_district_id::text,
    'DISTRICT // ' || v_district.name, p_player_id, p_now, p_now
  )
  on conflict (season_id, channel_type, scope_key) do update
    set updated_at = public.grid_chat_channels.updated_at
  returning id into v_channel_id;

  insert into public.grid_chat_members (channel_id, player_id, joined_at, left_at)
  values (v_channel_id, p_player_id, p_now, null)
  on conflict (channel_id, player_id) do update set left_at = null;

  return jsonb_build_object(
    'channelId', v_channel_id,
    'channelType', 'district',
    'districtId', p_district_id,
    'displayName', 'DISTRICT // ' || v_district.name
  );
end;
$$;

create or replace function public.grid_create_party_chat_channel(
  p_season_id uuid,
  p_owner_player_id uuid,
  p_display_name text,
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
  v_owner_minor boolean;
  v_name text := btrim(p_display_name);
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'PARTY_NAME_INVALID';
  end if;
  select city_id into v_city_id from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id and state.player_id = p_owner_player_id
  ) then raise exception 'PLAYER_NOT_IN_SEASON'; end if;
  select coalesce(is_minor, false) into v_owner_minor from public.players where id = p_owner_player_id;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
  if v_owner_minor then raise exception 'PRIVATE_CHAT_MINOR_RESTRICTED'; end if;

  insert into public.grid_chat_channels (
    id, city_id, season_id, channel_type, scope_key, display_name,
    created_by_player_id, created_at, updated_at
  ) values (
    v_channel_id, v_city_id, p_season_id, 'party', 'party:' || v_channel_id::text,
    v_name, p_owner_player_id, p_now, p_now
  );
  insert into public.grid_chat_members (channel_id, player_id, role, joined_at)
  values (v_channel_id, p_owner_player_id, 'owner', p_now);

  return jsonb_build_object('channelId', v_channel_id, 'channelType', 'party', 'displayName', v_name);
end;
$$;

create or replace function public.grid_add_party_chat_member(
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
begin
  if p_actor_player_id = p_target_player_id then raise exception 'PARTY_INVITE_SELF'; end if;
  select * into v_channel from public.grid_chat_channels where id = p_channel_id for update;
  if not found then raise exception 'CHAT_CHANNEL_NOT_FOUND'; end if;
  if v_channel.channel_type <> 'party' then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;
  if v_channel.is_archived then raise exception 'CHAT_CHANNEL_ARCHIVED'; end if;

  select role into v_actor_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_actor_player_id and left_at is null;
  if not found or v_actor_role not in ('owner', 'moderator') then raise exception 'PARTY_INVITE_FORBIDDEN'; end if;

  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = v_channel.season_id and state.player_id = p_target_player_id
  ) then raise exception 'PLAYER_NOT_IN_SEASON'; end if;

  select coalesce(is_minor, false) into v_actor_minor from public.players where id = p_actor_player_id;
  select coalesce(is_minor, false) into v_target_minor from public.players where id = p_target_player_id;
  if coalesce(v_actor_minor, false) or coalesce(v_target_minor, false) then
    raise exception 'PRIVATE_CHAT_MINOR_RESTRICTED';
  end if;

  if exists (
    select 1 from public.grid_chat_blocks b
     where (b.blocker_player_id = p_actor_player_id and b.blocked_player_id = p_target_player_id)
        or (b.blocker_player_id = p_target_player_id and b.blocked_player_id = p_actor_player_id)
  ) then raise exception 'CHAT_BLOCKED'; end if;

  insert into public.grid_chat_members (channel_id, player_id, role, joined_at, left_at)
  values (p_channel_id, p_target_player_id, 'member', p_now, null)
  on conflict (channel_id, player_id) do update set role = 'member', left_at = null;

  return jsonb_build_object('channelId', p_channel_id, 'playerId', p_target_player_id, 'role', 'member');
end;
$$;

create or replace function public.grid_leave_party_chat(
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
  v_other_count integer;
begin
  select role into v_role from public.grid_chat_members
   where channel_id = p_channel_id and player_id = p_player_id and left_at is null;
  if not found then raise exception 'CHAT_MEMBERSHIP_REQUIRED'; end if;
  if not exists (
    select 1 from public.grid_chat_channels c
     where c.id = p_channel_id and c.channel_type = 'party' and not c.is_archived
  ) then raise exception 'CHAT_CHANNEL_NOT_PARTY'; end if;

  select count(*) into v_other_count from public.grid_chat_members
   where channel_id = p_channel_id and player_id <> p_player_id and left_at is null;
  if v_role = 'owner' and v_other_count > 0 then raise exception 'PARTY_OWNER_CANNOT_LEAVE'; end if;

  update public.grid_chat_members set left_at = p_now
   where channel_id = p_channel_id and player_id = p_player_id;
  if v_other_count = 0 then
    update public.grid_chat_channels set is_archived = true, updated_at = p_now where id = p_channel_id;
  end if;
  return jsonb_build_object('channelId', p_channel_id, 'left', true);
end;
$$;

revoke all on function public.grid_join_district_chat_channel(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_join_district_chat_channel(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_create_party_chat_channel(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_create_party_chat_channel(uuid, uuid, text, timestamptz) to service_role;
revoke all on function public.grid_add_party_chat_member(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_add_party_chat_member(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_leave_party_chat(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_leave_party_chat(uuid, uuid, timestamptz) to service_role;
