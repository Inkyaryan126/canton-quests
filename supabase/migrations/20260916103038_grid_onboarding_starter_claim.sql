-- GRID Onboarding 5: guarded starter-only territory claim.
-- The general neutral-claim function also supports later adjacent expansion.
-- This wrapper makes onboarding incapable of invoking that expansion path.

create or replace function public.grid_claim_onboarding_starter_territory(
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
  v_existing_event public.grid_game_events%rowtype;
  v_player_state public.grid_player_season_state%rowtype;
  v_owned_count integer;
  v_claims jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;

  -- Preserve exact retry semantics after the first claim has changed ownership.
  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:territory_claimed'
       or v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.entity_id is distinct from p_territory_id
       or v_existing_event.payload ->> 'claimMode' <> 'starter' then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return public.grid_claim_neutral_territory(
      p_season_id,
      p_player_id,
      p_territory_id,
      p_idempotency_key,
      p_now
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

  v_claims := v_season.config -> 'economy' -> 'neutralClaims';
  if jsonb_typeof(v_claims) <> 'object' then
    raise exception 'ECONOMY_NOT_CONFIGURED';
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

  select count(*)
    into v_owned_count
    from public.grid_season_territory_state
   where season_id = p_season_id
     and owner_player_id = p_player_id;

  if v_owned_count <> 0 then
    raise exception 'ONBOARDING_STARTER_ALREADY_CLAIMED';
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

  if not exists (
    select 1
      from jsonb_array_elements_text(
        coalesce(v_claims -> 'starterTerritorySlugs', '[]'::jsonb)
      ) as starter(slug)
     where starter.slug = v_territory.slug
  ) then
    raise exception 'TERRITORY_NOT_STARTER_ELIGIBLE';
  end if;

  -- The proven neutral-claim engine performs settlement, affordability,
  -- neutral ownership locking, wallet debit, event creation and final claim.
  return public.grid_claim_neutral_territory(
    p_season_id,
    p_player_id,
    p_territory_id,
    p_idempotency_key,
    p_now
  );
end;
$$;

revoke all on function public.grid_claim_onboarding_starter_territory(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_claim_onboarding_starter_territory(
  uuid, uuid, uuid, text, timestamptz
) to service_role;
