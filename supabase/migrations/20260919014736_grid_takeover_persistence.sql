-- GRID Takeover Persistence: keep property state coherent when an owned territory changes hands.
-- The damage policy is season configuration. This migration does not hardcode punitive damage.

create or replace function public.grid_apply_territory_takeover_properties()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_takeover jsonb;
  v_development_retention_bps integer;
  v_condition_damage_bps integer;
  v_condition_floor_bps integer;
  v_retained_level integer;
  v_after_condition_bps integer;
  v_property_count integer := 0;
  v_fixed_listings_cancelled integer := 0;
  v_cancelled_this integer := 0;
  v_property_changes jsonb := '[]'::jsonb;
  v_event_key text;
begin
  -- Neutral claims, resets, and no-op owner writes are not takeovers.
  if old.owner_player_id is null
     or new.owner_player_id is null
     or new.owner_player_id is not distinct from old.owner_player_id then
    return new;
  end if;

  if new.claimed_at is null then
    raise exception 'TAKEOVER_TIMESTAMP_REQUIRED';
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = new.season_id;
  if not found or v_season.city_id is distinct from new.city_id then
    raise exception 'TAKEOVER_SEASON_NOT_FOUND';
  end if;

  v_takeover := v_season.config -> 'economy' -> 'takeover';
  if jsonb_typeof(v_takeover) <> 'object' then
    raise exception 'TAKEOVER_NOT_CONFIGURED';
  end if;

  if coalesce(v_takeover ->> 'developmentRetentionBps', '') !~ '^[0-9]{1,5}$'
     or coalesce(v_takeover ->> 'conditionDamageBps', '') !~ '^[0-9]{1,5}$'
     or coalesce(v_takeover ->> 'conditionFloorBps', '') !~ '^[0-9]{1,5}$' then
    raise exception 'TAKEOVER_NOT_CONFIGURED';
  end if;

  v_development_retention_bps := (v_takeover ->> 'developmentRetentionBps')::integer;
  v_condition_damage_bps := (v_takeover ->> 'conditionDamageBps')::integer;
  v_condition_floor_bps := (v_takeover ->> 'conditionFloorBps')::integer;

  if v_development_retention_bps > 10000
     or v_condition_damage_bps > 10000
     or v_condition_floor_bps > 10000 then
    raise exception 'TAKEOVER_NOT_CONFIGURED';
  end if;

  -- Lock and transfer only properties owned by the defeated territory owner.
  -- Third-party and neutral properties inside the territory are preserved.
  for v_property_state in
    select state.*
      from public.grid_season_property_state state
      join public.grid_properties property
        on property.id = state.property_id
       and property.city_id = state.city_id
     where state.season_id = new.season_id
       and state.city_id = new.city_id
       and property.territory_id = new.territory_id
       and state.owner_player_id = old.owner_player_id
     order by state.property_id
     for update of state
  loop
    v_retained_level := (
      (v_property_state.development_level::bigint * v_development_retention_bps) / 10000
    )::integer;
    v_after_condition_bps := least(v_property_state.condition_bps,
      greatest(v_condition_floor_bps, v_property_state.condition_bps - v_condition_damage_bps)
    );

    -- A takeover invalidates any fixed-price listing created by the defeated owner.
    update public.grid_market_fixed_price_listings
       set status = 'cancelled',
           cancelled_at = new.claimed_at,
           updated_at = new.claimed_at
     where season_id = new.season_id
       and property_id = v_property_state.property_id
       and seller_player_id = old.owner_player_id
       and status = 'open';
    get diagnostics v_cancelled_this = row_count;
    v_fixed_listings_cancelled := v_fixed_listings_cancelled + v_cancelled_this;

    update public.grid_season_property_state
       set owner_player_id = new.owner_player_id,
           acquired_at = new.claimed_at,
           development_branch = case when v_retained_level = 0 then null else v_property_state.development_branch end,
           development_level = v_retained_level,
           condition_bps = v_after_condition_bps,
           updated_at = new.claimed_at
     where id = v_property_state.id;

    v_property_count := v_property_count + 1;
    v_property_changes := v_property_changes || jsonb_build_array(jsonb_build_object(
      'propertyId', v_property_state.property_id,
      'developmentBranchBefore', v_property_state.development_branch,
      'developmentLevelBefore', v_property_state.development_level,
      'developmentLevelAfter', v_retained_level,
      'conditionBpsBefore', v_property_state.condition_bps,
      'conditionBpsAfter', v_after_condition_bps,
      'acquiredAt', new.claimed_at
    ));
  end loop;

  v_event_key := 'takeover-properties:'
    || new.territory_id::text || ':'
    || new.owner_player_id::text || ':'
    || new.claimed_at::text;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    new.city_id,
    new.season_id,
    new.owner_player_id,
    'grid:takeover_properties_applied',
    'territory',
    new.territory_id,
    jsonb_build_object(
      'territoryId', new.territory_id,
      'previousOwnerPlayerId', old.owner_player_id,
      'newOwnerPlayerId', new.owner_player_id,
      'capturedAt', new.claimed_at,
      'propertyCount', v_property_count,
      'fixedListingsCancelled', v_fixed_listings_cancelled,
      'developmentRetentionBps', v_development_retention_bps,
      'conditionDamageBps', v_condition_damage_bps,
      'conditionFloorBps', v_condition_floor_bps,
      'propertyChanges', v_property_changes
    ),
    v_event_key,
    new.claimed_at
  );

  return new;
end;
$$;

revoke all on function public.grid_apply_territory_takeover_properties()
  from public, anon, authenticated;
grant execute on function public.grid_apply_territory_takeover_properties()
  to service_role;

drop trigger if exists grid_season_territory_takeover_properties
  on public.grid_season_territory_state;
create trigger grid_season_territory_takeover_properties
after update of owner_player_id
on public.grid_season_territory_state
for each row
execute function public.grid_apply_territory_takeover_properties();

-- Backfill only Canton Founding Season rows that already have economy config,
-- and never overwrite an explicitly configured takeover policy.
update public.grid_seasons season
   set config = jsonb_set(
         season.config,
         '{economy,takeover}',
         jsonb_build_object(
           'developmentRetentionBps', 10000,
           'conditionDamageBps', 0,
           'conditionFloorBps', 0
         ),
         true
       ),
       updated_at = now()
  from public.grid_cities city
 where city.id = season.city_id
   and city.slug = 'canton-oh'
   and season.slug = 'founding-season'
   and jsonb_typeof(season.config -> 'economy') = 'object'
   and season.config #> '{economy,takeover}' is null;
