-- GRID Phase 2 neutral territory claim transaction.
-- Service-role only. Keeps settlement, spend, ownership, and event append atomic.

create or replace function public.grid_claim_neutral_territory(
  p_season_id uuid,
  p_player_id uuid,
  p_territory_id uuid,
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
  v_territory public.grid_territories%rowtype;
  v_territory_state public.grid_season_territory_state%rowtype;
  v_player_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_economy jsonb;
  v_claims jsonb;
  v_credit_cost bigint;
  v_cp_cost integer;
  v_owned_count integer;
  v_adjacent boolean;
  v_claim_mode text;
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
    if v_existing_event.event_type <> 'grid:territory_claimed'
       or v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.entity_id is distinct from p_territory_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return jsonb_build_object(
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'playerId', p_player_id,
      'territoryId', p_territory_id,
      'territorySlug', v_existing_event.payload ->> 'territorySlug',
      'claimedAt', v_existing_event.created_at,
      'claimMode', v_existing_event.payload ->> 'claimMode',
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
  v_claims := v_economy -> 'neutralClaims';
  if jsonb_typeof(v_economy) <> 'object'
     or jsonb_typeof(v_claims) <> 'object' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  select *
    into v_territory
    from public.grid_territories
   where id = p_territory_id
   for update;
  if not found then
    raise exception 'TERRITORY_NOT_FOUND';
  end if;
  if v_territory.city_id <> v_season.city_id then
    raise exception 'TERRITORY_WRONG_CITY';
  end if;

  insert into public.grid_season_territory_state (
    season_id, city_id, territory_id, owner_player_id, claimed_at, created_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_territory_id, null, null, p_now, p_now
  )
  on conflict (season_id, territory_id) do nothing;

  select *
    into v_territory_state
    from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id = p_territory_id
   for update;
  if v_territory_state.owner_player_id is not null then
    raise exception 'TERRITORY_NOT_NEUTRAL';
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
    p_season_id,
    p_player_id,
    'preclaim:' || p_idempotency_key,
    p_now
  );
  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  select count(*)
    into v_owned_count
    from public.grid_season_territory_state
   where season_id = p_season_id
     and owner_player_id = p_player_id;

  if v_owned_count = 0 then
    if not exists (
      select 1
        from jsonb_array_elements_text(
          coalesce(v_claims -> 'starterTerritorySlugs', '[]'::jsonb)
        ) as starter(slug)
       where starter.slug = v_territory.slug
    ) then
      raise exception 'TERRITORY_NOT_STARTER_ELIGIBLE';
    end if;
    v_claim_mode := 'starter';
  else
    select exists (
      select 1
        from public.grid_territory_edges e
        join public.grid_season_territory_state owned
          on owned.season_id = p_season_id
         and owned.owner_player_id = p_player_id
         and owned.territory_id = case
           when e.territory_a_id = p_territory_id then e.territory_b_id
           else e.territory_a_id
         end
       where e.city_id = v_season.city_id
         and (e.territory_a_id = p_territory_id or e.territory_b_id = p_territory_id)
    ) into v_adjacent;

    if not v_adjacent then
      raise exception 'TERRITORY_NOT_ADJACENT';
    end if;
    v_claim_mode := 'adjacent';
  end if;
  if coalesce(
       v_claims #>> array['costByTerritorySlug', v_territory.slug, 'credits'],
       v_claims #>> '{defaultCost,credits}'
     ) !~ '^[0-9]+$'
     or coalesce(
       v_claims #>> array['costByTerritorySlug', v_territory.slug, 'commandPoints'],
       v_claims #>> '{defaultCost,commandPoints}'
     ) !~ '^[0-9]+$' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
  end if;

  v_credit_cost := coalesce(
    v_claims #>> array['costByTerritorySlug', v_territory.slug, 'credits'],
    v_claims #>> '{defaultCost,credits}'
  )::bigint;
  v_cp_cost := coalesce(
    v_claims #>> array['costByTerritorySlug', v_territory.slug, 'commandPoints'],
    v_claims #>> '{defaultCost,commandPoints}'
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
  update public.grid_season_territory_state
     set owner_player_id = p_player_id,
         claimed_at = p_now,
         updated_at = p_now
   where id = v_territory_state.id
     and owner_player_id is null
  returning * into v_territory_state;
  if not found then
    raise exception 'TERRITORY_NOT_NEUTRAL';
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_player_id, 'grid:territory_claimed', 'territory',
    p_territory_id,
    jsonb_build_object(
      'territorySlug', v_territory.slug,
      'claimMode', v_claim_mode,
      'creditsSpent', v_credit_cost,
      'commandPointsSpent', v_cp_cost,
      'creditsAfter', v_player_state.credits,
      'influenceAfter', v_player_state.influence,
      'commandPointsAfter', v_player_state.command_points
    ),
    p_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'playerId', p_player_id,
    'territoryId', p_territory_id,
    'territorySlug', v_territory.slug,
    'claimedAt', v_territory_state.claimed_at,
    'claimMode', v_claim_mode,
    'creditsSpent', v_credit_cost,
    'commandPointsSpent', v_cp_cost,
    'credits', v_player_state.credits,
    'influence', v_player_state.influence,
    'commandPoints', v_player_state.command_points,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_claim_neutral_territory(uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_claim_neutral_territory(uuid, uuid, uuid, text, timestamptz)
  to service_role;