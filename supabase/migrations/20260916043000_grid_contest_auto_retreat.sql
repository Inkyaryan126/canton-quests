-- GRID Contest 6: capture after deterministic offline-defense auto-retreat.
-- Service-role only; validates adjacency/ownership at write time and records
-- the server-computed doctrine decision in the immutable event ledger.

create or replace function public.grid_capture_territory_by_auto_retreat(
  p_season_id uuid,
  p_attacker_player_id uuid,
  p_defender_player_id uuid,
  p_source_territory_id uuid,
  p_target_territory_id uuid,
  p_defense_doctrine_id text,
  p_defense_reason text,
  p_defense_tactic text,
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
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
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
  if btrim(coalesce(p_defense_doctrine_id, '')) = '' then
    raise exception 'OFFLINE_DEFENSE_DOCTRINE_INVALID';
  end if;
  if p_defense_reason not in (
    'retreat-threshold',
    'loss-threshold',
    'insufficient-reserve'
  ) then
    raise exception 'OFFLINE_DEFENSE_RETREAT_REASON_INVALID';
  end if;
  if p_defense_tactic not in ('pressure', 'flank', 'fortify', 'feint') then
    raise exception 'OFFLINE_DEFENSE_TACTIC_INVALID';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:contest_auto_retreat_capture'
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
      'capturedAt', v_existing_event.created_at,
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

  select * into v_source
    from public.grid_territories
   where id = p_source_territory_id;
  if not found then
    raise exception 'SOURCE_TERRITORY_NOT_FOUND';
  end if;

  select * into v_target
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

  select * into v_source_state
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id = p_source_territory_id;
  if not found or v_source_state.owner_player_id is distinct from p_attacker_player_id then
    raise exception 'SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER';
  end if;

  select * into v_target_state
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id = p_target_territory_id;
  if not found or v_target_state.owner_player_id is distinct from p_defender_player_id then
    raise exception 'TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER';
  end if;

  if exists (
    select 1
      from public.grid_contests
     where season_id = p_season_id
       and target_territory_id = p_target_territory_id
       and status = 'active'
  ) then
    raise exception 'TARGET_ALREADY_CONTESTED';
  end if;

  perform public.grid_settle_player_resources(
    p_season_id,
    p_attacker_player_id,
    'pre-auto-retreat:a:' || p_idempotency_key,
    p_now
  );
  perform public.grid_settle_player_resources(
    p_season_id,
    p_defender_player_id,
    'pre-auto-retreat:d:' || p_idempotency_key,
    p_now
  );

  update public.grid_season_territory_state
     set owner_player_id = p_attacker_player_id,
         claimed_at = p_now,
         updated_at = p_now
   where id = v_target_state.id
     and owner_player_id = p_defender_player_id;
  if not found then
    raise exception 'CONTEST_TARGET_OWNERSHIP_CHANGED';
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id,
    p_season_id,
    p_attacker_player_id,
    'grid:contest_auto_retreat_capture',
    'territory',
    p_target_territory_id,
    jsonb_build_object(
      'defenderPlayerId', p_defender_player_id,
      'sourceTerritoryId', p_source_territory_id,
      'defenseDoctrineId', p_defense_doctrine_id,
      'defenseReason', p_defense_reason,
      'defenseTactic', p_defense_tactic
    ),
    p_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'attackerPlayerId', p_attacker_player_id,
    'defenderPlayerId', p_defender_player_id,
    'sourceTerritoryId', p_source_territory_id,
    'targetTerritoryId', p_target_territory_id,
    'capturedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;
revoke all on function public.grid_capture_territory_by_auto_retreat(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_capture_territory_by_auto_retreat(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, timestamptz
) to service_role;
