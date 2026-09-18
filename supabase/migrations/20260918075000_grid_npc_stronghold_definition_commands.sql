-- GRID NPC 16: audited stronghold-definition lifecycle commands.
-- Definition identity/tuning locks after first contest; enabled state remains operational.

create or replace function public.grid_upsert_npc_stronghold_definition(
  p_season_id uuid,
  p_city_id uuid,
  p_stronghold_id text,
  p_faction_id text,
  p_territory_id uuid,
  p_landmark_id uuid,
  p_activation text,
  p_base_garrison_influence integer,
  p_max_garrison_influence integer,
  p_pressure_reinforcement_bps integer,
  p_surge_reinforcement_bps integer,
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
  v_existing_event public.grid_game_events%rowtype;
  v_definition_id uuid;
  v_enabled boolean;
  v_changed boolean;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_stronghold_id is null or btrim(p_stronghold_id) = '' then
    raise exception 'NPC_STRONGHOLD_ID_REQUIRED';
  end if;
  if p_faction_id is null or btrim(p_faction_id) = '' then
    raise exception 'NPC_FACTION_ID_REQUIRED';
  end if;
  if p_activation not in ('season', 'event', 'surge') then
    raise exception 'NPC_STRONGHOLD_ACTIVATION_INVALID';
  end if;
  if p_base_garrison_influence <= 0
     or p_max_garrison_influence < p_base_garrison_influence then
    raise exception 'NPC_STRONGHOLD_GARRISON_INVALID';
  end if;
  if p_pressure_reinforcement_bps < 0 or p_pressure_reinforcement_bps > 10000
     or p_surge_reinforcement_bps < 0 or p_surge_reinforcement_bps > 10000 then
    raise exception 'NPC_STRONGHOLD_REINFORCEMENT_INVALID';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:npc_stronghold_definition_upserted'
       or v_existing_event.payload ->> 'strongholdId' is distinct from p_stronghold_id
       or v_existing_event.payload ->> 'factionId' is distinct from p_faction_id
       or (v_existing_event.payload ->> 'territoryId')::uuid is distinct from p_territory_id
       or (v_existing_event.payload ->> 'landmarkId')::uuid is distinct from p_landmark_id
       or v_existing_event.payload ->> 'activation' is distinct from p_activation
       or (v_existing_event.payload ->> 'baseGarrisonInfluence')::integer is distinct from p_base_garrison_influence
       or (v_existing_event.payload ->> 'maxGarrisonInfluence')::integer is distinct from p_max_garrison_influence
       or (v_existing_event.payload ->> 'pressureReinforcementBps')::integer is distinct from p_pressure_reinforcement_bps
       or (v_existing_event.payload ->> 'surgeReinforcementBps')::integer is distinct from p_surge_reinforcement_bps then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'strongholdId', p_stronghold_id,
      'duplicate', true,
      'updatedAt', v_existing_event.created_at
    );
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then
    raise exception 'NPC_STRONGHOLD_DEFINITION_CITY_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'npc-stronghold-definition:' || p_season_id::text || ':' || p_stronghold_id,
      0
    )
  );

  select * into v_definition
    from public.grid_npc_stronghold_definitions
   where season_id = p_season_id
     and stronghold_id = p_stronghold_id
   for update;

  if found then
    v_changed :=
      v_definition.faction_id is distinct from p_faction_id
      or v_definition.territory_id is distinct from p_territory_id
      or v_definition.landmark_id is distinct from p_landmark_id
      or v_definition.activation is distinct from p_activation
      or v_definition.base_garrison_influence is distinct from p_base_garrison_influence
      or v_definition.max_garrison_influence is distinct from p_max_garrison_influence
      or v_definition.pressure_reinforcement_bps is distinct from p_pressure_reinforcement_bps
      or v_definition.surge_reinforcement_bps is distinct from p_surge_reinforcement_bps;

    if v_changed and exists (
      select 1
        from public.grid_pve_stronghold_contests
       where season_id = p_season_id
         and stronghold_id = p_stronghold_id
    ) then
      raise exception 'NPC_STRONGHOLD_DEFINITION_LOCKED_AFTER_CONTEST';
    end if;

    update public.grid_npc_stronghold_definitions
       set faction_id = p_faction_id,
           territory_id = p_territory_id,
           landmark_id = p_landmark_id,
           activation = p_activation,
           base_garrison_influence = p_base_garrison_influence,
           max_garrison_influence = p_max_garrison_influence,
           pressure_reinforcement_bps = p_pressure_reinforcement_bps,
           surge_reinforcement_bps = p_surge_reinforcement_bps,
           updated_at = p_now
     where id = v_definition.id
    returning id, enabled into v_definition_id, v_enabled;
  else
    insert into public.grid_npc_stronghold_definitions (
      season_id, city_id, stronghold_id, faction_id, territory_id, landmark_id,
      activation, base_garrison_influence, max_garrison_influence,
      pressure_reinforcement_bps, surge_reinforcement_bps,
      enabled, created_at, updated_at
    ) values (
      p_season_id, p_city_id, p_stronghold_id, p_faction_id, p_territory_id, p_landmark_id,
      p_activation, p_base_garrison_influence, p_max_garrison_influence,
      p_pressure_reinforcement_bps, p_surge_reinforcement_bps,
      false, p_now, p_now
    ) returning id, enabled into v_definition_id, v_enabled;
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, null,
    'grid:npc_stronghold_definition_upserted',
    'npc_stronghold_definition',
    v_definition_id,
    jsonb_build_object(
      'strongholdId', p_stronghold_id,
      'factionId', p_faction_id,
      'territoryId', p_territory_id,
      'landmarkId', p_landmark_id,
      'activation', p_activation,
      'baseGarrisonInfluence', p_base_garrison_influence,
      'maxGarrisonInfluence', p_max_garrison_influence,
      'pressureReinforcementBps', p_pressure_reinforcement_bps,
      'surgeReinforcementBps', p_surge_reinforcement_bps,
      'enabled', v_enabled
    ),
    p_idempotency_key,
    p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'strongholdId', p_stronghold_id,
    'duplicate', false,
    'updatedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_set_npc_stronghold_definition_enabled(
  p_season_id uuid,
  p_city_id uuid,
  p_stronghold_id text,
  p_enabled boolean,
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
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_stronghold_id is null or btrim(p_stronghold_id) = '' then
    raise exception 'NPC_STRONGHOLD_ID_REQUIRED';
  end if;
  if p_enabled is null then raise exception 'NPC_STRONGHOLD_ENABLED_REQUIRED'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:npc_stronghold_definition_enabled_set'
       or v_existing_event.payload ->> 'strongholdId' is distinct from p_stronghold_id
       or (v_existing_event.payload ->> 'enabled')::boolean is distinct from p_enabled then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'strongholdId', p_stronghold_id,
      'duplicate', true,
      'updatedAt', v_existing_event.created_at
    );
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then
    raise exception 'NPC_STRONGHOLD_DEFINITION_CITY_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'npc-stronghold-definition:' || p_season_id::text || ':' || p_stronghold_id,
      0
    )
  );

  select * into v_definition
    from public.grid_npc_stronghold_definitions
   where season_id = p_season_id
     and stronghold_id = p_stronghold_id
   for update;
  if not found then raise exception 'NPC_STRONGHOLD_DEFINITION_NOT_FOUND'; end if;

  if not p_enabled and exists (
    select 1
      from public.grid_pve_stronghold_contests
     where season_id = p_season_id
       and stronghold_id = p_stronghold_id
       and status = 'active'
  ) then
    raise exception 'NPC_STRONGHOLD_ACTIVE_CONTEST_LOCK';
  end if;

  update public.grid_npc_stronghold_definitions
     set enabled = p_enabled,
         updated_at = p_now
   where id = v_definition.id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, null,
    'grid:npc_stronghold_definition_enabled_set',
    'npc_stronghold_definition',
    v_definition.id,
    jsonb_build_object(
      'strongholdId', p_stronghold_id,
      'enabled', p_enabled
    ),
    p_idempotency_key,
    p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'strongholdId', p_stronghold_id,
    'duplicate', false,
    'updatedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_upsert_npc_stronghold_definition(
  uuid, uuid, text, text, uuid, uuid, text, integer, integer,
  integer, integer, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_upsert_npc_stronghold_definition(
  uuid, uuid, text, text, uuid, uuid, text, integer, integer,
  integer, integer, text, timestamptz
) to service_role;

revoke all on function public.grid_set_npc_stronghold_definition_enabled(
  uuid, uuid, text, boolean, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_set_npc_stronghold_definition_enabled(
  uuid, uuid, text, boolean, text, timestamptz
) to service_role;
