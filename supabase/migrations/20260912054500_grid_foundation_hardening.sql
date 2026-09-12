-- GRID Foundation hardening: closes two structural gaps identified in
-- Foundation acceptance review of 20260912052232_grid_foundation.sql.
-- Local-only migration; no production data affected.

-- 1) grid_game_events idempotency must hold globally when season_id is null.
--    A plain UNIQUE(season_id, idempotency_key) lets Postgres treat every
--    NULL season_id as distinct, so two global (non-seasonal) events could
--    reuse the same idempotency_key. NULLS NOT DISTINCT (PG15+; this project
--    runs PG17 locally) makes NULL season_id values compare equal to each
--    other within the partial index, closing the gap while leaving
--    per-season scoping (distinct non-null season_id values) unchanged.
drop index if exists public.grid_game_events_idempotency_uq;

create unique index grid_game_events_idempotency_uq
  on public.grid_game_events (season_id, idempotency_key) nulls not distinct
  where idempotency_key is not null;

-- 2) grid_territory_edges must not be able to structurally connect
--    territories belonging to different cities. Plain single-column FKs on
--    territory_a_id/territory_b_id only guarantee the referenced territory
--    exists somewhere -- not that it belongs to the edge's own city_id. Add
--    a composite unique key on grid_territories(id, city_id) so each edge
--    endpoint's FK can require (territory_id, city_id) to match the edge's
--    own city_id, making cross-city edges impossible at the database level
--    rather than relying on application code to enforce it.
alter table public.grid_territories
  add constraint grid_territories_id_city_uq unique (id, city_id);

alter table public.grid_territory_edges
  drop constraint grid_territory_edges_territory_a_id_fkey,
  drop constraint grid_territory_edges_territory_b_id_fkey;

alter table public.grid_territory_edges
  add constraint grid_territory_edges_territory_a_fkey
    foreign key (territory_a_id, city_id) references public.grid_territories(id, city_id) on delete cascade,
  add constraint grid_territory_edges_territory_b_fkey
    foreign key (territory_b_id, city_id) references public.grid_territories(id, city_id) on delete cascade;
