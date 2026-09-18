-- GRID NPC 8: data-driven stronghold registry.
-- Definitions are disabled by default; no Canton tuning is seeded here.

create table public.grid_npc_stronghold_definitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  stronghold_id text not null check (btrim(stronghold_id) <> ''),
  faction_id text not null check (btrim(faction_id) <> ''),
  territory_id uuid not null references public.grid_territories(id) on delete restrict,
  landmark_id uuid references public.grid_landmarks(id) on delete restrict,
  activation text not null check (activation in ('season', 'event', 'surge')),
  base_garrison_influence integer not null check (base_garrison_influence > 0),
  max_garrison_influence integer not null check (max_garrison_influence >= base_garrison_influence),
  pressure_reinforcement_bps integer not null default 0
    check (pressure_reinforcement_bps between 0 and 10000),
  surge_reinforcement_bps integer not null default 0
    check (surge_reinforcement_bps between 0 and 10000),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  unique (season_id, stronghold_id)
);

create unique index grid_npc_stronghold_enabled_target_uq
  on public.grid_npc_stronghold_definitions (season_id, territory_id)
  where enabled;

create index grid_npc_stronghold_registry_season_idx
  on public.grid_npc_stronghold_definitions (season_id, enabled, stronghold_id);

alter table public.grid_npc_stronghold_definitions enable row level security;
revoke insert, update, delete on public.grid_npc_stronghold_definitions from anon, authenticated;

create or replace function public.grid_validate_npc_stronghold_definition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_territory public.grid_territories%rowtype;
  v_landmark public.grid_landmarks%rowtype;
begin
  select * into v_territory
    from public.grid_territories
   where id = new.territory_id;
  if not found then raise exception 'NPC_STRONGHOLD_TERRITORY_NOT_FOUND'; end if;
  if v_territory.city_id is distinct from new.city_id then
    raise exception 'NPC_STRONGHOLD_TERRITORY_CITY_MISMATCH';
  end if;

  if new.landmark_id is not null then
    select * into v_landmark
      from public.grid_landmarks
     where id = new.landmark_id;
    if not found then raise exception 'NPC_STRONGHOLD_LANDMARK_NOT_FOUND'; end if;
    if v_landmark.city_id is distinct from new.city_id then
      raise exception 'NPC_STRONGHOLD_LANDMARK_CITY_MISMATCH';
    end if;
    if v_landmark.territory_id is distinct from new.territory_id then
      raise exception 'NPC_STRONGHOLD_LANDMARK_TERRITORY_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

create trigger grid_npc_stronghold_definition_validate
before insert or update of city_id, territory_id, landmark_id
on public.grid_npc_stronghold_definitions
for each row execute function public.grid_validate_npc_stronghold_definition();
