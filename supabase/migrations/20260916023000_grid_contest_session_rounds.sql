-- GRID Contest 3B: resolve persistent contest rounds and terminal outcomes.
-- Committed Influence was escrowed by grid_start_contest; rounds mutate only
-- the contest reserve until the battle ends, then surviving reserve is refunded.

create or replace function public.grid_resolve_contest_session_round(
  p_contest_id uuid,
  p_attacker_player_id uuid,
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
  v_contest public.grid_contests%rowtype;
  v_season public.grid_seasons%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_contest_config jsonb;
  v_die_sides integer;
  v_loss integer;
  v_attacker_dice integer;
  v_defender_dice integer;
  v_attacker_post_dice integer;
  v_defender_post_dice integer;
  v_attacker_sorted integer[];
  v_defender_sorted integer[];
  v_attacker_loss integer := 0;
  v_defender_loss integer := 0;
  v_attacker_remaining integer;
  v_defender_remaining integer;
  v_attacker_refund integer := 0;
  v_defender_refund integer := 0;
  v_status text := 'active';
  v_round_number integer;
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

  select *
    into v_contest
    from public.grid_contests
   where id = p_contest_id
   for update;
  if not found then
    raise exception 'CONTEST_NOT_FOUND';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = v_contest.season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:contest_session_round_resolved'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.entity_id is distinct from p_contest_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', p_contest_id,
      'seasonId', v_contest.season_id,
      'cityId', v_contest.city_id,
      'roundNumber', (v_existing_event.payload ->> 'roundNumber')::integer,
      'status', v_existing_event.payload ->> 'status',
      'attackerRolls', v_existing_event.payload -> 'attackerRolls',
      'defenderRolls', v_existing_event.payload -> 'defenderRolls',
      'comparisons', v_existing_event.payload -> 'comparisons',
      'attackerInfluenceLost', (v_existing_event.payload ->> 'attackerInfluenceLost')::integer,
      'defenderInfluenceLost', (v_existing_event.payload ->> 'defenderInfluenceLost')::integer,
      'attackerRemainingInfluence', (v_existing_event.payload ->> 'attackerRemainingInfluence')::integer,
      'defenderRemainingInfluence', (v_existing_event.payload ->> 'defenderRemainingInfluence')::integer,
      'attackerRefundedInfluence', (v_existing_event.payload ->> 'attackerRefundedInfluence')::integer,
      'defenderRefundedInfluence', (v_existing_event.payload ->> 'defenderRefundedInfluence')::integer,
      'territoryCaptured', (v_existing_event.payload ->> 'territoryCaptured')::boolean,
      'eventId', v_existing_event.id
    );
  end if;

  if v_contest.status <> 'active' then
    raise exception 'CONTEST_NOT_ACTIVE';
  end if;
  if v_contest.attacker_player_id is distinct from p_attacker_player_id then
    raise exception 'CONTEST_ROUND_NOT_ATTACKER';
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = v_contest.season_id
   for update;
  if not found then
    raise exception 'SEASON_NOT_FOUND';
  end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;

  v_contest_config := v_season.config -> 'contest';
  if jsonb_typeof(v_contest_config) <> 'object'
     or coalesce(v_contest_config ->> 'dieSides', '') !~ '^[2-9][0-9]*$'
     or coalesce(v_contest_config ->> 'influenceLossPerComparison', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_contest_config ->> 'tiesFavorDefender', '') <> 'true' then
    raise exception 'CONTEST_NOT_CONFIGURED';
  end if;

  v_die_sides := (v_contest_config ->> 'dieSides')::integer;
  v_loss := (v_contest_config ->> 'influenceLossPerComparison')::integer;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'attacker' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_contest.attacker_remaining_influence;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_defender_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'defender' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_contest.defender_remaining_influence;

  v_attacker_dice := least(
    v_attacker_dice,
    coalesce((v_contest_config #>> '{attacker,maxDice}')::integer, 0)
  );
  v_defender_dice := least(
    v_defender_dice,
    coalesce((v_contest_config #>> '{defender,maxDice}')::integer, 0)
  );

  if v_attacker_dice <= 0 then
    raise exception 'ATTACKER_CANNOT_CONTINUE';
  end if;
  if v_defender_dice <= 0 then
    raise exception 'DEFENDER_CANNOT_CONTINUE';
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

  v_attacker_loss := least(v_attacker_loss, v_contest.attacker_remaining_influence);
  v_defender_loss := least(v_defender_loss, v_contest.defender_remaining_influence);
  v_attacker_remaining := v_contest.attacker_remaining_influence - v_attacker_loss;
  v_defender_remaining := v_contest.defender_remaining_influence - v_defender_loss;
  v_round_number := v_contest.round_number + 1;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_post_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'attacker' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_attacker_remaining;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_defender_post_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'defender' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_defender_remaining;

  -- Defender wins simultaneous exhaustion / inability to continue.
  if v_attacker_remaining <= 0 or v_attacker_post_dice <= 0 then
    v_status := 'defended';
  elsif v_defender_remaining <= 0 or v_defender_post_dice <= 0 then
    v_status := 'captured';
  end if;

  if v_status = 'active' then
    update public.grid_contests
       set attacker_remaining_influence = v_attacker_remaining,
           defender_remaining_influence = v_defender_remaining,
           round_number = v_round_number,
           updated_at = p_now
     where id = p_contest_id;
  else
    v_attacker_refund := v_attacker_remaining;
    v_defender_refund := v_defender_remaining;

    perform 1
      from public.grid_player_season_state
     where season_id = v_contest.season_id
       and player_id in (v_contest.attacker_player_id, v_contest.defender_player_id)
     order by player_id
     for update;

    update public.grid_player_season_state
       set influence = influence + v_attacker_refund,
           last_active_at = p_now,
           updated_at = p_now
     where season_id = v_contest.season_id
       and player_id = v_contest.attacker_player_id;

    update public.grid_player_season_state
       set influence = influence + v_defender_refund,
           last_active_at = p_now,
           updated_at = p_now
     where season_id = v_contest.season_id
       and player_id = v_contest.defender_player_id;

    if v_status = 'captured' then
      update public.grid_season_territory_state
         set owner_player_id = v_contest.attacker_player_id,
             claimed_at = p_now,
             updated_at = p_now
       where season_id = v_contest.season_id
         and territory_id = v_contest.target_territory_id
         and owner_player_id = v_contest.defender_player_id;
      if not found then
        raise exception 'CONTEST_TARGET_OWNERSHIP_CHANGED';
      end if;
    end if;

    update public.grid_contests
       set attacker_remaining_influence = v_attacker_remaining,
           defender_remaining_influence = v_defender_remaining,
           round_number = v_round_number,
           status = v_status,
           ended_at = p_now,
           updated_at = p_now
     where id = p_contest_id;
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_contest.city_id, v_contest.season_id, p_attacker_player_id,
    'grid:contest_session_round_resolved', 'contest', p_contest_id,
    jsonb_build_object(
      'roundNumber', v_round_number,
      'status', v_status,
      'attackerRolls', to_jsonb(p_attacker_rolls),
      'defenderRolls', to_jsonb(p_defender_rolls),
      'comparisons', v_comparisons,
      'attackerInfluenceLost', v_attacker_loss,
      'defenderInfluenceLost', v_defender_loss,
      'attackerRemainingInfluence', v_attacker_remaining,
      'defenderRemainingInfluence', v_defender_remaining,
      'attackerRefundedInfluence', v_attacker_refund,
      'defenderRefundedInfluence', v_defender_refund,
      'territoryCaptured', v_status = 'captured',
      'targetTerritoryId', v_contest.target_territory_id
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'contestId', p_contest_id,
    'seasonId', v_contest.season_id,
    'cityId', v_contest.city_id,
    'roundNumber', v_round_number,
    'status', v_status,
    'attackerRolls', to_jsonb(p_attacker_rolls),
    'defenderRolls', to_jsonb(p_defender_rolls),
    'comparisons', v_comparisons,
    'attackerInfluenceLost', v_attacker_loss,
    'defenderInfluenceLost', v_defender_loss,
    'attackerRemainingInfluence', v_attacker_remaining,
    'defenderRemainingInfluence', v_defender_remaining,
    'attackerRefundedInfluence', v_attacker_refund,
    'defenderRefundedInfluence', v_defender_refund,
    'territoryCaptured', v_status = 'captured',
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_resolve_contest_session_round(
  uuid, uuid, integer[], integer[], text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_resolve_contest_session_round(
  uuid, uuid, integer[], integer[], text, timestamptz
) to service_role;
