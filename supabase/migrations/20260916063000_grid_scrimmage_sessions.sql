-- GRID Scrimmage 3: isolated small-group session persistence.
-- Scrimmages are intentionally session-only and never mutate permanent city economy.

create table public.grid_scrimmage_sessions (
  id uuid primary key,
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  host_player_id uuid not null references public.players(id) on delete restrict,
  invite_code text not null,
  status text not null
    check (status in ('lobby', 'active', 'completed', 'cancelled')),
  progression_scope text not null default 'session-only'
    check (progression_scope = 'session-only'),
  participants jsonb not null
    check (jsonb_typeof(participants) = 'array')
    check (jsonb_array_length(participants) between 1 and 12),
  rules jsonb not null
    check (jsonb_typeof(rules) = 'object'),
  revision integer not null default 0
    check (revision >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null,
  check (
    (status = 'lobby' and started_at is null and ended_at is null)
    or (status = 'active' and started_at is not null and ended_at is null)
    or (status in ('completed', 'cancelled') and ended_at is not null)
  )
);

create unique index grid_scrimmage_active_invite_code_uq
  on public.grid_scrimmage_sessions (invite_code)
  where status in ('lobby', 'active');

create index grid_scrimmage_host_created_idx
  on public.grid_scrimmage_sessions (host_player_id, created_at desc);

create index grid_scrimmage_city_status_idx
  on public.grid_scrimmage_sessions (city_id, status, created_at desc);

alter table public.grid_scrimmage_sessions enable row level security;

revoke all on public.grid_scrimmage_sessions from public, anon, authenticated;
