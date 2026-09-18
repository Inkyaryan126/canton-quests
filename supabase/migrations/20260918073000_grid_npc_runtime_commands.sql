-- GRID NPC 11: idempotent, stale-write-safe runtime evidence commands.

create or replace function public.grid_set_npc_surge_intensity(
  p_season_id uuid,
  p_city_id uuid,
  p_surge_intensity_bps integer,
  p_actor_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_state public.grid_npc_season_runtime_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_surge_intensity_bps is not null and (p_surge_intensity_bps < 0 or p_surge_intensity_bps > 10000) then
    raise exception 'NPC_SURGE_INTENSITY_INVALID';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:npc_surge_intensity_set'
       or v_existing_event.actor_player_id is distinct from p_actor_player_id
       or (
         p_surge_intensity_bps is null
         and v_existing_event.payload -> 'surgeIntensityBps' is distinct from 'null'::jsonb
       )
       or (
         p_surge_intensity_bps is not null
         and (v_existing_event.payload ->> 'surgeIntensityBps')::integer is distinct from p_surge_intensity_bps
       ) then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'surgeIntensityBps', v_existing_event.payload -> 'surgeIntensityBps',
      'eventId', v_existing_event.id,
      'duplicate', true,
      'updatedAt', v_existing_event.created_at
    );
  end if;

  select * into v_season from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then raise exception 'NPC_RUNTIME_CITY_MISMATCH'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('npc-runtime:surge:' || p_season_id::text, 0)
  );
  select * into v_state
    from public.grid_npc_season_runtime_state
   where season_id = p_season_id
   for update;
  if found and v_state.updated_at > p_now then raise exception 'NPC_RUNTIME_STALE_WRITE'; end if;

  insert into public.grid_npc_season_runtime_state (
    season_id, city_id, surge_intensity_bps, updated_at
  ) values (
    p_season_id, p_city_id, p_surge_intensity_bps, p_now
  )
  on conflict (season_id) do update
    set city_id = excluded.city_id,
        surge_intensity_bps = excluded.surge_intensity_bps,
        updated_at = excluded.updated_at;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, p_actor_player_id,
    'grid:npc_surge_intensity_set', 'season', p_season_id,
    jsonb_build_object('surgeIntensityBps', p_surge_intensity_bps),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'surgeIntensityBps', p_surge_intensity_bps,
    'eventId', v_event_id,
    'duplicate', false,
    'updatedAt', p_now
  );
end;
$$;

create or replace function public.grid_set_npc_faction_pressure(
  p_season_id uuid,
  p_city_id uuid,
  p_faction_id text,
  p_pressure_bps integer,
  p_actor_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_state public.grid_npc_faction_pressure_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_faction_id is null or btrim(p_faction_id) = '' then raise exception 'NPC_FACTION_ID_REQUIRED'; end if;
  if p_pressure_bps < 0 or p_pressure_bps > 10000 then raise exception 'NPC_FACTION_PRESSURE_INVALID'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:npc_faction_pressure_set'
       or v_existing_event.actor_player_id is distinct from p_actor_player_id
       or v_existing_event.payload ->> 'factionId' is distinct from p_faction_id
       or (v_existing_event.payload ->> 'pressureBps')::integer is distinct from p_pressure_bps then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'factionId', v_existing_event.payload ->> 'factionId',
      'pressureBps', (v_existing_event.payload ->> 'pressureBps')::integer,
      'eventId', v_existing_event.id,
      'duplicate', true,
      'updatedAt', v_existing_event.created_at
    );
  end if;

  select * into v_season from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then raise exception 'NPC_RUNTIME_CITY_MISMATCH'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('npc-runtime:faction:' || p_season_id::text || ':' || p_faction_id, 0)
  );
  select * into v_state
    from public.grid_npc_faction_pressure_state
   where season_id = p_season_id and faction_id = p_faction_id
   for update;
  if found and v_state.updated_at > p_now then raise exception 'NPC_RUNTIME_STALE_WRITE'; end if;

  insert into public.grid_npc_faction_pressure_state (
    season_id, city_id, faction_id, pressure_bps, updated_at
  ) values (
    p_season_id, p_city_id, p_faction_id, p_pressure_bps, p_now
  )
  on conflict (season_id, faction_id) do update
    set city_id = excluded.city_id,
        pressure_bps = excluded.pressure_bps,
        updated_at = excluded.updated_at;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, p_actor_player_id,
    'grid:npc_faction_pressure_set', 'season', p_season_id,
    jsonb_build_object('factionId', p_faction_id, 'pressureBps', p_pressure_bps),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'factionId', p_faction_id,
    'pressureBps', p_pressure_bps,
    'eventId', v_event_id,
    'duplicate', false,
    'updatedAt', p_now
  );
end;
$$;

create or replace function public.grid_set_npc_stronghold_event_state(
  p_season_id uuid,
  p_city_id uuid,
  p_stronghold_id text,
  p_active boolean,
  p_actor_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_definition public.grid_npc_stronghold_definitions%rowtype;
  v_state public.grid_npc_stronghold_event_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_stronghold_id is null or btrim(p_stronghold_id) = '' then raise exception 'NPC_STRONGHOLD_ID_REQUIRED'; end if;
  if p_active is null then raise exception 'NPC_STRONGHOLD_EVENT_ACTIVE_REQUIRED'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:npc_stronghold_event_set'
       or v_existing_event.actor_player_id is distinct from p_actor_player_id
       or v_existing_event.payload ->> 'strongholdId' is distinct from p_stronghold_id
       or (v_existing_event.payload ->> 'active')::boolean is distinct from p_active then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'strongholdId', v_existing_event.payload ->> 'strongholdId',
      'active', (v_existing_event.payload ->> 'active')::boolean,
      'eventId', v_existing_event.id,
      'duplicate', true,
      'updatedAt', v_existing_event.created_at
    );
  end if;

  select * into v_season from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then raise exception 'NPC_RUNTIME_CITY_MISMATCH'; end if;

  select * into v_definition
    from public.grid_npc_stronghold_definitions
   where season_id = p_season_id and stronghold_id = p_stronghold_id;
  if not found then raise exception 'NPC_STRONGHOLD_DEFINITION_NOT_FOUND'; end if;
  if v_definition.city_id is distinct from p_city_id then raise exception 'NPC_STRONGHOLD_DEFINITION_CITY_MISMATCH'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('npc-runtime:stronghold:' || p_season_id::text || ':' || p_stronghold_id, 0)
  );
  select * into v_state
    from public.grid_npc_stronghold_event_state
   where season_id = p_season_id and stronghold_id = p_stronghold_id
   for update;
  if found and v_state.updated_at > p_now then raise exception 'NPC_RUNTIME_STALE_WRITE'; end if;

  insert into public.grid_npc_stronghold_event_state (
    season_id, city_id, stronghold_id, active, updated_at
  ) values (
    p_season_id, p_city_id, p_stronghold_id, p_active, p_now
  )
  on conflict (season_id, stronghold_id) do update
    set city_id = excluded.city_id,
        active = excluded.active,
        updated_at = excluded.updated_at;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, p_actor_player_id,
    'grid:npc_stronghold_event_set', 'npc_stronghold', v_definition.id,
    jsonb_build_object('strongholdId', p_stronghold_id, 'active', p_active),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'strongholdId', p_stronghold_id,
    'active', p_active,
    'eventId', v_event_id,
    'duplicate', false,
    'updatedAt', p_now
  );
end;
$$;

revoke all on function public.grid_set_npc_surge_intensity(
  uuid, uuid, integer, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_set_npc_surge_intensity(
  uuid, uuid, integer, uuid, text, timestamptz
) to service_role;

revoke all on function public.grid_set_npc_faction_pressure(
  uuid, uuid, text, integer, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_set_npc_faction_pressure(
  uuid, uuid, text, integer, uuid, text, timestamptz
) to service_role;

revoke all on function public.grid_set_npc_stronghold_event_state(
  uuid, uuid, text, boolean, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_set_npc_stronghold_event_state(
  uuid, uuid, text, boolean, uuid, text, timestamptz
) to service_role;
