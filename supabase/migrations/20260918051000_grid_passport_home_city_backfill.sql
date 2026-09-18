-- GRID Passport 6: give existing Home City profiles their first permanent stamp.
-- Preserve the profile's prior updated_at as the best available confirmation time.

with backfilled as (
  update public.grid_player_profiles
     set passport = jsonb_build_object(
       'version', 1,
       'homeCityId', home_city_id::text,
       'citiesEntered', 1,
       'entriesRecorded', 1,
       'stamps', jsonb_build_array(
         jsonb_build_object(
           'cityId', home_city_id::text,
           'firstEnteredAt', updated_at,
           'lastEnteredAt', updated_at,
           'entryCount', 1,
           'isHomeCity', true
         )
       )
     )
   where home_city_id is not null
     and passport = '{}'::jsonb
  returning player_id, home_city_id, updated_at
)
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
  backfilled.home_city_id,
  null,
  backfilled.player_id,
  'grid:passport_city_entered',
  'city',
  backfilled.home_city_id,
  jsonb_build_object(
    'enteredAt', backfilled.updated_at,
    'backfilled', true
  ),
  format(
    'passport:home-city:%s:%s',
    backfilled.player_id,
    backfilled.home_city_id
  ),
  backfilled.updated_at
from backfilled
where not exists (
  select 1
    from public.grid_game_events existing
   where existing.season_id is null
     and existing.idempotency_key = format(
       'passport:home-city:%s:%s',
       backfilled.player_id,
       backfilled.home_city_id
     )
);
