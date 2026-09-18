-- GRID progression projection rebuild guards.
-- Projections are derived from the immutable game event ledger and may be rebuilt.

alter table public.grid_player_season_progression
  add column if not exists source_event_count bigint not null default 0 check (source_event_count >= 0),
  add column if not exists source_event_fingerprint text,
  add column if not exists policy_fingerprint text,
  add column if not exists source_last_event_at timestamptz;

alter table public.grid_player_lifetime_progression
  add column if not exists source_event_count bigint not null default 0 check (source_event_count >= 0),
  add column if not exists source_event_fingerprint text,
  add column if not exists policy_fingerprint text,
  add column if not exists source_last_event_at timestamptz;

alter table public.grid_player_season_progression
  add constraint grid_player_season_progression_event_fingerprint_chk
  check (source_event_fingerprint is null or source_event_fingerprint ~ '^[0-9a-f]{64}$'),
  add constraint grid_player_season_progression_policy_fingerprint_chk
  check (policy_fingerprint is null or policy_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.grid_player_lifetime_progression
  add constraint grid_player_lifetime_progression_event_fingerprint_chk
  check (source_event_fingerprint is null or source_event_fingerprint ~ '^[0-9a-f]{64}$'),
  add constraint grid_player_lifetime_progression_policy_fingerprint_chk
  check (policy_fingerprint is null or policy_fingerprint ~ '^[0-9a-f]{64}$');

create or replace function public.grid_replace_season_progression_projection(
  p_season_id uuid,
  p_player_id uuid,
  p_source_event_count bigint,
  p_source_event_fingerprint text,
  p_policy_fingerprint text,
  p_source_last_event_at timestamptz,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_event_count bigint;
  v_existing_event_fingerprint text;
  v_total_xp bigint;
  v_level integer;
  v_grid_rating integer;
  v_version integer;
  v_primary_title text;
begin
  if p_source_event_count < 0
     or p_source_event_fingerprint !~ '^[0-9a-f]{64}$'
     or p_policy_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'PROGRESSION_SOURCE_INVALID';
  end if;

  if jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_snapshot -> 'stats') <> 'object'
     or jsonb_typeof(p_snapshot -> 'categoryScores') <> 'object'
     or jsonb_typeof(p_snapshot -> 'titles') <> 'array'
     or coalesce(p_snapshot ->> 'totalXp', '') !~ '^[0-9]+$'
     or coalesce(p_snapshot ->> 'level', '') !~ '^[1-9][0-9]*$'
     or coalesce(p_snapshot ->> 'gridRating', '') !~ '^[0-9]+$'
     or coalesce(p_snapshot ->> 'version', '') !~ '^[1-9][0-9]*$' then
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  v_total_xp := (p_snapshot ->> 'totalXp')::bigint;
  v_level := (p_snapshot ->> 'level')::integer;
  v_grid_rating := (p_snapshot ->> 'gridRating')::integer;
  v_version := (p_snapshot ->> 'version')::integer;
  if v_grid_rating not between 0 and 10000 then
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  if p_snapshot -> 'primaryTitle' is null or jsonb_typeof(p_snapshot -> 'primaryTitle') = 'null' then
    v_primary_title := null;
  elsif jsonb_typeof(p_snapshot -> 'primaryTitle') = 'string' then
    v_primary_title := p_snapshot ->> 'primaryTitle';
  else
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  select source_event_count, source_event_fingerprint
    into v_existing_event_count, v_existing_event_fingerprint
    from public.grid_player_season_progression
   where season_id = p_season_id
     and player_id = p_player_id
   for update;

  if found then
    if v_existing_event_count > p_source_event_count then
      return jsonb_build_object('applied', false);
    end if;
    if v_existing_event_count = p_source_event_count
       and v_existing_event_fingerprint is not null
       and v_existing_event_fingerprint <> p_source_event_fingerprint then
      raise exception 'PROGRESSION_PROJECTION_DIVERGENCE';
    end if;
  end if;

  insert into public.grid_player_season_progression (
    season_id,
    player_id,
    total_xp,
    level,
    grid_rating,
    stats,
    category_scores,
    titles,
    primary_title,
    version,
    source_event_count,
    source_event_fingerprint,
    policy_fingerprint,
    source_last_event_at,
    updated_at
  ) values (
    p_season_id,
    p_player_id,
    v_total_xp,
    v_level,
    v_grid_rating,
    p_snapshot -> 'stats',
    p_snapshot -> 'categoryScores',
    array(select jsonb_array_elements_text(p_snapshot -> 'titles')),
    v_primary_title,
    v_version,
    p_source_event_count,
    p_source_event_fingerprint,
    p_policy_fingerprint,
    p_source_last_event_at,
    now()
  )
  on conflict (season_id, player_id) do update
    set total_xp = excluded.total_xp,
        level = excluded.level,
        grid_rating = excluded.grid_rating,
        stats = excluded.stats,
        category_scores = excluded.category_scores,
        titles = excluded.titles,
        primary_title = excluded.primary_title,
        version = excluded.version,
        source_event_count = excluded.source_event_count,
        source_event_fingerprint = excluded.source_event_fingerprint,
        policy_fingerprint = excluded.policy_fingerprint,
        source_last_event_at = excluded.source_last_event_at,
        updated_at = excluded.updated_at;

  return jsonb_build_object('applied', true);
end;
$$;

create or replace function public.grid_replace_lifetime_progression_projection(
  p_player_id uuid,
  p_source_event_count bigint,
  p_source_event_fingerprint text,
  p_policy_fingerprint text,
  p_source_last_event_at timestamptz,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_event_count bigint;
  v_existing_event_fingerprint text;
  v_total_xp bigint;
  v_level integer;
  v_grid_rating integer;
  v_version integer;
  v_primary_title text;
begin
  if p_source_event_count < 0
     or p_source_event_fingerprint !~ '^[0-9a-f]{64}$'
     or p_policy_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'PROGRESSION_SOURCE_INVALID';
  end if;

  if jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_snapshot -> 'stats') <> 'object'
     or jsonb_typeof(p_snapshot -> 'categoryScores') <> 'object'
     or jsonb_typeof(p_snapshot -> 'titles') <> 'array'
     or coalesce(p_snapshot ->> 'totalXp', '') !~ '^[0-9]+$'
     or coalesce(p_snapshot ->> 'level', '') !~ '^[1-9][0-9]*$'
     or coalesce(p_snapshot ->> 'gridRating', '') !~ '^[0-9]+$'
     or coalesce(p_snapshot ->> 'version', '') !~ '^[1-9][0-9]*$' then
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  v_total_xp := (p_snapshot ->> 'totalXp')::bigint;
  v_level := (p_snapshot ->> 'level')::integer;
  v_grid_rating := (p_snapshot ->> 'gridRating')::integer;
  v_version := (p_snapshot ->> 'version')::integer;
  if v_grid_rating not between 0 and 10000 then
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  if p_snapshot -> 'primaryTitle' is null or jsonb_typeof(p_snapshot -> 'primaryTitle') = 'null' then
    v_primary_title := null;
  elsif jsonb_typeof(p_snapshot -> 'primaryTitle') = 'string' then
    v_primary_title := p_snapshot ->> 'primaryTitle';
  else
    raise exception 'PROGRESSION_SNAPSHOT_INVALID';
  end if;

  select source_event_count, source_event_fingerprint
    into v_existing_event_count, v_existing_event_fingerprint
    from public.grid_player_lifetime_progression
   where player_id = p_player_id
   for update;

  if found then
    if v_existing_event_count > p_source_event_count then
      return jsonb_build_object('applied', false);
    end if;
    if v_existing_event_count = p_source_event_count
       and v_existing_event_fingerprint is not null
       and v_existing_event_fingerprint <> p_source_event_fingerprint then
      raise exception 'PROGRESSION_PROJECTION_DIVERGENCE';
    end if;
  end if;

  insert into public.grid_player_lifetime_progression (
    player_id,
    total_xp,
    level,
    grid_rating,
    stats,
    category_scores,
    titles,
    primary_title,
    version,
    source_event_count,
    source_event_fingerprint,
    policy_fingerprint,
    source_last_event_at,
    updated_at
  ) values (
    p_player_id,
    v_total_xp,
    v_level,
    v_grid_rating,
    p_snapshot -> 'stats',
    p_snapshot -> 'categoryScores',
    array(select jsonb_array_elements_text(p_snapshot -> 'titles')),
    v_primary_title,
    v_version,
    p_source_event_count,
    p_source_event_fingerprint,
    p_policy_fingerprint,
    p_source_last_event_at,
    now()
  )
  on conflict (player_id) do update
    set total_xp = excluded.total_xp,
        level = excluded.level,
        grid_rating = excluded.grid_rating,
        stats = excluded.stats,
        category_scores = excluded.category_scores,
        titles = excluded.titles,
        primary_title = excluded.primary_title,
        version = excluded.version,
        source_event_count = excluded.source_event_count,
        source_event_fingerprint = excluded.source_event_fingerprint,
        policy_fingerprint = excluded.policy_fingerprint,
        source_last_event_at = excluded.source_last_event_at,
        updated_at = excluded.updated_at;

  return jsonb_build_object('applied', true);
end;
$$;

revoke all on function public.grid_replace_season_progression_projection(
  uuid, uuid, bigint, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.grid_replace_season_progression_projection(
  uuid, uuid, bigint, text, text, timestamptz, jsonb
) to service_role;

revoke all on function public.grid_replace_lifetime_progression_projection(
  uuid, bigint, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.grid_replace_lifetime_progression_projection(
  uuid, bigint, text, text, timestamptz, jsonb
) to service_role;
