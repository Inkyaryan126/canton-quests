-- GRID NPC 7: persistent PvE stronghold contests.
-- NPC defenders remain faction/stronghold identities, never synthetic players.
-- Attacker Influence is escrowed exactly like PvP contest commitments.

create table public.grid_pve_stronghold_contests (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  stronghold_id text not null check (btrim(stronghold_id) <> ''),
  faction_id text not null check (btrim(faction_id) <> ''),
  source_territory_id uuid not null,
  target_territory_id uuid not null,
  attacker_player_id uuid not null references public.players(id) on delete restrict,
  objective_kind text not null check (objective_kind in ('pve-territory', 'pve-landmark')),
  landmark_slug text,
  attacker_committed_influence integer not null check (attacker_committed_influence > 0),
  garrison_committed_influence integer not null check (garrison_committed_influence > 0),
  attacker_remaining_influence integer not null check (attacker_remaining_influence >= 0),
  garrison_remaining_influence integer not null check (garrison_remaining_influence >= 0),
  round_number integer not null default 0 check (round_number >= 0),
  status text not null default 'active'
    check (status in ('active', 'captured', 'repelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (source_territory_id, city_id)
    references public.grid_territories(id, city_id) on delete restrict,
  foreign key (target_territory_id, city_id)
    references public.grid_territories(id, city_id) on delete restrict,
  check (source_territory_id <> target_territory_id),
  check (attacker_remaining_influence <= attacker_committed_influence),
  check (garrison_remaining_influence <= garrison_committed_influence),
  check (
    (objective_kind = 'pve-landmark' and landmark_slug is not null and btrim(landmark_slug) <> '')
    or (objective_kind = 'pve-territory' and landmark_slug is null)
  ),
  check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index grid_pve_stronghold_contests_active_target_uq
  on public.grid_pve_stronghold_contests (season_id, target_territory_id)
  where status = 'active';

create unique index grid_pve_stronghold_contests_active_stronghold_uq
  on public.grid_pve_stronghold_contests (season_id, stronghold_id)
  where status = 'active';

create index grid_pve_stronghold_contests_attacker_idx
  on public.grid_pve_stronghold_contests (season_id, attacker_player_id, started_at desc);

alter table public.grid_pve_stronghold_contests enable row level security;
revoke insert, update, delete on public.grid_pve_stronghold_contests from anon, authenticated;

-- PvP and PvE live in separate tables, but a target may only have one active
-- contest of either kind. The shared advisory lock closes the cross-table race.
create or replace function public.grid_guard_contest_target_exclusivity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.season_id::text || ':' || new.target_territory_id::text,
      0
    )
  );

  if tg_table_name = 'grid_contests' then
    if exists (
      select 1
        from public.grid_pve_stronghold_contests pve
       where pve.season_id = new.season_id
         and pve.target_territory_id = new.target_territory_id
         and pve.status = 'active'
    ) then
      raise exception 'TARGET_ALREADY_PVE_CONTESTED';
    end if;
  elsif tg_table_name = 'grid_pve_stronghold_contests' then
    if exists (
      select 1
        from public.grid_contests pvp
       where pvp.season_id = new.season_id
         and pvp.target_territory_id = new.target_territory_id
         and pvp.status = 'active'
    ) then
      raise exception 'TARGET_ALREADY_PVP_CONTESTED';
    end if;
  else
    raise exception 'GRID_CONTEST_TARGET_GUARD_UNKNOWN_TABLE';
  end if;

  return new;
end;
$$;

create trigger grid_contests_cross_mode_target_guard
before insert or update of season_id, target_territory_id, status
on public.grid_contests
for each row execute function public.grid_guard_contest_target_exclusivity();

create trigger grid_pve_stronghold_contests_cross_mode_target_guard
before insert or update of season_id, target_territory_id, status
on public.grid_pve_stronghold_contests
for each row execute function public.grid_guard_contest_target_exclusivity();

create or replace function public.grid_start_pve_stronghold_contest(
  p_season_id uuid,
  p_city_id uuid,
  p_stronghold_id text,
  p_faction_id text,
  p_attacker_player_id uuid,
  p_source_territory_id uuid,
  p_target_territory_id uuid,
  p_objective_kind text,
  p_landmark_slug text,
  p_attacker_committed_influence integer,
  p_garrison_committed_influence integer,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_source public.grid_territories%rowtype;
  v_target public.grid_territories%rowtype;
  v_source_state public.grid_season_territory_state%rowtype;
  v_target_state public.grid_season_territory_state%rowtype;
  v_attacker_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_contest_config jsonb;
  v_attacker_dice integer;
  v_garrison_dice integer;
  v_contest_id uuid;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;
  if p_stronghold_id is null or btrim(p_stronghold_id) = '' then
    raise exception 'PVE_STRONGHOLD_ID_REQUIRED';
  end if;
  if p_faction_id is null or btrim(p_faction_id) = '' then
    raise exception 'PVE_FACTION_ID_REQUIRED';
  end if;
  if p_source_territory_id = p_target_territory_id then
    raise exception 'PVE_CONTEST_TERRITORIES_MUST_DIFFER';
  end if;
  if p_attacker_committed_influence <= 0 or p_garrison_committed_influence <= 0 then
    raise exception 'PVE_CONTEST_COMMITMENT_INVALID';
  end if;
  if p_objective_kind not in ('pve-territory', 'pve-landmark') then
    raise exception 'PVE_OBJECTIVE_KIND_INVALID';
  end if;
  if p_objective_kind = 'pve-landmark'
     and (p_landmark_slug is null or btrim(p_landmark_slug) = '') then
    raise exception 'PVE_LANDMARK_REQUIRED';
  end if;
  if p_objective_kind = 'pve-territory' and p_landmark_slug is not null then
    raise exception 'PVE_TERRITORY_OBJECTIVE_CANNOT_HAVE_LANDMARK';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:pve_stronghold_contest_started'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.payload ->> 'strongholdId' is distinct from p_stronghold_id
       or (v_existing_event.payload ->> 'sourceTerritoryId')::uuid is distinct from p_source_territory_id
       or (v_existing_event.payload ->> 'targetTerritoryId')::uuid is distinct from p_target_territory_id
       or (v_existing_event.payload ->> 'attackerCommittedInfluence')::integer is distinct from p_attacker_committed_influence
       or (v_existing_event.payload ->> 'garrisonCommittedInfluence')::integer is distinct from p_garrison_committed_influence then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', v_existing_event.entity_id,
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'strongholdId', v_existing_event.payload ->> 'strongholdId',
      'factionId', v_existing_event.payload ->> 'factionId',
      'attackerPlayerId', p_attacker_player_id,
      'sourceTerritoryId', (v_existing_event.payload ->> 'sourceTerritoryId')::uuid,
      'targetTerritoryId', (v_existing_event.payload ->> 'targetTerritoryId')::uuid,
      'status', 'active',
      'attackerCommittedInfluence', (v_existing_event.payload ->> 'attackerCommittedInfluence')::integer,
      'garrisonCommittedInfluence', (v_existing_event.payload ->> 'garrisonCommittedInfluence')::integer,
      'startedAt', v_existing_event.created_at,
      'eventId', v_existing_event.id
    );
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.city_id is distinct from p_city_id then
    raise exception 'PVE_CONTEST_CITY_MISMATCH';
  end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;

  v_contest_config := v_season.config -> 'contest';
  if jsonb_typeof(v_contest_config) <> 'object'
     or jsonb_typeof(v_contest_config -> 'attacker' -> 'bands') <> 'array'
     or jsonb_typeof(v_contest_config -> 'defender' -> 'bands') <> 'array' then
    raise exception 'CONTEST_NOT_CONFIGURED';
  end if;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_dice
    from jsonb_array_elements(v_contest_config -> 'attacker' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_attacker_committed_influence;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_garrison_dice
    from jsonb_array_elements(v_contest_config -> 'defender' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_garrison_committed_influence;

  v_attacker_dice := least(
    v_attacker_dice,
    case when coalesce(v_contest_config #>> '{attacker,maxDice}', '') ~ '^[1-9][0-9]*$'
      then (v_contest_config #>> '{attacker,maxDice}')::integer else 0 end
  );
  v_garrison_dice := least(
    v_garrison_dice,
    case when coalesce(v_contest_config #>> '{defender,maxDice}', '') ~ '^[1-9][0-9]*$'
      then (v_contest_config #>> '{defender,maxDice}')::integer else 0 end
  );
  if v_attacker_dice <= 0 or v_garrison_dice <= 0 then
    raise exception 'PVE_CONTEST_COMMITMENT_BELOW_DICE_THRESHOLD';
  end if;

  select * into v_source
    from public.grid_territories
   where id = p_source_territory_id;
  if not found then raise exception 'SOURCE_TERRITORY_NOT_FOUND'; end if;
  select * into v_target
    from public.grid_territories
   where id = p_target_territory_id;
  if not found then raise exception 'TARGET_TERRITORY_NOT_FOUND'; end if;
  if v_source.city_id <> p_city_id or v_target.city_id <> p_city_id then
    raise exception 'PVE_CONTEST_TERRITORY_WRONG_CITY';
  end if;
  if not exists (
    select 1 from public.grid_territory_edges e
     where e.city_id = p_city_id
       and (
         (e.territory_a_id = p_source_territory_id and e.territory_b_id = p_target_territory_id)
         or (e.territory_b_id = p_source_territory_id and e.territory_a_id = p_target_territory_id)
       )
  ) then
    raise exception 'PVE_CONTEST_TERRITORIES_NOT_ADJACENT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_season_id::text || ':' || p_target_territory_id::text, 0)
  );
  perform 1 from public.grid_season_territory_state
   where season_id = p_season_id
     and territory_id in (p_source_territory_id, p_target_territory_id)
   order by territory_id
   for update;

  select * into v_source_state
    from public.grid_season_territory_state
   where season_id = p_season_id and territory_id = p_source_territory_id;
  if not found or v_source_state.owner_player_id is distinct from p_attacker_player_id then
    raise exception 'SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER';
  end if;
  select * into v_target_state
    from public.grid_season_territory_state
   where season_id = p_season_id and territory_id = p_target_territory_id;
  if not found or v_target_state.owner_player_id is not null then
    raise exception 'PVE_TARGET_MUST_BE_NEUTRAL';
  end if;

  if exists (
    select 1 from public.grid_contests
     where season_id = p_season_id
       and target_territory_id = p_target_territory_id
       and status = 'active'
  ) or exists (
    select 1 from public.grid_pve_stronghold_contests
     where season_id = p_season_id
       and target_territory_id = p_target_territory_id
       and status = 'active'
  ) then
    raise exception 'TARGET_ALREADY_CONTESTED';
  end if;

  perform public.grid_settle_player_resources(
    p_season_id,
    p_attacker_player_id,
    'prepve-start:a:' || p_idempotency_key,
    p_now
  );
  select * into v_attacker_state
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_attacker_player_id
   for update;
  if not found then raise exception 'ATTACKER_NOT_JOINED'; end if;
  if v_attacker_state.influence < p_attacker_committed_influence then
    raise exception 'ATTACKER_INSUFFICIENT_INFLUENCE';
  end if;

  update public.grid_player_season_state
     set influence = influence - p_attacker_committed_influence,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_attacker_state.id;

  insert into public.grid_pve_stronghold_contests (
    season_id, city_id, stronghold_id, faction_id,
    source_territory_id, target_territory_id, attacker_player_id,
    objective_kind, landmark_slug,
    attacker_committed_influence, garrison_committed_influence,
    attacker_remaining_influence, garrison_remaining_influence,
    status, started_at, created_at, updated_at
  ) values (
    p_season_id, p_city_id, p_stronghold_id, p_faction_id,
    p_source_territory_id, p_target_territory_id, p_attacker_player_id,
    p_objective_kind, p_landmark_slug,
    p_attacker_committed_influence, p_garrison_committed_influence,
    p_attacker_committed_influence, p_garrison_committed_influence,
    'active', p_now, p_now, p_now
  ) returning id into v_contest_id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    p_city_id, p_season_id, p_attacker_player_id,
    'grid:pve_stronghold_contest_started', 'pve_stronghold_contest', v_contest_id,
    jsonb_build_object(
      'strongholdId', p_stronghold_id,
      'factionId', p_faction_id,
      'sourceTerritoryId', p_source_territory_id,
      'targetTerritoryId', p_target_territory_id,
      'objectiveKind', p_objective_kind,
      'landmarkSlug', p_landmark_slug,
      'attackerCommittedInfluence', p_attacker_committed_influence,
      'garrisonCommittedInfluence', p_garrison_committed_influence
    ),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'contestId', v_contest_id,
    'seasonId', p_season_id,
    'cityId', p_city_id,
    'strongholdId', p_stronghold_id,
    'factionId', p_faction_id,
    'attackerPlayerId', p_attacker_player_id,
    'sourceTerritoryId', p_source_territory_id,
    'targetTerritoryId', p_target_territory_id,
    'status', 'active',
    'attackerCommittedInfluence', p_attacker_committed_influence,
    'garrisonCommittedInfluence', p_garrison_committed_influence,
    'startedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_resolve_pve_stronghold_round(
  p_contest_id uuid,
  p_attacker_player_id uuid,
  p_attacker_rolls integer[],
  p_garrison_rolls integer[],
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contest public.grid_pve_stronghold_contests%rowtype;
  v_season public.grid_seasons%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_contest_config jsonb;
  v_die_sides integer;
  v_loss integer;
  v_attacker_dice integer;
  v_garrison_dice integer;
  v_attacker_post_dice integer;
  v_garrison_post_dice integer;
  v_attacker_sorted integer[];
  v_garrison_sorted integer[];
  v_index integer;
  v_attacker_roll integer;
  v_garrison_roll integer;
  v_attacker_loss integer := 0;
  v_garrison_loss integer := 0;
  v_attacker_remaining integer;
  v_garrison_remaining integer;
  v_attacker_refund integer := 0;
  v_round_number integer;
  v_status text := 'active';
  v_comparisons jsonb := '[]'::jsonb;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then raise exception 'COMMAND_TIME_REQUIRED'; end if;

  select * into v_contest
    from public.grid_pve_stronghold_contests
   where id = p_contest_id
   for update;
  if not found then raise exception 'PVE_CONTEST_NOT_FOUND'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = v_contest.season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:pve_stronghold_round_resolved'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.entity_id is distinct from p_contest_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', p_contest_id,
      'seasonId', v_contest.season_id,
      'cityId', v_contest.city_id,
      'strongholdId', v_contest.stronghold_id,
      'roundNumber', (v_existing_event.payload ->> 'roundNumber')::integer,
      'status', v_existing_event.payload ->> 'status',
      'attackerRolls', v_existing_event.payload -> 'attackerRolls',
      'garrisonRolls', v_existing_event.payload -> 'garrisonRolls',
      'attackerInfluenceLost', (v_existing_event.payload ->> 'attackerInfluenceLost')::integer,
      'garrisonInfluenceLost', (v_existing_event.payload ->> 'garrisonInfluenceLost')::integer,
      'attackerRemainingInfluence', (v_existing_event.payload ->> 'attackerRemainingInfluence')::integer,
      'garrisonRemainingInfluence', (v_existing_event.payload ->> 'garrisonRemainingInfluence')::integer,
      'attackerRefundedInfluence', (v_existing_event.payload ->> 'attackerRefundedInfluence')::integer,
      'territoryCaptured', (v_existing_event.payload ->> 'territoryCaptured')::boolean,
      'eventId', v_existing_event.id
    );
  end if;

  if v_contest.status <> 'active' then raise exception 'PVE_CONTEST_NOT_ACTIVE'; end if;
  if v_contest.attacker_player_id is distinct from p_attacker_player_id then
    raise exception 'PVE_CONTEST_ROUND_NOT_ATTACKER';
  end if;

  select * into v_season
    from public.grid_seasons
   where id = v_contest.season_id
   for update;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;

  v_contest_config := v_season.config -> 'contest';
  if jsonb_typeof(v_contest_config) <> 'object'
     or coalesce(v_contest_config ->> 'dieSides', '') !~ '^[2-9][0-9]*$'
     or coalesce(v_contest_config ->> 'influenceLossPerComparison', '') !~ '^[1-9][0-9]*$'
     or coalesce(v_contest_config ->> 'tiesFavorDefender', '') <> 'true'
     or jsonb_typeof(v_contest_config -> 'attacker' -> 'bands') <> 'array'
     or jsonb_typeof(v_contest_config -> 'defender' -> 'bands') <> 'array' then
    raise exception 'CONTEST_NOT_CONFIGURED';
  end if;
  v_die_sides := (v_contest_config ->> 'dieSides')::integer;
  v_loss := (v_contest_config ->> 'influenceLossPerComparison')::integer;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_dice
    from jsonb_array_elements(v_contest_config -> 'attacker' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_contest.attacker_remaining_influence;
  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_garrison_dice
    from jsonb_array_elements(v_contest_config -> 'defender' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_contest.garrison_remaining_influence;
  v_attacker_dice := least(v_attacker_dice, (v_contest_config #>> '{attacker,maxDice}')::integer);
  v_garrison_dice := least(v_garrison_dice, (v_contest_config #>> '{defender,maxDice}')::integer);
  if v_attacker_dice <= 0 then raise exception 'PVE_ATTACKER_CANNOT_CONTINUE'; end if;
  if v_garrison_dice <= 0 then raise exception 'PVE_GARRISON_CANNOT_CONTINUE'; end if;
  if cardinality(p_attacker_rolls) <> v_attacker_dice
     or cardinality(p_garrison_rolls) <> v_garrison_dice then
    raise exception 'PVE_CONTEST_DICE_COUNT_INVALID';
  end if;
  if exists (
    select 1 from unnest(p_attacker_rolls) roll where roll < 1 or roll > v_die_sides
  ) or exists (
    select 1 from unnest(p_garrison_rolls) roll where roll < 1 or roll > v_die_sides
  ) then
    raise exception 'PVE_CONTEST_DIE_RESULT_INVALID';
  end if;

  select array_agg(roll order by roll desc) into v_attacker_sorted
    from unnest(p_attacker_rolls) roll;
  select array_agg(roll order by roll desc) into v_garrison_sorted
    from unnest(p_garrison_rolls) roll;

  for v_index in 1..least(cardinality(v_attacker_sorted), cardinality(v_garrison_sorted)) loop
    v_attacker_roll := v_attacker_sorted[v_index];
    v_garrison_roll := v_garrison_sorted[v_index];
    if v_attacker_roll > v_garrison_roll then
      v_garrison_loss := v_garrison_loss + v_loss;
      v_comparisons := v_comparisons || jsonb_build_array(jsonb_build_object(
        'attackerRoll', v_attacker_roll,
        'defenderRoll', v_garrison_roll,
        'winner', 'attacker'
      ));
    else
      v_attacker_loss := v_attacker_loss + v_loss;
      v_comparisons := v_comparisons || jsonb_build_array(jsonb_build_object(
        'attackerRoll', v_attacker_roll,
        'defenderRoll', v_garrison_roll,
        'winner', 'defender'
      ));
    end if;
  end loop;

  v_attacker_loss := least(v_attacker_loss, v_contest.attacker_remaining_influence);
  v_garrison_loss := least(v_garrison_loss, v_contest.garrison_remaining_influence);
  v_attacker_remaining := v_contest.attacker_remaining_influence - v_attacker_loss;
  v_garrison_remaining := v_contest.garrison_remaining_influence - v_garrison_loss;
  v_round_number := v_contest.round_number + 1;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_post_dice
    from jsonb_array_elements(v_contest_config -> 'attacker' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_attacker_remaining;
  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_garrison_post_dice
    from jsonb_array_elements(v_contest_config -> 'defender' -> 'bands') band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= v_garrison_remaining;

  -- Defender advantage: attacker inability is evaluated first.
  if v_attacker_remaining <= 0 or v_attacker_post_dice <= 0 then
    v_status := 'repelled';
  elsif v_garrison_remaining <= 0 or v_garrison_post_dice <= 0 then
    v_status := 'captured';
  end if;

  if v_status = 'active' then
    update public.grid_pve_stronghold_contests
       set attacker_remaining_influence = v_attacker_remaining,
           garrison_remaining_influence = v_garrison_remaining,
           round_number = v_round_number,
           updated_at = p_now
     where id = p_contest_id;
  else
    v_attacker_refund := v_attacker_remaining;
    select 1 from public.grid_player_season_state
     where season_id = v_contest.season_id
       and player_id = v_contest.attacker_player_id
     for update;
    if not found then raise exception 'ATTACKER_NOT_JOINED'; end if;

    update public.grid_player_season_state
       set influence = influence + v_attacker_refund,
           last_active_at = p_now,
           updated_at = p_now
     where season_id = v_contest.season_id
       and player_id = v_contest.attacker_player_id;

    if v_status = 'captured' then
      update public.grid_season_territory_state
         set owner_player_id = v_contest.attacker_player_id,
             claimed_at = p_now,
             updated_at = p_now
       where season_id = v_contest.season_id
         and territory_id = v_contest.target_territory_id
         and owner_player_id is null;
      if not found then raise exception 'PVE_CONTEST_TARGET_OWNERSHIP_CHANGED'; end if;
    end if;

    update public.grid_pve_stronghold_contests
       set attacker_remaining_influence = v_attacker_remaining,
           garrison_remaining_influence = v_garrison_remaining,
           round_number = v_round_number,
           status = v_status,
           ended_at = p_now,
           updated_at = p_now
     where id = p_contest_id;
  end if;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_contest.city_id, v_contest.season_id, p_attacker_player_id,
    'grid:pve_stronghold_round_resolved', 'pve_stronghold_contest', p_contest_id,
    jsonb_build_object(
      'strongholdId', v_contest.stronghold_id,
      'roundNumber', v_round_number,
      'status', v_status,
      'attackerRolls', to_jsonb(p_attacker_rolls),
      'garrisonRolls', to_jsonb(p_garrison_rolls),
      'comparisons', v_comparisons,
      'attackerInfluenceLost', v_attacker_loss,
      'garrisonInfluenceLost', v_garrison_loss,
      'attackerRemainingInfluence', v_attacker_remaining,
      'garrisonRemainingInfluence', v_garrison_remaining,
      'attackerRefundedInfluence', v_attacker_refund,
      'territoryCaptured', v_status = 'captured',
      'targetTerritoryId', v_contest.target_territory_id
    ),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'contestId', p_contest_id,
    'seasonId', v_contest.season_id,
    'cityId', v_contest.city_id,
    'strongholdId', v_contest.stronghold_id,
    'roundNumber', v_round_number,
    'status', v_status,
    'attackerRolls', to_jsonb(p_attacker_rolls),
    'garrisonRolls', to_jsonb(p_garrison_rolls),
    'attackerInfluenceLost', v_attacker_loss,
    'garrisonInfluenceLost', v_garrison_loss,
    'attackerRemainingInfluence', v_attacker_remaining,
    'garrisonRemainingInfluence', v_garrison_remaining,
    'attackerRefundedInfluence', v_attacker_refund,
    'territoryCaptured', v_status = 'captured',
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_start_pve_stronghold_contest(
  uuid, uuid, text, text, uuid, uuid, uuid, text, text, integer, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_start_pve_stronghold_contest(
  uuid, uuid, text, text, uuid, uuid, uuid, text, text, integer, integer, text, timestamptz
) to service_role;

revoke all on function public.grid_resolve_pve_stronghold_round(
  uuid, uuid, integer[], integer[], text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_resolve_pve_stronghold_round(
  uuid, uuid, integer[], integer[], text, timestamptz
) to service_role;
