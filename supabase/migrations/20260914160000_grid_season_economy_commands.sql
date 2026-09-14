-- GRID Phase 2 server-authoritative economy commands.
-- These functions are deliberately service-role only. Do not expose browser execution.

create or replace function public.grid_join_season(
  p_season_id uuid,
  p_player_id uuid,
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
  v_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_balance jsonb;
  v_economy jsonb;
  v_starting_credits bigint;
  v_starting_influence integer;
  v_max_command_points integer;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
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

  v_balance := v_season.config -> 'balance';
  v_economy := v_season.config -> 'economy';
  if jsonb_typeof(v_balance) <> 'object' or jsonb_typeof(v_economy) <> 'object' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  if coalesce(v_balance ->> 'startingCredits', '') !~ '^[0-9]+$'
     or coalesce(v_balance ->> 'startingInfluence', '') !~ '^[0-9]+$'
     or coalesce(v_balance ->> 'maxCommandPoints', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_balance ->> 'commandPointRegenMinutes', '') !~ '^[1-9][0-9]*$' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  v_starting_credits := (v_balance ->> 'startingCredits')::bigint;
  v_starting_influence := (v_balance ->> 'startingInfluence')::integer;
  v_max_command_points := (v_balance ->> 'maxCommandPoints')::integer;

  -- Exact idempotent replay: return the same joined state without another grant/event.
  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:season_joined'
       or v_existing_event.actor_player_id is distinct from p_player_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    select *
      into v_state
      from public.grid_player_season_state
     where season_id = p_season_id
       and player_id = p_player_id
     for update;

    if not found then
      raise exception 'IDEMPOTENCY_STATE_MISSING';
    end if;

    return jsonb_build_object(
      'seasonId', v_state.season_id,
      'cityId', v_season.city_id,
      'playerId', v_state.player_id,
      'credits', v_state.credits,
      'influence', v_state.influence,
      'commandPoints', v_state.command_points,
      'commandPointsUpdatedAt', v_state.command_points_updated_at,
      'resourcesSettledAt', v_state.resources_settled_at,
      'creditsAccrualRemainder', v_state.credits_accrual_remainder,
      'influenceAccrualRemainder', v_state.influence_accrual_remainder,
      'joined', true,
      'eventId', v_existing_event.id
    );
  end if;

  -- Natural idempotency: a player can join a season only once even with a new command key.
  select *
    into v_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  if found then
    return jsonb_build_object(
      'seasonId', v_state.season_id,
      'cityId', v_season.city_id,
      'playerId', v_state.player_id,
      'credits', v_state.credits,
      'influence', v_state.influence,
      'commandPoints', v_state.command_points,
      'commandPointsUpdatedAt', v_state.command_points_updated_at,
      'resourcesSettledAt', v_state.resources_settled_at,
      'creditsAccrualRemainder', v_state.credits_accrual_remainder,
      'influenceAccrualRemainder', v_state.influence_accrual_remainder,
      'joined', false,
      'eventId', null
    );
  end if;

  -- A fresh season join starts with a full configured Command Point bar.
  insert into public.grid_player_season_state (
    season_id,
    player_id,
    credits,
    influence,
    command_points,
    command_points_updated_at,
    resources_settled_at,
    credits_accrual_remainder,
    influence_accrual_remainder,
    last_active_at,
    created_at,
    updated_at
  ) values (
    p_season_id,
    p_player_id,
    v_starting_credits,
    v_starting_influence,
    v_max_command_points,
    p_now,
    p_now,
    0,
    0,
    p_now,
    p_now,
    p_now
  )
  on conflict (season_id, player_id) do nothing
  returning * into v_state;

  -- A concurrent join may have won the unique-key race while this transaction waited.
  if not found then
    select *
      into v_state
      from public.grid_player_season_state
     where season_id = p_season_id
       and player_id = p_player_id
     for update;

    return jsonb_build_object(
      'seasonId', v_state.season_id,
      'cityId', v_season.city_id,
      'playerId', v_state.player_id,
      'credits', v_state.credits,
      'influence', v_state.influence,
      'commandPoints', v_state.command_points,
      'commandPointsUpdatedAt', v_state.command_points_updated_at,
      'resourcesSettledAt', v_state.resources_settled_at,
      'creditsAccrualRemainder', v_state.credits_accrual_remainder,
      'influenceAccrualRemainder', v_state.influence_accrual_remainder,
      'joined', false,
      'eventId', null
    );
  end if;

  insert into public.grid_game_events (
    city_id,
    season_id,
    actor_player_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    created_at
  ) values (
    v_season.city_id,
    p_season_id,
    p_player_id,
    'grid:season_joined',
    'player_season_state',
    v_state.id,
    jsonb_build_object(
      'startingCredits', v_starting_credits,
      'startingInfluence', v_starting_influence,
      'startingCommandPoints', v_max_command_points
    ),
    p_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', v_state.season_id,
    'cityId', v_season.city_id,
    'playerId', v_state.player_id,
    'credits', v_state.credits,
    'influence', v_state.influence,
    'commandPoints', v_state.command_points,
    'commandPointsUpdatedAt', v_state.command_points_updated_at,
    'resourcesSettledAt', v_state.resources_settled_at,
    'creditsAccrualRemainder', v_state.credits_accrual_remainder,
    'influenceAccrualRemainder', v_state.influence_accrual_remainder,
    'joined', true,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_settle_player_resources(
  p_season_id uuid,
  p_player_id uuid,
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
  v_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_balance jsonb;
  v_economy jsonb;
  v_max_command_points integer;
  v_regen_minutes integer;
  v_offline_cap_minutes bigint;
  v_credit_rate bigint := 0;
  v_influence_rate bigint := 0;
  v_development_credit_rate bigint := 0;
  v_development_influence_rate bigint := 0;
  v_elapsed_ms bigint;
  v_billable_ms bigint;
  v_credit_numerator numeric;
  v_influence_numerator numeric;
  v_credits_earned bigint := 0;
  v_influence_earned bigint := 0;
  v_credit_remainder integer;
  v_influence_remainder integer;
  v_cp_elapsed_ms bigint;
  v_cp_interval_ms bigint;
  v_cp_whole_intervals bigint := 0;
  v_cp_regenerated integer := 0;
  v_new_command_points integer;
  v_new_cp_updated_at timestamptz;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
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

  v_balance := v_season.config -> 'balance';
  v_economy := v_season.config -> 'economy';
  if jsonb_typeof(v_balance) <> 'object' or jsonb_typeof(v_economy) <> 'object' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  if coalesce(v_balance ->> 'maxCommandPoints', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_balance ->> 'commandPointRegenMinutes', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_economy ->> 'offlineAccrualCapMinutes', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_economy #>> '{income,territories,defaultRate,creditsPerHour}', '') !~ '^[0-9]+$'
     or coalesce(v_economy #>> '{income,territories,defaultRate,influencePerHour}', '') !~ '^[0-9]+$'
     or coalesce(v_economy #>> '{income,properties,defaultRate,creditsPerHour}', '') !~ '^[0-9]+$'
     or coalesce(v_economy #>> '{income,properties,defaultRate,influencePerHour}', '') !~ '^[0-9]+$' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  v_max_command_points := (v_balance ->> 'maxCommandPoints')::integer;
  v_regen_minutes := (v_balance ->> 'commandPointRegenMinutes')::integer;
  v_offline_cap_minutes := (v_economy ->> 'offlineAccrualCapMinutes')::bigint;

  -- Exact replay of a settlement that produced an event.
  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:resources_settled'
       or v_existing_event.actor_player_id is distinct from p_player_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    select *
      into v_state
      from public.grid_player_season_state
     where season_id = p_season_id
       and player_id = p_player_id
     for update;

    if not found then
      raise exception 'IDEMPOTENCY_STATE_MISSING';
    end if;

    return jsonb_build_object(
      'seasonId', v_state.season_id,
      'cityId', v_season.city_id,
      'playerId', v_state.player_id,
      'credits', v_state.credits,
      'influence', v_state.influence,
      'commandPoints', v_state.command_points,
      'commandPointsUpdatedAt', v_state.command_points_updated_at,
      'resourcesSettledAt', v_state.resources_settled_at,
      'creditsAccrualRemainder', v_state.credits_accrual_remainder,
      'influenceAccrualRemainder', v_state.influence_accrual_remainder,
      'joined', false,
      'eventId', v_existing_event.id
    );
  end if;

  select *
    into v_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  if not found then
    raise exception 'PLAYER_NOT_JOINED';
  end if;
  if p_now < v_state.resources_settled_at or p_now < v_state.command_points_updated_at then
    raise exception 'COMMAND_TIME_MOVED_BACKWARD';
  end if;
  if v_state.command_points > v_max_command_points then
    raise exception 'COMMAND_POINTS_EXCEED_CONFIG_MAX';
  end if;

  -- Territory base income, using per-slug override when configured.
  select
    coalesce(sum(coalesce(
      nullif(((v_economy #> '{income,territories,rateBySlug}') -> t.slug ->> 'creditsPerHour'), '')::bigint,
      (v_economy #>> '{income,territories,defaultRate,creditsPerHour}')::bigint
    )), 0),
    coalesce(sum(coalesce(
      nullif(((v_economy #> '{income,territories,rateBySlug}') -> t.slug ->> 'influencePerHour'), '')::bigint,
      (v_economy #>> '{income,territories,defaultRate,influencePerHour}')::bigint
    )), 0)
    into v_credit_rate, v_influence_rate
    from public.grid_season_territory_state s
    join public.grid_territories t on t.id = s.territory_id and t.city_id = s.city_id
   where s.season_id = p_season_id
     and s.owner_player_id = p_player_id;

  -- Property base income, also configuration-driven by slug.
  select
    v_credit_rate + coalesce(sum(coalesce(
      nullif(((v_economy #> '{income,properties,rateBySlug}') -> p.slug ->> 'creditsPerHour'), '')::bigint,
      (v_economy #>> '{income,properties,defaultRate,creditsPerHour}')::bigint
    )), 0),
    v_influence_rate + coalesce(sum(coalesce(
      nullif(((v_economy #> '{income,properties,rateBySlug}') -> p.slug ->> 'influencePerHour'), '')::bigint,
      (v_economy #>> '{income,properties,defaultRate,influencePerHour}')::bigint
    )), 0)
    into v_credit_rate, v_influence_rate
    from public.grid_season_property_state s
    join public.grid_properties p on p.id = s.property_id and p.city_id = s.city_id
   where s.season_id = p_season_id
     and s.owner_player_id = p_player_id;

  -- Explicit per-level development bonuses. Skyline bonuses are added in the Skyline phase.
  select
    coalesce(sum(coalesce(nullif(level.value #>> '{bonuses,creditsPerHour}', '')::bigint, 0)), 0),
    coalesce(sum(coalesce(nullif(level.value #>> '{bonuses,influencePerHour}', '')::bigint, 0)), 0)
    into v_development_credit_rate, v_development_influence_rate
    from public.grid_season_property_state s
    cross join lateral jsonb_array_elements(
      coalesce(
        (v_economy -> 'development' -> s.development_branch -> 'levels'),
        '[]'::jsonb
      )
    ) as level(value)
   where s.season_id = p_season_id
     and s.owner_player_id = p_player_id
     and s.development_branch is not null
     and s.development_level > 0
     and coalesce(level.value ->> 'level', '') ~ '^[1-9][0-9]*$'
     and (level.value ->> 'level')::integer <= s.development_level;

  v_credit_rate := v_credit_rate + v_development_credit_rate;
  v_influence_rate := v_influence_rate + v_development_influence_rate;

  v_elapsed_ms := greatest(
    0,
    floor(extract(epoch from (p_now - v_state.resources_settled_at)) * 1000)::bigint
  );
  v_billable_ms := least(v_elapsed_ms, v_offline_cap_minutes * 60000);

  v_credit_numerator :=
    v_state.credits_accrual_remainder::numeric + v_credit_rate::numeric * v_billable_ms::numeric;
  v_influence_numerator :=
    v_state.influence_accrual_remainder::numeric + v_influence_rate::numeric * v_billable_ms::numeric;

  v_credits_earned := floor(v_credit_numerator / 3600000)::bigint;
  v_influence_earned := floor(v_influence_numerator / 3600000)::bigint;
  v_credit_remainder := mod(v_credit_numerator, 3600000)::integer;
  v_influence_remainder := mod(v_influence_numerator, 3600000)::integer;

  v_new_command_points := v_state.command_points;
  v_new_cp_updated_at := v_state.command_points_updated_at;
  if v_state.command_points = v_max_command_points then
    -- Full players cannot bank hidden regeneration time.
    v_new_cp_updated_at := p_now;
  else
    v_cp_interval_ms := v_regen_minutes::bigint * 60000;
    v_cp_elapsed_ms := floor(
      extract(epoch from (p_now - v_state.command_points_updated_at)) * 1000
    )::bigint;
    v_cp_whole_intervals := v_cp_elapsed_ms / v_cp_interval_ms;
    v_cp_regenerated := least(
      v_cp_whole_intervals,
      (v_max_command_points - v_state.command_points)::bigint
    )::integer;
    v_new_command_points := v_state.command_points + v_cp_regenerated;

    if v_new_command_points = v_max_command_points then
      v_new_cp_updated_at := p_now;
    elsif v_cp_whole_intervals > 0 then
      v_new_cp_updated_at :=
        v_state.command_points_updated_at
        + (v_cp_whole_intervals * v_regen_minutes) * interval '1 minute';
    end if;
  end if;

  update public.grid_player_season_state
     set credits = credits + v_credits_earned,
         influence = influence + v_influence_earned::integer,
         command_points = v_new_command_points,
         command_points_updated_at = v_new_cp_updated_at,
         resources_settled_at = p_now,
         credits_accrual_remainder = v_credit_remainder,
         influence_accrual_remainder = v_influence_remainder,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_state.id
  returning * into v_state;

  if v_credits_earned > 0 or v_influence_earned > 0 or v_cp_regenerated > 0 then
    insert into public.grid_game_events (
      city_id,
      season_id,
      actor_player_id,
      event_type,
      entity_type,
      entity_id,
      payload,
      idempotency_key,
      created_at
    ) values (
      v_season.city_id,
      p_season_id,
      p_player_id,
      'grid:resources_settled',
      'player_season_state',
      v_state.id,
      jsonb_build_object(
        'creditsEarned', v_credits_earned,
        'influenceEarned', v_influence_earned,
        'commandPointsRegenerated', v_cp_regenerated,
        'creditsPerHour', v_credit_rate,
        'influencePerHour', v_influence_rate,
        'billableMilliseconds', v_billable_ms,
        'settledAt', p_now
      ),
      p_idempotency_key,
      p_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'seasonId', v_state.season_id,
    'cityId', v_season.city_id,
    'playerId', v_state.player_id,
    'credits', v_state.credits,
    'influence', v_state.influence,
    'commandPoints', v_state.command_points,
    'commandPointsUpdatedAt', v_state.command_points_updated_at,
    'resourcesSettledAt', v_state.resources_settled_at,
    'creditsAccrualRemainder', v_state.credits_accrual_remainder,
    'influenceAccrualRemainder', v_state.influence_accrual_remainder,
    'joined', false,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_join_season(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_join_season(uuid, uuid, text, timestamptz)
  to service_role;

revoke all on function public.grid_settle_player_resources(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_settle_player_resources(uuid, uuid, text, timestamptz)
  to service_role;
