-- GRID Phase 2 economy ownership state.
-- Additive local-first migration. Do not apply to production without a separate approval gate.

alter table public.grid_seasons
  add constraint grid_seasons_id_city_uq unique (id, city_id);

alter table public.grid_properties
  add constraint grid_properties_id_city_uq unique (id, city_id);

create table public.grid_season_territory_state (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  territory_id uuid not null,
  owner_player_id uuid references public.players(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, territory_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (territory_id, city_id)
    references public.grid_territories(id, city_id) on delete cascade
);
create table public.grid_season_property_state (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  property_id uuid not null,
  owner_player_id uuid references public.players(id) on delete set null,
  acquired_at timestamptz,
  development_branch text
    check (
      development_branch is null
      or development_branch in ('commerce', 'influence', 'fortress', 'intel', 'prestige')
    ),
  development_level integer not null default 0
    check (development_level >= 0),
  condition_bps integer not null default 10000
    check (condition_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, property_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (property_id, city_id)
    references public.grid_properties(id, city_id) on delete cascade,
  check (
    (development_level = 0 and development_branch is null)
    or (development_level > 0 and development_branch is not null)
  )
);
alter table public.grid_player_season_state
  add column resources_settled_at timestamptz not null default now(),
  add column credits_accrual_remainder integer not null default 0
    check (credits_accrual_remainder >= 0 and credits_accrual_remainder < 3600000),
  add column influence_accrual_remainder integer not null default 0
    check (influence_accrual_remainder >= 0 and influence_accrual_remainder < 3600000);

create index grid_season_territory_state_owner_idx
  on public.grid_season_territory_state (season_id, owner_player_id)
  where owner_player_id is not null;

create index grid_season_property_state_owner_idx
  on public.grid_season_property_state (season_id, owner_player_id)
  where owner_player_id is not null;

alter table public.grid_season_territory_state enable row level security;
alter table public.grid_season_property_state enable row level security;

revoke insert, update, delete on public.grid_season_territory_state from anon, authenticated;
revoke insert, update, delete on public.grid_season_property_state from anon, authenticated;
