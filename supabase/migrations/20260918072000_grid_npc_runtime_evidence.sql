-- GRID NPC 10: authoritative runtime evidence storage.
-- Missing rows/nullable Surge intensity intentionally mean "unknown", not zero.

create table public.grid_npc_season_runtime_state (
  season_id uuid primary key,
  city_id uuid not null,
  surge_intensity_bps integer
    check (surge_intensity_bps is null or surge_intensity_bps between 0 and 10000),
  updated_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade
);

create table public.grid_npc_faction_pressure_state (
  season_id uuid not null,
  city_id uuid not null,
  faction_id text not null check (btrim(faction_id) <> ''),
  pressure_bps integer not null check (pressure_bps between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (season_id, faction_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade
);

create table public.grid_npc_stronghold_event_state (
  season_id uuid not null,
  city_id uuid not null,
  stronghold_id text not null check (btrim(stronghold_id) <> ''),
  active boolean not null,
  updated_at timestamptz not null default now(),
  primary key (season_id, stronghold_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (season_id, stronghold_id)
    references public.grid_npc_stronghold_definitions(season_id, stronghold_id)
    on delete cascade
);

create index grid_npc_faction_pressure_city_idx
  on public.grid_npc_faction_pressure_state (city_id, season_id, faction_id);
create index grid_npc_stronghold_event_city_idx
  on public.grid_npc_stronghold_event_state (city_id, season_id, stronghold_id);

alter table public.grid_npc_season_runtime_state enable row level security;
alter table public.grid_npc_faction_pressure_state enable row level security;
alter table public.grid_npc_stronghold_event_state enable row level security;

revoke insert, update, delete on public.grid_npc_season_runtime_state from anon, authenticated;
revoke insert, update, delete on public.grid_npc_faction_pressure_state from anon, authenticated;
revoke insert, update, delete on public.grid_npc_stronghold_event_state from anon, authenticated;
