-- GRID NPC 14: attacker retreat from PvE stronghold contests.
-- Surviving attacker Influence leaves escrow; NPC garrison has no wallet/refund.

alter table public.grid_pve_stronghold_contests
  drop constraint if exists grid_pve_stronghold_contests_status_check;

alter table public.grid_pve_stronghold_contests
  add constraint grid_pve_stronghold_contests_status_check
  check (status in ('active', 'captured', 'repelled', 'withdrawn'));

create or replace function public.grid_withdraw_pve_stronghold_contest(
  p_contest_id uuid,
  p_attacker_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contest public.grid_pve_stronghold_contests%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;

  select * into v_contest
    from public.grid_pve_stronghold_contests
   where id = p_contest_id
   for update;
  if not found then
    raise exception 'PVE_CONTEST_NOT_FOUND';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = v_contest.season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:pve_stronghold_contest_withdrawn'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.entity_id is distinct from p_contest_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', p_contest_id,
      'seasonId', v_contest.season_id,
      'cityId', v_contest.city_id,
      'strongholdId', v_contest.stronghold_id,
      'status', 'withdrawn',
      'attackerRefundedInfluence',
        (v_existing_event.payload ->> 'attackerRefundedInfluence')::integer,
      'endedAt', v_existing_event.created_at,
      'eventId', v_existing_event.id
    );
  end if;

  if v_contest.status <> 'active' then
    raise exception 'PVE_CONTEST_NOT_ACTIVE';
  end if;
  if v_contest.attacker_player_id is distinct from p_attacker_player_id then
    raise exception 'PVE_CONTEST_WITHDRAW_NOT_ATTACKER';
  end if;

  perform 1
    from public.grid_player_season_state
   where season_id = v_contest.season_id
     and player_id = v_contest.attacker_player_id
   for update;
  if not found then
    raise exception 'ATTACKER_NOT_JOINED';
  end if;

  update public.grid_player_season_state
     set influence = influence + v_contest.attacker_remaining_influence,
         last_active_at = p_now,
         updated_at = p_now
   where season_id = v_contest.season_id
     and player_id = v_contest.attacker_player_id;

  update public.grid_pve_stronghold_contests
     set status = 'withdrawn',
         ended_at = p_now,
         updated_at = p_now
   where id = p_contest_id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_contest.city_id, v_contest.season_id, p_attacker_player_id,
    'grid:pve_stronghold_contest_withdrawn',
    'pve_stronghold_contest',
    p_contest_id,
    jsonb_build_object(
      'strongholdId', v_contest.stronghold_id,
      'attackerRefundedInfluence', v_contest.attacker_remaining_influence,
      'garrisonRemainingInfluence', v_contest.garrison_remaining_influence,
      'targetTerritoryId', v_contest.target_territory_id
    ),
    p_idempotency_key,
    p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'contestId', p_contest_id,
    'seasonId', v_contest.season_id,
    'cityId', v_contest.city_id,
    'strongholdId', v_contest.stronghold_id,
    'status', 'withdrawn',
    'attackerRefundedInfluence', v_contest.attacker_remaining_influence,
    'endedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_withdraw_pve_stronghold_contest(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_withdraw_pve_stronghold_contest(
  uuid, uuid, text, timestamptz
) to service_role;
