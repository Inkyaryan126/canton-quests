-- GRID Phase 2 property acquisition, development, and Skyline transition commands.
-- Service-role only; wallet, ownership/development, and events stay atomic.

create or replace function public.grid_acquire_property(
  p_season_id uuid,
  p_player_id uuid,
  p_property_id uuid,
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
  v_property public.grid_properties%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_player_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_economy jsonb;
  v_acquisition jsonb;
  v_credit_cost bigint;
  v_cp_cost integer;
  v_require_control boolean;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:property_acquired'
       or v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.entity_id is distinct from p_property_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return jsonb_build_object(
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'playerId', p_player_id,
      'propertyId', p_property_id,
      'propertySlug', v_existing_event.payload ->> 'propertySlug',
      'territoryId', (v_existing_event.payload ->> 'territoryId')::uuid,
      'acquiredAt', v_existing_event.created_at,
      'creditsSpent', (v_existing_event.payload ->> 'creditsSpent')::bigint,
      'commandPointsSpent', (v_existing_event.payload ->> 'commandPointsSpent')::integer,
      'credits', (v_existing_event.payload ->> 'creditsAfter')::bigint,
      'influence', (v_existing_event.payload ->> 'influenceAfter')::integer,
      'commandPoints', (v_existing_event.payload ->> 'commandPointsAfter')::integer,
      'eventId', v_existing_event.id
    );
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then
    raise exception 'SEASON_NOT_FOUND';
  end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;

  v_economy := v_season.config -> 'economy';
  v_acquisition := v_economy -> 'propertyAcquisition';
  if jsonb_typeof(v_economy) <> 'object'
     or jsonb_typeof(v_acquisition) <> 'object'
     or coalesce(v_acquisition ->> 'requireTerritoryControl', '') not in ('true', 'false') then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;
  v_require_control := (v_acquisition ->> 'requireTerritoryControl')::boolean;

  select *
    into v_property
    from public.grid_properties
   where id = p_property_id
   for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND';
  end if;
  if v_property.city_id <> v_season.city_id then
    raise exception 'PROPERTY_WRONG_CITY';
  end if;

  insert into public.grid_season_property_state (
    season_id, city_id, property_id, owner_player_id, acquired_at,
    development_branch, development_level, created_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_property_id, null, null,
    null, 0, p_now, p_now
  )
  on conflict (season_id, property_id) do nothing;

  select *
    into v_property_state
    from public.grid_season_property_state
   where season_id = p_season_id
     and property_id = p_property_id
   for update;
  if v_property_state.owner_player_id is not null then
    raise exception 'PROPERTY_NOT_AVAILABLE';
  end if;

  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;
  if not found then
    raise exception 'PLAYER_NOT_JOINED';
  end if;

  perform public.grid_settle_player_resources(
    p_season_id, p_player_id, 'preacquire:' || p_idempotency_key, p_now
  );
  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  if v_require_control and not exists (
    select 1
      from public.grid_season_territory_state territory_state
     where territory_state.season_id = p_season_id
       and territory_state.territory_id = v_property.territory_id
       and territory_state.owner_player_id = p_player_id
  ) then
    raise exception 'CONTAINING_TERRITORY_NOT_CONTROLLED';
  end if;

  if coalesce(
       v_acquisition #>> array['costByPropertySlug', v_property.slug, 'credits'],
       v_acquisition #>> '{defaultCost,credits}'
     ) !~ '^[0-9]+$'
     or coalesce(
       v_acquisition #>> array['costByPropertySlug', v_property.slug, 'commandPoints'],
       v_acquisition #>> '{defaultCost,commandPoints}'
     ) !~ '^[0-9]+$' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  v_credit_cost := coalesce(
    v_acquisition #>> array['costByPropertySlug', v_property.slug, 'credits'],
    v_acquisition #>> '{defaultCost,credits}'
  )::bigint;
  v_cp_cost := coalesce(
    v_acquisition #>> array['costByPropertySlug', v_property.slug, 'commandPoints'],
    v_acquisition #>> '{defaultCost,commandPoints}'
  )::integer;

  if v_player_state.credits < v_credit_cost then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;
  if v_player_state.command_points < v_cp_cost then
    raise exception 'INSUFFICIENT_COMMAND_POINTS';
  end if;
  update public.grid_player_season_state
     set credits = credits - v_credit_cost,
         command_points = command_points - v_cp_cost,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_player_state.id
  returning * into v_player_state;

  update public.grid_season_property_state
     set owner_player_id = p_player_id,
         acquired_at = p_now,
         updated_at = p_now
   where id = v_property_state.id
     and owner_player_id is null
  returning * into v_property_state;
  if not found then
    raise exception 'PROPERTY_NOT_AVAILABLE';
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_player_id, 'grid:property_acquired', 'property',
    p_property_id,
    jsonb_build_object(
      'propertySlug', v_property.slug,
      'territoryId', v_property.territory_id,
      'creditsSpent', v_credit_cost,
      'commandPointsSpent', v_cp_cost,
      'creditsAfter', v_player_state.credits,
      'influenceAfter', v_player_state.influence,
      'commandPointsAfter', v_player_state.command_points
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;
  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'playerId', p_player_id,
    'propertyId', p_property_id,
    'propertySlug', v_property.slug,
    'territoryId', v_property.territory_id,
    'acquiredAt', v_property_state.acquired_at,
    'creditsSpent', v_credit_cost,
    'commandPointsSpent', v_cp_cost,
    'credits', v_player_state.credits,
    'influence', v_player_state.influence,
    'commandPoints', v_player_state.command_points,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_develop_property(
  p_season_id uuid,
  p_player_id uuid,
  p_property_id uuid,
  p_branch text,
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
  v_property public.grid_properties%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_player_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_economy jsonb;
  v_level_config jsonb;
  v_credit_cost bigint;
  v_cp_cost integer;
  v_previous_level integer;
  v_next_level integer;
  v_event_id uuid;
  v_skyline_event_id uuid;
  v_skyline_rule_ids jsonb := '[]'::jsonb;
  v_component_property_count integer := 0;
  v_component_branch_count integer := 0;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_branch not in ('commerce', 'influence', 'fortress', 'intel', 'prestige') then
    raise exception 'DEVELOPMENT_BRANCH_INVALID';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:property_developed'
       or v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.entity_id is distinct from p_property_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    select id
      into v_skyline_event_id
      from public.grid_game_events
     where causation_id = v_existing_event.id
       and event_type = 'grid:skyline_formed'
     limit 1;

    return jsonb_build_object(
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'playerId', p_player_id,
      'propertyId', p_property_id,
      'propertySlug', v_existing_event.payload ->> 'propertySlug',
      'territoryId', (v_existing_event.payload ->> 'territoryId')::uuid,
      'developedAt', v_existing_event.created_at,
      'developmentBranch', v_existing_event.payload ->> 'developmentBranch',
      'previousLevel', (v_existing_event.payload ->> 'previousLevel')::integer,
      'developmentLevel', (v_existing_event.payload ->> 'developmentLevel')::integer,
      'creditsSpent', (v_existing_event.payload ->> 'creditsSpent')::bigint,
      'commandPointsSpent', (v_existing_event.payload ->> 'commandPointsSpent')::integer,
      'credits', (v_existing_event.payload ->> 'creditsAfter')::bigint,
      'influence', (v_existing_event.payload ->> 'influenceAfter')::integer,
      'commandPoints', (v_existing_event.payload ->> 'commandPointsAfter')::integer,
      'eventId', v_existing_event.id,
      'skylineEventId', v_skyline_event_id,
      'skylineRuleIds', coalesce(v_existing_event.payload -> 'skylineRuleIds', '[]'::jsonb)
    );
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then
    raise exception 'SEASON_NOT_FOUND';
  end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;
  v_economy := v_season.config -> 'economy';
  if jsonb_typeof(v_economy) <> 'object' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  select *
    into v_property
    from public.grid_properties
   where id = p_property_id
   for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND';
  end if;
  if v_property.city_id <> v_season.city_id then
    raise exception 'PROPERTY_WRONG_CITY';
  end if;

  select *
    into v_property_state
    from public.grid_season_property_state
   where season_id = p_season_id
     and property_id = p_property_id
   for update;
  if not found or v_property_state.owner_player_id is distinct from p_player_id then
    raise exception 'PROPERTY_NOT_OWNED';
  end if;

  v_previous_level := v_property_state.development_level;
  if v_previous_level > 0
     and v_property_state.development_branch is distinct from p_branch then
    raise exception 'DEVELOPMENT_BRANCH_LOCKED';
  end if;
  v_next_level := v_previous_level + 1;

  select level.value
    into v_level_config
    from jsonb_array_elements(
      coalesce(v_economy -> 'development' -> p_branch -> 'levels', '[]'::jsonb)
    ) as level(value)
   where coalesce(level.value ->> 'level', '') ~ '^[1-9][0-9]*$'
     and (level.value ->> 'level')::integer = v_next_level
   limit 1;
  if v_level_config is null then
    raise exception 'DEVELOPMENT_LEVEL_NOT_CONFIGURED';
  end if;
  if coalesce(v_level_config #>> '{cost,credits}', '') !~ '^[0-9]+$'
     or coalesce(v_level_config #>> '{cost,commandPoints}', '') !~ '^[0-9]+$' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;
  v_credit_cost := (v_level_config #>> '{cost,credits}')::bigint;
  v_cp_cost := (v_level_config #>> '{cost,commandPoints}')::integer;

  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;
  if not found then
    raise exception 'PLAYER_NOT_JOINED';
  end if;

  perform public.grid_settle_player_resources(
    p_season_id, p_player_id, 'predevelop:' || p_idempotency_key, p_now
  );

  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  if v_player_state.credits < v_credit_cost then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;
  if v_player_state.command_points < v_cp_cost then
    raise exception 'INSUFFICIENT_COMMAND_POINTS';
  end if;
  update public.grid_player_season_state
     set credits = credits - v_credit_cost,
         command_points = command_points - v_cp_cost,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_player_state.id
  returning * into v_player_state;

  update public.grid_season_property_state
     set development_branch = p_branch,
         development_level = v_next_level,
         updated_at = p_now
   where id = v_property_state.id
  returning * into v_property_state;

  if v_previous_level = 0 then
    with recursive
      developed as (
        select property.territory_id, state.development_branch
          from public.grid_season_property_state state
          join public.grid_properties property
            on property.id = state.property_id
           and property.city_id = state.city_id
         where state.season_id = p_season_id
           and state.owner_player_id = p_player_id
           and state.development_level > 0
      ),
      reachable(territory_id) as (
        select v_property.territory_id
        union
        select case
          when edge.territory_a_id = reachable.territory_id then edge.territory_b_id
          else edge.territory_a_id
        end
          from reachable
          join public.grid_territory_edges edge
            on edge.city_id = v_season.city_id
           and (edge.territory_a_id = reachable.territory_id
                or edge.territory_b_id = reachable.territory_id)
          join developed next_territory
            on next_territory.territory_id = case
              when edge.territory_a_id = reachable.territory_id then edge.territory_b_id
              else edge.territory_a_id
            end
      ),
      component as (
        select state.property_id, state.development_branch
          from public.grid_season_property_state state
          join public.grid_properties property
            on property.id = state.property_id
           and property.city_id = state.city_id
         where state.season_id = p_season_id
           and state.owner_player_id = p_player_id
           and state.development_level > 0
           and property.territory_id in (select territory_id from reachable)
      )
    select count(*), count(distinct development_branch)
      into v_component_property_count, v_component_branch_count
      from component;

    select coalesce(jsonb_agg(rule.value ->> 'id' order by rule.value ->> 'id'), '[]'::jsonb)
      into v_skyline_rule_ids
      from jsonb_array_elements(
        coalesce(v_economy #> '{skyline,rules}', '[]'::jsonb)
      ) as rule(value)
     where coalesce(rule.value ->> 'minDevelopedProperties', '') ~ '^[1-9][0-9]*$'
       and (rule.value ->> 'minDevelopedProperties')::integer <= v_component_property_count
       and (
         rule.value ->> 'branchMode' = 'any'
         or (rule.value ->> 'branchMode' = 'single-branch' and v_component_branch_count = 1)
         or (rule.value ->> 'branchMode' = 'mixed' and v_component_branch_count >= 2)
       );
  end if;
  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_player_id, 'grid:property_developed', 'property',
    p_property_id,
    jsonb_build_object(
      'propertySlug', v_property.slug,
      'territoryId', v_property.territory_id,
      'developmentBranch', p_branch,
      'previousLevel', v_previous_level,
      'developmentLevel', v_next_level,
      'creditsSpent', v_credit_cost,
      'commandPointsSpent', v_cp_cost,
      'creditsAfter', v_player_state.credits,
      'influenceAfter', v_player_state.influence,
      'commandPointsAfter', v_player_state.command_points,
      'skylineRuleIds', v_skyline_rule_ids
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  if jsonb_array_length(v_skyline_rule_ids) > 0 then
    insert into public.grid_game_events (
      city_id, season_id, actor_player_id, event_type, entity_type,
      entity_id, payload, idempotency_key, causation_id, created_at
    ) values (
      v_season.city_id, p_season_id, p_player_id, 'grid:skyline_formed', 'property',
      p_property_id,
      jsonb_build_object(
        'triggerPropertySlug', v_property.slug,
        'ruleIds', v_skyline_rule_ids,
        'developedPropertyCount', v_component_property_count,
        'distinctBranchCount', v_component_branch_count
      ),
      'skyline:' || p_idempotency_key, v_event_id, p_now
    )
    returning id into v_skyline_event_id;
  end if;
  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'playerId', p_player_id,
    'propertyId', p_property_id,
    'propertySlug', v_property.slug,
    'territoryId', v_property.territory_id,
    'developedAt', p_now,
    'developmentBranch', p_branch,
    'previousLevel', v_previous_level,
    'developmentLevel', v_next_level,
    'creditsSpent', v_credit_cost,
    'commandPointsSpent', v_cp_cost,
    'credits', v_player_state.credits,
    'influence', v_player_state.influence,
    'commandPoints', v_player_state.command_points,
    'eventId', v_event_id,
    'skylineEventId', v_skyline_event_id,
    'skylineRuleIds', v_skyline_rule_ids
  );
end;
$$;

revoke all on function public.grid_acquire_property(uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_acquire_property(uuid, uuid, uuid, text, timestamptz)
  to service_role;

revoke all on function public.grid_develop_property(uuid, uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_develop_property(uuid, uuid, uuid, text, text, timestamptz)
  to service_role;