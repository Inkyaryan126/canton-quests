create extension if not exists postgis with schema extensions;

create table public.grid_cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region_code text not null,
  country_code text not null default 'US',
  timezone text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'retired')),
  map_center extensions.geography(Point, 4326),
  boundary extensions.geometry(MultiPolygon, 4326),
  package_version integer not null default 1 check (package_version > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grid_seasons (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  slug text not null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'surge', 'complete', 'archived')),
  starts_at timestamptz,
  surge_starts_at timestamptz,
  ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug),
  check (
    starts_at is null
    or ends_at is null
    or starts_at < ends_at
  ),
  check (
    surge_starts_at is null
    or starts_at is null
    or ends_at is null
    or (starts_at < surge_starts_at and surge_starts_at < ends_at)
  )
);

create table public.grid_districts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  slug text not null,
  name text not null,
  boundary extensions.geometry(MultiPolygon, 4326),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_territories (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  district_id uuid not null references public.grid_districts(id) on delete restrict,
  slug text not null,
  name text not null,
  boundary extensions.geometry(MultiPolygon, 4326),
  centroid extensions.geography(Point, 4326),
  base_value bigint not null default 0 check (base_value >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_territory_edges (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_a_id uuid not null references public.grid_territories(id) on delete cascade,
  territory_b_id uuid not null references public.grid_territories(id) on delete cascade,
  edge_type text not null default 'border'
    check (edge_type in ('border', 'corridor')),
  created_at timestamptz not null default now(),
  check (territory_a_id <> territory_b_id)
);

create unique index grid_territory_edges_pair_uq
  on public.grid_territory_edges (
    city_id,
    least(territory_a_id, territory_b_id),
    greatest(territory_a_id, territory_b_id)
  );

create table public.grid_properties (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_id uuid not null references public.grid_territories(id) on delete restrict,
  slug text not null,
  display_name text not null,
  external_ref text,
  public_name_safe boolean not null default false,
  boundary extensions.geometry(MultiPolygon, 4326),
  point extensions.geography(Point, 4326),
  base_value bigint not null default 0 check (base_value >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_landmarks (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_id uuid references public.grid_territories(id) on delete set null,
  slug text not null,
  name text not null,
  point extensions.geography(Point, 4326),
  boundary extensions.geometry(MultiPolygon, 4326),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_player_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  home_city_id uuid references public.grid_cities(id) on delete set null,
  global_reputation bigint not null default 0 check (global_reputation >= 0),
  passport jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grid_player_season_state (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  credits bigint not null default 0 check (credits >= 0),
  influence integer not null default 0 check (influence >= 0),
  command_points integer not null default 0 check (command_points >= 0),
  command_points_updated_at timestamptz not null default now(),
  city_power bigint not null default 0 check (city_power >= 0),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, player_id)
);

create table public.grid_game_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete restrict,
  season_id uuid references public.grid_seasons(id) on delete restrict,
  actor_player_id uuid references public.players(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  correlation_id uuid,
  causation_id uuid references public.grid_game_events(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index grid_game_events_idempotency_uq
  on public.grid_game_events (season_id, idempotency_key)
  where idempotency_key is not null;

create index grid_cities_boundary_gix
  on public.grid_cities using gist (boundary);
create index grid_cities_center_gix
  on public.grid_cities using gist (map_center);
create index grid_districts_boundary_gix
  on public.grid_districts using gist (boundary);
create index grid_territories_boundary_gix
  on public.grid_territories using gist (boundary);
create index grid_territories_centroid_gix
  on public.grid_territories using gist (centroid);
create index grid_properties_boundary_gix
  on public.grid_properties using gist (boundary);
create index grid_properties_point_gix
  on public.grid_properties using gist (point);
create index grid_landmarks_point_gix
  on public.grid_landmarks using gist (point);
create index grid_game_events_season_created_idx
  on public.grid_game_events (season_id, created_at desc);
create index grid_game_events_actor_created_idx
  on public.grid_game_events (actor_player_id, created_at desc);

create or replace function public.grid_reject_game_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'grid_game_events is append-only; write a compensating event instead';
end;
$$;

create trigger grid_game_events_immutable
before update or delete on public.grid_game_events
for each row execute function public.grid_reject_game_event_mutation();

alter table public.grid_cities enable row level security;
alter table public.grid_seasons enable row level security;
alter table public.grid_districts enable row level security;
alter table public.grid_territories enable row level security;
alter table public.grid_territory_edges enable row level security;
alter table public.grid_properties enable row level security;
alter table public.grid_landmarks enable row level security;
alter table public.grid_player_profiles enable row level security;
alter table public.grid_player_season_state enable row level security;
alter table public.grid_game_events enable row level security;

revoke insert, update, delete on public.grid_cities from anon, authenticated;
revoke insert, update, delete on public.grid_seasons from anon, authenticated;
revoke insert, update, delete on public.grid_districts from anon, authenticated;
revoke insert, update, delete on public.grid_territories from anon, authenticated;
revoke insert, update, delete on public.grid_territory_edges from anon, authenticated;
revoke insert, update, delete on public.grid_properties from anon, authenticated;
revoke insert, update, delete on public.grid_landmarks from anon, authenticated;
revoke insert, update, delete on public.grid_player_profiles from anon, authenticated;
revoke insert, update, delete on public.grid_player_season_state from anon, authenticated;
revoke insert, update, delete on public.grid_game_events from anon, authenticated;
