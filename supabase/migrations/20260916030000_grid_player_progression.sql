create table public.grid_player_season_progression (
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level > 0),
  grid_rating integer not null default 0 check (grid_rating between 0 and 10000),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  category_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(category_scores) = 'object'),
  titles text[] not null default '{}'::text[],
  primary_title text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

create table public.grid_player_lifetime_progression (
  player_id uuid primary key references public.players(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level > 0),
  grid_rating integer not null default 0 check (grid_rating between 0 and 10000),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  category_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(category_scores) = 'object'),
  titles text[] not null default '{}'::text[],
  primary_title text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grid_player_season_progression_rank_idx
  on public.grid_player_season_progression (season_id, grid_rating desc, total_xp desc);

create index grid_player_lifetime_progression_rank_idx
  on public.grid_player_lifetime_progression (grid_rating desc, total_xp desc);

alter table public.grid_player_season_progression enable row level security;
alter table public.grid_player_lifetime_progression enable row level security;

revoke insert, update, delete on public.grid_player_season_progression from anon, authenticated;
revoke insert, update, delete on public.grid_player_lifetime_progression from anon, authenticated;

comment on table public.grid_player_season_progression is
  'Derived Grid progression snapshot. XP is one input; grid_rating balances multiple gameplay categories.';

comment on column public.grid_player_season_progression.stats is
  'Canonical stat bag including mission, discovery, territory, economy, scrimmage, social, streak, and legacy metrics.';
