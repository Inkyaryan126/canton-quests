-- THE GRID: exactly-once Contract reward outbox settlement.
-- Reward values are server-authored by grid_commit_contract_progress and are
-- never accepted from an API caller.

create or replace function public.grid_settle_contract_reward(
  p_outbox_id uuid,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_outbox public.grid_contract_reward_outbox%rowtype;
  v_season public.grid_seasons%rowtype;
  v_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_balance jsonb;
  v_max_command_points integer;
  v_reward_credits bigint;
  v_reward_influence integer;
  v_reward_command_points integer;
  v_command_points_after integer;
  v_command_points_granted integer;
  v_event_id uuid;
  v_idempotency_key text;
  v_payload jsonb;
begin
  if p_outbox_id is null then
    raise exception 'CONTRACT_REWARD_OUTBOX_ID_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'CONTRACT_REWARD_TIME_REQUIRED';
  end if;

  select *
    into v_outbox
    from public.grid_contract_reward_outbox
   where id = p_outbox_id
   for update;

  if not found then
    raise exception 'CONTRACT_REWARD_OUTBOX_NOT_FOUND';
  end if;

  v_idempotency_key := 'contract-reward-settlement:' || v_outbox.id::text;

  if v_outbox.processed_at is not null then
    select *
      into v_existing_event
      from public.grid_game_events
     where season_id = v_outbox.season_id
       and idempotency_key = v_idempotency_key;

    if not found
       or v_existing_event.event_type <> 'grid:contract_reward_settled'
       or v_existing_event.actor_player_id is distinct from v_outbox.player_id
       or v_existing_event.entity_id is distinct from v_outbox.id then
      raise exception 'CONTRACT_REWARD_PROCESSED_EVENT_MISSING';
    end if;

    return v_existing_event.payload || jsonb_build_object(
      'outcome', 'duplicate',
      'eventId', v_existing_event.id
    );
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = v_outbox.season_id
   for update;

  if not found then
    raise exception 'CONTRACT_REWARD_SEASON_NOT_FOUND';
  end if;
  if v_season.city_id is distinct from v_outbox.city_id then
    raise exception 'CONTRACT_REWARD_CITY_MISMATCH';
  end if;
  if v_season.status not in ('active', 'surge', 'complete') then
    raise exception 'CONTRACT_REWARD_SEASON_NOT_SETTLEABLE';
  end if;

  if jsonb_typeof(v_outbox.reward) <> 'object'
     or exists (
       select 1
         from jsonb_object_keys(v_outbox.reward) as reward_key(key)
        where reward_key.key not in ('credits', 'influence', 'commandPoints')
     )
     or coalesce(v_outbox.reward ->> 'credits', '') !~ '^[0-9]+$'
     or coalesce(v_outbox.reward ->> 'influence', '') !~ '^[0-9]+$'
     or coalesce(v_outbox.reward ->> 'commandPoints', '') !~ '^[0-9]+$' then
    raise exception 'CONTRACT_REWARD_PAYLOAD_INVALID';
  end if;

  begin
    v_reward_credits := (v_outbox.reward ->> 'credits')::bigint;
    if (v_outbox.reward ->> 'influence')::numeric > 2147483647
       or (v_outbox.reward ->> 'commandPoints')::numeric > 2147483647 then
      raise exception 'CONTRACT_REWARD_PAYLOAD_INVALID';
    end if;
    v_reward_influence := (v_outbox.reward ->> 'influence')::integer;
    v_reward_command_points :=
      (v_outbox.reward ->> 'commandPoints')::integer;
  exception
    when numeric_value_out_of_range then
      raise exception 'CONTRACT_REWARD_PAYLOAD_INVALID';
  end;

  v_balance := v_season.config -> 'balance';
  if jsonb_typeof(v_balance) <> 'object'
     or coalesce(v_balance ->> 'maxCommandPoints', '') !~ '^[1-9][0-9]*$' then
    raise exception 'CONTRACT_REWARD_BALANCE_NOT_CONFIGURED';
  end if;

  begin
    v_max_command_points := (v_balance ->> 'maxCommandPoints')::integer;
  exception
    when numeric_value_out_of_range then
      raise exception 'CONTRACT_REWARD_BALANCE_NOT_CONFIGURED';
  end;

  select *
    into v_state
    from public.grid_player_season_state
   where season_id = v_outbox.season_id
     and player_id = v_outbox.player_id
   for update;

  if not found then
    raise exception 'CONTRACT_REWARD_PLAYER_NOT_JOINED';
  end if;
  if v_state.command_points > v_max_command_points then
    raise exception 'CONTRACT_REWARD_COMMAND_POINTS_EXCEED_CONFIG_MAX';
  end if;
  if v_state.credits::numeric + v_reward_credits::numeric > 9223372036854775807 then
    raise exception 'CONTRACT_REWARD_CREDITS_OVERFLOW';
  end if;
  if v_state.influence::bigint + v_reward_influence::bigint > 2147483647 then
    raise exception 'CONTRACT_REWARD_INFLUENCE_OVERFLOW';
  end if;

  v_command_points_after := least(
    v_max_command_points::bigint,
    v_state.command_points::bigint + v_reward_command_points::bigint
  )::integer;
  v_command_points_granted :=
    v_command_points_after - v_state.command_points;

  update public.grid_player_season_state
     set credits = credits + v_reward_credits,
         influence = influence + v_reward_influence,
         command_points = v_command_points_after,
         command_points_updated_at =
           case
             when v_command_points_granted > 0
                  and v_command_points_after = v_max_command_points
             then p_now
             else command_points_updated_at
           end,
         updated_at = p_now
   where id = v_state.id
  returning * into v_state;

  update public.grid_contract_reward_outbox
     set processed_at = p_now
   where id = v_outbox.id;

  v_payload := jsonb_build_object(
    'outboxId', v_outbox.id,
    'seasonId', v_outbox.season_id,
    'playerId', v_outbox.player_id,
    'contractId', v_outbox.contract_id,
    'rewardKind', v_outbox.reward_kind,
    'creditsRequested', v_reward_credits,
    'influenceRequested', v_reward_influence,
    'commandPointsRequested', v_reward_command_points,
    'creditsGranted', v_reward_credits,
    'influenceGranted', v_reward_influence,
    'commandPointsGranted', v_command_points_granted,
    'credits', v_state.credits,
    'influence', v_state.influence,
    'commandPoints', v_state.command_points,
    'processedAt', p_now
  );

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
    v_outbox.city_id,
    v_outbox.season_id,
    v_outbox.player_id,
    'grid:contract_reward_settled',
    'contract_reward',
    v_outbox.id,
    v_payload,
    v_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return v_payload || jsonb_build_object(
    'outcome', 'applied',
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_settle_contract_reward(
  uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_settle_contract_reward(
  uuid, timestamptz
) to service_role;
