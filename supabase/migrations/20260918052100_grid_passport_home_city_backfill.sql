-- Backfill the canonical replayable Passport for Grid profiles that established
-- Home City before Passport event recording existed.
with candidates as (
  select
    profile.player_id,
    profile.home_city_id,
    profile.global_reputation,
    profile.updated_at,
    city.slug as city_slug
  from public.grid_player_profiles profile
  join public.grid_cities city on city.id = profile.home_city_id
  where profile.home_city_id is not null
    and profile.passport = '{}'::jsonb
    and not exists (
      select 1
        from public.grid_game_events existing_passport_event
       where existing_passport_event.actor_player_id = profile.player_id
         and existing_passport_event.event_type like 'grid:passport_%'
    )
),
home_events as (
  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type, entity_id,
    payload, idempotency_key, created_at
  )
  select
    home_city_id, null, player_id, 'grid:passport_home_city_set', 'city', home_city_id,
    jsonb_build_object('citySlug', city_slug, 'backfilled', true),
    format('passport:home-city-set:%s:%s', player_id, home_city_id),
    updated_at
  from candidates
  on conflict (idempotency_key) where season_id is null and idempotency_key is not null
  do nothing
  returning actor_player_id
),
reputation_events as (
  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type, entity_id,
    payload, idempotency_key, created_at
  )
  select
    home_city_id, null, player_id, 'grid:passport_reputation_earned', 'player', player_id,
    jsonb_build_object(
      'amount', global_reputation,
      'reason', 'pre-passport-profile-backfill',
      'citySlug', city_slug,
      'backfilled', true
    ),
    format('passport:reputation-backfill:%s', player_id),
    updated_at
  from candidates
  where global_reputation > 0
  on conflict (idempotency_key) where season_id is null and idempotency_key is not null
  do nothing
  returning actor_player_id
)
update public.grid_player_profiles profile
set passport = jsonb_build_object(
  'version', 1,
  'homeCitySlug', candidate.city_slug,
  'citiesEntered', jsonb_build_array(candidate.city_slug),
  'cityRanks', '[]'::jsonb,
  'championships', '[]'::jsonb,
  'peakRank', null,
  'lifetimeTerritoriesControlled', 0,
  'landmarkAchievements', '[]'::jsonb,
  'allianceChampionships', '[]'::jsonb,
  'seasonalTrophies', '[]'::jsonb,
  'rareCosmetics', '[]'::jsonb,
  'nationalReputation', candidate.global_reputation,
  'processedEventCount', 1 + case when candidate.global_reputation > 0 then 1 else 0 end,
  'lastUpdatedAt', candidate.updated_at
)
from candidates candidate
where profile.player_id = candidate.player_id;
