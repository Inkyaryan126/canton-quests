create or replace function public.grid_apply_alliance_influence_contribution(
  p_alliance_id uuid,
  p_season_id uuid,
  p_player_id uuid,
  p_expected_alliance_revision integer,
  p_expected_player_influence integer,
  p_accepted_influence integer,
  p_player_influence_after integer,
  p_pool_influence_after integer,
  p_pool_cap integer,
  p_constraints text[],
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
  v_player public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_payload jsonb;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'GRID_ALLIANCE_IDEMPOTENCY_REQUIRED' using errcode = '22023';
  end if;

  select * into v_existing_event
  from public.grid_game_events
  where season_id = p_season_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_event.event_type <> 'alliance_influence_contribution'
      or v_existing_event.actor_player_id is distinct from p_player_id
      or v_existing_event.entity_id is distinct from p_alliance_id then
      raise exception 'GRID_ALLIANCE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return v_existing_event.payload || jsonb_build_object(
      'eventId', v_existing_event.id,
      'replayed', true
    );
  end if;

  if p_accepted_influence is null or p_accepted_influence <= 0
    or p_expected_alliance_revision is null or p_expected_alliance_revision < 0
    or p_expected_player_influence is null or p_expected_player_influence < 0
    or p_player_influence_after is null or p_player_influence_after < 0
    or p_pool_influence_after is null or p_pool_influence_after < 0
    or p_pool_cap is null or p_pool_cap <= 0 then
    raise exception 'GRID_ALLIANCE_CONTRIBUTION_VALUES_INVALID' using errcode = '22023';
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

  select * into v_player
  from public.grid_player_season_state
  where season_id = p_season_id
    and player_id = p_player_id
  for update;

  if not found then
    raise exception 'GRID_ALLIANCE_PLAYER_SEASON_STATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.grid_alliance_memberships
    where alliance_id = p_alliance_id
      and season_id = p_season_id
      and player_id = p_player_id
      and left_at is null
  ) then
    raise exception 'GRID_ALLIANCE_ACTIVE_MEMBERSHIP_REQUIRED' using errcode = '23514';
  end if;

  if v_alliance.revision <> p_expected_alliance_revision
    or v_player.influence <> p_expected_player_influence then
    return null;
  end if;

  if v_player.influence - p_accepted_influence <> p_player_influence_after
    or v_alliance.influence_pool + p_accepted_influence <> p_pool_influence_after
    or p_pool_influence_after > p_pool_cap then
    raise exception 'GRID_ALLIANCE_CONTRIBUTION_MISMATCH' using errcode = '23514';
  end if;

  update public.grid_player_season_state
  set influence = p_player_influence_after,
      updated_at = p_now,
      last_active_at = p_now
  where id = v_player.id;

  update public.grid_alliances
  set influence_pool = p_pool_influence_after,
      revision = revision + 1,
      updated_at = p_now
  where id = p_alliance_id;

  v_payload := jsonb_build_object(
    'acceptedInfluence', p_accepted_influence,
    'playerInfluenceAfter', p_player_influence_after,
    'poolInfluenceAfter', p_pool_influence_after,
    'allianceRevision', p_expected_alliance_revision + 1,
    'constraints', to_jsonb(coalesce(p_constraints, array[]::text[]))
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
    p_player_id,
    'alliance_influence_contribution',
    'alliance',
    p_alliance_id,
    v_payload,
    p_idempotency_key,
    p_now
  from public.grid_seasons s
  where s.id = p_season_id
  returning id into v_event_id;

  return v_payload || jsonb_build_object(
    'eventId', v_event_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.grid_apply_alliance_influence_contribution(
  uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, text[], text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_apply_alliance_influence_contribution(
  uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, text[], text, timestamptz
) to service_role;
