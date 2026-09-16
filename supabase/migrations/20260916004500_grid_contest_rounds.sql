-- GRID Contest Phase 1: atomic Signal Dice round resolution.
-- Service-role only. Validates live state, applies losses, and appends an immutable event.
-- Territory takeover is intentionally out of scope until persistent multi-round contest state exists.

create or replace function public.grid_resolve_contest_round(
  p_season_id uuid,
  p_attacker_player_id uuid,
  p_defender_player_id uuid,
  p_source_territory_id uuid,
  p_target_territory_id uuid,
  p_attacker_committed_influence integer,
  p_defender_committed_influence integer,
  p_attacker_rolls integer[],
  p_defender_rolls integer[],
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
  v_source public.grid_territories%rowtype;
  v_target public.grid_territories%rowtype;
  v_source_state public.grid_season_territory_state%rowtype;
  v_target_state public.grid_season_territory_state%rowtype;
  v_attacker_state public.grid_player_season_state%rowtype;
  v_defender_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_contest jsonb;
  v_die_sides integer;
  v_loss integer;
  v_attacker_dice integer;
  v_defender_dice integer;
  v_attacker_sorted integer[];
  v_defender_sorted integer[];
  v_attacker_loss integer := 0;
  v_defender_loss integer := 0;
  v_attacker_remaining integer;
  v_defender_remaining integer;
  v_comparisons jsonb := '[]'::jsonb;
  v_event_id uuid;
  v_index integer;
  v_attacker_roll integer;
  v_defender_roll integer;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_attacker_player_id = p_defender_player_id then
    raise exception 'CONTEST_PLAYERS_MUST_DIFFER';
  end if;
  if p_source_territory_id = p_target_territory_id then
    raise exception 'CONTEST_TERRITORIES_MUST_DIFFER';
  end if;
  if p_attacker_committed_influence <= 0 or p_defender_committed_influence <= 0 then
    raise exception 'CONTEST_COMMITMENT_INVALID';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:contest_round_resolved'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.entity_id is distinct from p_target_territory_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return jsonb_build_object(
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'attackerPlayerId', p_attacker_player_id,
      'defenderPlayerId', (v_existing_event.payload ->> 'defenderPlayerId')::uuid,
      'sourceTerritoryId', (v_existing_event.payload ->> 'sourceTerritoryId')::uuid,
      'targetTerritoryId', p_target_territory_id,
      'attackerCommittedInfluence', (v_existing_event.payload ->> 'attackerCommittedInfluence')::integer,
      'defenderCommittedInfluence', (v_existing_event.payload ->> 'defenderCommittedInfluence')::integer,
      'attackerRolls', v_existing_event.payload -> 'attackerRolls',
      'defenderRolls', v_existing_event.payload -> 'defenderRolls',
      'comparisons', v_existing_event.payload -> 'comparisons',
      'attackerInfluenceLost', (v_existing_event.payload ->> 'attackerInfluenceLost')::integer,
      'defenderInfluenceLost', (v_existing_event.payload ->> 'defenderInfluenceLost')::integer,
      'attackerRemainingInfluence', (v_existing_event.payload ->> 'attackerRemainingInfluence')::integer,
      'defenderRemainingInfluence', (v_existing_event.payload ->> 'defenderRemainingInfluence')::integer,
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

  v_contest := v_season.config -> 'contest';
  if jsonb_typeof(v_contest) <> 'object'
     or coalesce(v_contest ->> 'dieSides', '') !~ '^[2-9][0-9]*$'
     or coalesce(v_contest ->> 'influenceLossPerComparison', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_contest ->> 'tiesFavorDefender', '') <> 'true' then
    raise exception 'CONTEST_NOT_CONFIGURED';
  end if;
  v_die_sides := (v_contest ->> 'dieSides')::integer;
  v_loss := (v_contest ->> 'influenceLossPerComparison')::integer;

  select *
    into v_source
    from public.grid_territories
   where id = p_source_territory_id;
  if not found then
    raise exception 'SOURCE_TERRITORY_NOT_FOUND';
  end if;

  select *
    into v_target
    from public.grid_territories
   where id = p_target_territory_id;
  if not found then
    raise exception 'TARGET_TERRITORY_NOT_FOUND';
  end if;

  if v_source.city_id <> v_season.city_id or v_target.city_id <> v_season.city_id then
    raise exception 'CONTEST_TERRITORY_WRONG_CITY';
  end if;

  if not exists (
    select 1
      from public.grid_territory_edges e
     where e.city_id = v_season.city_id
       and (
         (e.territory_a_id = p_source_territory_id and e.territory_b_id = p_target_territory_id)
         or
         (e.territory_b_id = p_source_territory_id and e.territory_a_id = p_target_territory_id)
       )
  ) then
    raise exception 'CONTEST_TERRITORIES_NOT_ADJACENT';
  end if;
  perform 1
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id in (p_source_territory_id, p_target_territory_id)
   order by territory_id
   for update;

  select *
    into v_source_state
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id = p_source_territory_id;
  if not found or v_source_state.owner_player_id is distinct from p_attacker_player_id then
    raise exception 'SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER';
  end if;

  select *
    into v_target_state
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id = p_target_territory_id;
  if not found or v_target_state.owner_player_id is distinct from p_defender_player_id then
    raise exception 'TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER';
  end if;

  if p_attacker_player_id::text < p_defender_player_id::text then
    perform public.grid_settle_player_resources(
      p_season_id, p_attacker_player_id, 'precontest:a:' || p_idempotency_key, p_now
    );
    perform public.grid_settle_player_resources(
      p_season_id, p_defender_player_id, 'precontest:d:' || p_idempotency_key, p_now
    );
  else
    perform public.grid_settle_player_resources(
      p_season_id, p_defender_player_id, 'precontest:d:' || p_idempotency_key, p_now
    );
    perform public.grid_settle_player_resources(
      p_season_id, p_attacker_player_id, 'precontest:a:' || p_idempotency_key, p_now
    );
  end if;

  select *
    into v_attacker_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_attacker_player_id
   for update;
  if not found then
    raise exception 'ATTACKER_NOT_JOINED';
  end if;

  select *
    into v_defender_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_defender_player_id
   for update;
  if not found then
    raise exception 'DEFENDER_NOT_JOINED';
  end if;

  if v_attacker_state.influence < p_attacker_committed_influence then
    raise exception 'ATTACKER_INSUFFICIENT_INFLUENCE';
  end if;
  if v_defender_state.influence < p_defender_committed_influence then
    raise exception 'DEFENDER_INSUFFICIENT_INFLUENCE';
  end if;
  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_dice
    from jsonb_array_elements(coalesce(v_contest -> 'attacker' -> 'bands', '[]'::jsonb)) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_attacker_committed_influence;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_defender_dice
    from jsonb_array_elements(coalesce(v_contest -> 'defender' -> 'bands', '[]'::jsonb)) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_defender_committed_influence;

  v_attacker_dice := least(
    v_attacker_dice,
    coalesce((v_contest #>> '{attacker,maxDice}')::integer, 0)
  );
  v_defender_dice := least(
    v_defender_dice,
    coalesce((v_contest #>> '{defender,maxDice}')::integer, 0)
  );

  if v_attacker_dice <= 0 or v_defender_dice <= 0 then
    raise exception 'CONTEST_COMMITMENT_BELOW_DICE_THRESHOLD';
  end if;
  if cardinality(p_attacker_rolls) <> v_attacker_dice
     or cardinality(p_defender_rolls) <> v_defender_dice then
    raise exception 'CONTEST_DICE_COUNT_INVALID';
  end if;
  if exists (
    select 1 from unnest(p_attacker_rolls) roll
     where roll < 1 or roll > v_die_sides
  ) or exists (
    select 1 from unnest(p_defender_rolls) roll
     where roll < 1 or roll > v_die_sides
  ) then
    raise exception 'CONTEST_DIE_RESULT_INVALID';
  end if;

  select array_agg(roll order by roll desc)
    into v_attacker_sorted
    from unnest(p_attacker_rolls) roll;
  select array_agg(roll order by roll desc)
    into v_defender_sorted
    from unnest(p_defender_rolls) roll;

  for v_index in 1..least(cardinality(v_attacker_sorted), cardinality(v_defender_sorted)) loop
    v_attacker_roll := v_attacker_sorted[v_index];
    v_defender_roll := v_defender_sorted[v_index];

    if v_attacker_roll > v_defender_roll then
      v_defender_loss := v_defender_loss + v_loss;
      v_comparisons := v_comparisons || jsonb_build_array(jsonb_build_object(
        'attackerRoll', v_attacker_roll,
        'defenderRoll', v_defender_roll,
        'winner', 'attacker'
      ));
    else
      v_attacker_loss := v_attacker_loss + v_loss;
      v_comparisons := v_comparisons || jsonb_build_array(jsonb_build_object(
        'attackerRoll', v_attacker_roll,
        'defenderRoll', v_defender_roll,
        'winner', 'defender'
      ));
    end if;
  end loop;
  v_attacker_loss := least(v_attacker_loss, p_attacker_committed_influence);
  v_defender_loss := least(v_defender_loss, p_defender_committed_influence);
  v_attacker_remaining := p_attacker_committed_influence - v_attacker_loss;
  v_defender_remaining := p_defender_committed_influence - v_defender_loss;

  update public.grid_player_season_state
     set influence = influence - v_attacker_loss,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_attacker_state.id
     and influence >= v_attacker_loss
  returning * into v_attacker_state;
  if not found then
    raise exception 'ATTACKER_INSUFFICIENT_INFLUENCE';
  end if;

  update public.grid_player_season_state
     set influence = influence - v_defender_loss,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_defender_state.id
     and influence >= v_defender_loss
  returning * into v_defender_state;
  if not found then
    raise exception 'DEFENDER_INSUFFICIENT_INFLUENCE';
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_attacker_player_id,
    'grid:contest_round_resolved', 'territory', p_target_territory_id,
    jsonb_build_object(
      'defenderPlayerId', p_defender_player_id,
      'sourceTerritoryId', p_source_territory_id,
      'attackerCommittedInfluence', p_attacker_committed_influence,
      'defenderCommittedInfluence', p_defender_committed_influence,
      'attackerRolls', to_jsonb(p_attacker_rolls),
      'defenderRolls', to_jsonb(p_defender_rolls),
      'comparisons', v_comparisons,
      'attackerInfluenceLost', v_attacker_loss,
      'defenderInfluenceLost', v_defender_loss,
      'attackerRemainingInfluence', v_attacker_remaining,
      'defenderRemainingInfluence', v_defender_remaining,
      'attackerInfluenceAfter', v_attacker_state.influence,
      'defenderInfluenceAfter', v_defender_state.influence
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'attackerPlayerId', p_attacker_player_id,
    'defenderPlayerId', p_defender_player_id,
    'sourceTerritoryId', p_source_territory_id,
    'targetTerritoryId', p_target_territory_id,
    'attackerCommittedInfluence', p_attacker_committed_influence,
    'defenderCommittedInfluence', p_defender_committed_influence,
    'attackerRolls', to_jsonb(p_attacker_rolls),
    'defenderRolls', to_jsonb(p_defender_rolls),
    'comparisons', v_comparisons,
    'attackerInfluenceLost', v_attacker_loss,
    'defenderInfluenceLost', v_defender_loss,
    'attackerRemainingInfluence', v_attacker_remaining,
    'defenderRemainingInfluence', v_defender_remaining,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_resolve_contest_round(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer[], integer[], text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_resolve_contest_round(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer[], integer[], text, timestamptz
) to service_role;
