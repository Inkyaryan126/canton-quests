create or replace function public.grid_settle_alliance_upkeep(
  p_alliance_id uuid,
  p_season_id uuid,
  p_expected_alliance_revision integer,
  p_expected_pool_influence integer,
  p_ticks integer,
  p_active_member_count integer,
  p_disconnected_component_count integer,
  p_per_tick_influence bigint,
  p_total_influence bigint,
  p_paid_influence integer,
  p_pool_influence_after integer,
  p_shortfall_influence bigint,
  p_fully_paid boolean,
  p_breakdown jsonb,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alliance public.grid_alliances%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_payload jsonb;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'GRID_ALLIANCE_UPKEEP_IDEMPOTENCY_REQUIRED' using errcode = '22023';
  end if;

  select * into v_existing_event
  from public.grid_game_events
  where season_id = p_season_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_event.event_type <> 'alliance_upkeep_settlement'
      or v_existing_event.entity_id is distinct from p_alliance_id then
      raise exception 'GRID_ALLIANCE_UPKEEP_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing_event.payload || jsonb_build_object(
      'eventId', v_existing_event.id,
      'replayed', true
    );
  end if;

  if p_expected_alliance_revision is null or p_expected_alliance_revision < 0
    or p_expected_pool_influence is null or p_expected_pool_influence < 0
    or p_ticks is null or p_ticks <= 0
    or p_active_member_count is null or p_active_member_count <= 0
    or p_disconnected_component_count is null or p_disconnected_component_count < 0
    or p_per_tick_influence is null or p_per_tick_influence < 0
    or p_total_influence is null or p_total_influence < 0
    or p_paid_influence is null or p_paid_influence < 0
    or p_pool_influence_after is null or p_pool_influence_after < 0
    or p_shortfall_influence is null or p_shortfall_influence < 0
    or p_fully_paid is null
    or p_breakdown is null
    or jsonb_typeof(p_breakdown) <> 'object' then
    raise exception 'GRID_ALLIANCE_UPKEEP_VALUES_INVALID' using errcode = '22023';
  end if;

  if p_total_influence <> p_per_tick_influence * p_ticks::bigint then
    raise exception 'GRID_ALLIANCE_UPKEEP_TOTAL_MISMATCH' using errcode = '23514';
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

  if v_alliance.revision <> p_expected_alliance_revision
    or v_alliance.influence_pool <> p_expected_pool_influence then
    return null;
  end if;

  if p_paid_influence::bigint <> least(
      p_expected_pool_influence::bigint,
      p_total_influence
    )
    or p_pool_influence_after <> p_expected_pool_influence - p_paid_influence
    or p_shortfall_influence <> p_total_influence - p_paid_influence::bigint
    or p_fully_paid <> (p_shortfall_influence = 0) then
    raise exception 'GRID_ALLIANCE_UPKEEP_SETTLEMENT_MISMATCH' using errcode = '23514';
  end if;

  update public.grid_alliances
  set influence_pool = p_pool_influence_after,
      revision = revision + 1,
      updated_at = p_now
  where id = p_alliance_id;

  v_payload := jsonb_build_object(
    'ticks', p_ticks,
    'activeMemberCount', p_active_member_count,
    'disconnectedComponentCount', p_disconnected_component_count,
    'perTickInfluence', p_per_tick_influence,
    'totalInfluence', p_total_influence,
    'paidInfluence', p_paid_influence,
    'poolInfluenceAfter', p_pool_influence_after,
    'shortfallInfluence', p_shortfall_influence,
    'fullyPaid', p_fully_paid,
    'breakdown', p_breakdown,
    'allianceRevision', p_expected_alliance_revision + 1
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
  )
  select
    s.city_id,
    p_season_id,
    null,
    'alliance_upkeep_settlement',
    'alliance',
    p_alliance_id,
    v_payload,
    p_idempotency_key,
    p_now
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

revoke all on function public.grid_settle_alliance_upkeep(
  uuid, uuid, integer, integer, integer, integer, integer, bigint, bigint,
  integer, integer, bigint, boolean, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_settle_alliance_upkeep(
  uuid, uuid, integer, integer, integer, integer, integer, bigint, bigint,
  integer, integer, bigint, boolean, jsonb, text, timestamptz
) to service_role;
