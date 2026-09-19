create or replace function public.grid_disband_alliance(
  p_alliance_id uuid,
  p_season_id uuid,
  p_leader_player_id uuid,
  p_expected_alliance_revision integer,
  p_expected_influence_pool integer,
  p_disbanded_at timestamptz,
  p_cooldown_until timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alliance public.grid_alliances%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_closed_count integer := 0;
  v_event_id uuid;
  v_payload jsonb;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'GRID_ALLIANCE_DISBAND_IDEMPOTENCY_REQUIRED' using errcode = '22023';
  end if;
  if p_disbanded_at is null or p_cooldown_until is null
    or p_cooldown_until < p_disbanded_at
    or p_expected_alliance_revision is null or p_expected_alliance_revision < 0
    or p_expected_influence_pool is null or p_expected_influence_pool < 0 then
    raise exception 'GRID_ALLIANCE_DISBAND_VALUES_INVALID' using errcode = '22023';
  end if;

  select * into v_existing_event
  from public.grid_game_events
  where season_id = p_season_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_event.event_type <> 'alliance_disbanded'
      or v_existing_event.actor_player_id is distinct from p_leader_player_id
      or v_existing_event.entity_id is distinct from p_alliance_id then
      raise exception 'GRID_ALLIANCE_DISBAND_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing_event.payload || jsonb_build_object(
      'eventId', v_existing_event.id,
      'replayed', true
    );
  end if;

  select * into v_alliance
  from public.grid_alliances
  where id = p_alliance_id
    and season_id = p_season_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'GRID_ALLIANCE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_alliance.leader_player_id <> p_leader_player_id then
    raise exception 'GRID_ALLIANCE_LEADER_REQUIRED' using errcode = '42501';
  end if;
  if v_alliance.revision <> p_expected_alliance_revision
    or v_alliance.influence_pool <> p_expected_influence_pool then
    return null;
  end if;

  update public.grid_alliance_memberships
  set left_at = p_disbanded_at,
      cooldown_until = p_cooldown_until
  where alliance_id = p_alliance_id
    and season_id = p_season_id
    and left_at is null;
  get diagnostics v_closed_count = row_count;

  if v_closed_count <= 0 then
    raise exception 'GRID_ALLIANCE_ACTIVE_MEMBERSHIP_REQUIRED' using errcode = '23514';
  end if;

  update public.grid_alliances
  set status = 'disbanded',
      disbanded_at = p_disbanded_at,
      revision = revision + 1,
      updated_at = p_disbanded_at
  where id = p_alliance_id;

  v_payload := jsonb_build_object(
    'allianceId', p_alliance_id,
    'status', 'disbanded',
    'disbandedAt', p_disbanded_at,
    'cooldownUntil', p_cooldown_until,
    'closedMembershipCount', v_closed_count,
    'influencePoolLocked', p_expected_influence_pool,
    'allianceRevision', p_expected_alliance_revision + 1
  );

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type, entity_id,
    payload, idempotency_key, created_at
  )
  select
    s.city_id, p_season_id, p_leader_player_id, 'alliance_disbanded',
    'alliance', p_alliance_id, v_payload, p_idempotency_key, p_disbanded_at
  from public.grid_seasons s
  where s.id = p_season_id
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'GRID_ALLIANCE_SEASON_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_payload || jsonb_build_object(
    'eventId', v_event_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.grid_disband_alliance(
  uuid, uuid, uuid, integer, integer, timestamptz, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.grid_disband_alliance(
  uuid, uuid, uuid, integer, integer, timestamptz, timestamptz, text
) to service_role;
