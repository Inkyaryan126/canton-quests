create table public.grid_alliances (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  slug text not null,
  name text not null,
  leader_player_id uuid not null references public.players(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'disbanded')),
  influence_pool integer not null default 0
    check (influence_pool >= 0),
  revision integer not null default 0
    check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disbanded_at timestamptz,
  unique (season_id, slug),
  unique (id, season_id),
  check (
    (status = 'active' and disbanded_at is null)
    or (status = 'disbanded' and disbanded_at is not null)
  )
);

create table public.grid_alliance_memberships (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  alliance_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  joined_at timestamptz not null,
  left_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  foreign key (alliance_id, season_id)
    references public.grid_alliances(id, season_id) on delete cascade,
  check (
    (left_at is null and cooldown_until is null)
    or (
      left_at is not null
      and cooldown_until is not null
      and cooldown_until >= left_at
    )
  )
);

create unique index grid_alliance_memberships_active_player_season_uq
  on public.grid_alliance_memberships (season_id, player_id)
  where left_at is null;

create index grid_alliances_season_status_idx
  on public.grid_alliances (season_id, status);

create index grid_alliance_memberships_alliance_active_idx
  on public.grid_alliance_memberships (alliance_id, joined_at)
  where left_at is null;

create index grid_alliance_memberships_player_history_idx
  on public.grid_alliance_memberships (season_id, player_id, joined_at desc);

alter table public.grid_alliances enable row level security;
alter table public.grid_alliance_memberships enable row level security;

revoke all on public.grid_alliances from public, anon, authenticated;
revoke all on public.grid_alliance_memberships from public, anon, authenticated;

create or replace function public.grid_create_alliance(
  p_alliance_id uuid,
  p_season_id uuid,
  p_leader_player_id uuid,
  p_slug text,
  p_name text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alliance public.grid_alliances%rowtype;
  v_membership public.grid_alliance_memberships%rowtype;
begin
  if nullif(btrim(p_slug), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'GRID_ALLIANCE_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  insert into public.grid_alliances (
    id, season_id, slug, name, leader_player_id, created_at, updated_at
  ) values (
    p_alliance_id, p_season_id, lower(btrim(p_slug)), btrim(p_name),
    p_leader_player_id, p_now, p_now
  ) returning * into v_alliance;

  insert into public.grid_alliance_memberships (
    season_id, alliance_id, player_id, joined_at
  ) values (
    p_season_id, p_alliance_id, p_leader_player_id, p_now
  ) returning * into v_membership;

  return jsonb_build_object(
    'alliance', jsonb_build_object(
      'allianceId', v_alliance.id,
      'seasonId', v_alliance.season_id,
      'slug', v_alliance.slug,
      'name', v_alliance.name,
      'leaderPlayerId', v_alliance.leader_player_id,
      'status', v_alliance.status,
      'influencePool', v_alliance.influence_pool,
      'revision', v_alliance.revision,
      'createdAt', v_alliance.created_at,
      'updatedAt', v_alliance.updated_at,
      'disbandedAt', v_alliance.disbanded_at
    ),
    'membership', jsonb_build_object(
      'playerId', v_membership.player_id,
      'seasonId', v_membership.season_id,
      'allianceId', v_membership.alliance_id,
      'joinedAt', v_membership.joined_at,
      'leftAt', v_membership.left_at,
      'cooldownUntil', v_membership.cooldown_until
    )
  );
end;
$$;

create or replace function public.grid_join_alliance(
  p_alliance_id uuid,
  p_season_id uuid,
  p_player_id uuid,
  p_joined_at timestamptz,
  p_max_members integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alliance public.grid_alliances%rowtype;
  v_membership public.grid_alliance_memberships%rowtype;
  v_active_count integer;
  v_cooldown_until timestamptz;
begin
  if p_max_members is null or p_max_members <= 0 then
    raise exception 'GRID_ALLIANCE_MAX_MEMBERS_INVALID' using errcode = '22023';
  end if;

  select * into v_alliance
  from public.grid_alliances
  where id = p_alliance_id
    and season_id = p_season_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'GRID_ALLIANCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.grid_alliance_memberships
    where season_id = p_season_id
      and player_id = p_player_id
      and left_at is null
  ) then
    raise exception 'GRID_ALLIANCE_ALREADY_ACTIVE' using errcode = '23505';
  end if;

  select max(cooldown_until) into v_cooldown_until
  from public.grid_alliance_memberships
  where season_id = p_season_id
    and player_id = p_player_id
    and left_at is not null;

  if v_cooldown_until is not null and p_joined_at < v_cooldown_until then
    raise exception 'GRID_ALLIANCE_COOLDOWN_ACTIVE' using errcode = '23514';
  end if;

  select count(*)::integer into v_active_count
  from public.grid_alliance_memberships
  where alliance_id = p_alliance_id
    and left_at is null;

  if v_active_count >= p_max_members then
    raise exception 'GRID_ALLIANCE_FULL' using errcode = '23514';
  end if;

  insert into public.grid_alliance_memberships (
    season_id, alliance_id, player_id, joined_at
  ) values (
    p_season_id, p_alliance_id, p_player_id, p_joined_at
  ) returning * into v_membership;

  update public.grid_alliances
  set revision = revision + 1,
      updated_at = p_joined_at
  where id = p_alliance_id;

  return jsonb_build_object(
    'playerId', v_membership.player_id,
    'seasonId', v_membership.season_id,
    'allianceId', v_membership.alliance_id,
    'joinedAt', v_membership.joined_at,
    'leftAt', v_membership.left_at,
    'cooldownUntil', v_membership.cooldown_until
  );
end;
$$;

create or replace function public.grid_leave_alliance(
  p_alliance_id uuid,
  p_season_id uuid,
  p_player_id uuid,
  p_left_at timestamptz,
  p_cooldown_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alliance public.grid_alliances%rowtype;
  v_membership public.grid_alliance_memberships%rowtype;
begin
  select * into v_alliance
  from public.grid_alliances
  where id = p_alliance_id
    and season_id = p_season_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'GRID_ALLIANCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_alliance.leader_player_id = p_player_id then
    raise exception 'GRID_ALLIANCE_LEADER_CANNOT_LEAVE' using errcode = '23514';
  end if;

  select * into v_membership
  from public.grid_alliance_memberships
  where alliance_id = p_alliance_id
    and season_id = p_season_id
    and player_id = p_player_id
    and left_at is null
  for update;

  if not found then
    raise exception 'GRID_ALLIANCE_MEMBERSHIP_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.grid_alliance_memberships
  set left_at = p_left_at,
      cooldown_until = p_cooldown_until
  where id = v_membership.id
  returning * into v_membership;

  update public.grid_alliances
  set revision = revision + 1,
      updated_at = p_left_at
  where id = p_alliance_id;

  return jsonb_build_object(
    'playerId', v_membership.player_id,
    'seasonId', v_membership.season_id,
    'allianceId', v_membership.alliance_id,
    'joinedAt', v_membership.joined_at,
    'leftAt', v_membership.left_at,
    'cooldownUntil', v_membership.cooldown_until
  );
end;
$$;

revoke all on function public.grid_create_alliance(uuid, uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.grid_join_alliance(uuid, uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.grid_leave_alliance(uuid, uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.grid_create_alliance(uuid, uuid, uuid, text, text, timestamptz)
  to service_role;
grant execute on function public.grid_join_alliance(uuid, uuid, uuid, timestamptz, integer)
  to service_role;
grant execute on function public.grid_leave_alliance(uuid, uuid, uuid, timestamptz, timestamptz)
  to service_role;
