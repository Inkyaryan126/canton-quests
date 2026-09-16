-- GRID Contest 3A: persistent contest sessions and reserve lifecycle.
-- Service-role commands only. Committed Influence is escrowed in the contest
-- so the same strength cannot be spent in two places at once.

create table public.grid_contests (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  source_territory_id uuid not null,
  target_territory_id uuid not null,
  attacker_player_id uuid not null references public.players(id) on delete restrict,
  defender_player_id uuid not null references public.players(id) on delete restrict,
  attacker_committed_influence integer not null check (attacker_committed_influence > 0),
  defender_committed_influence integer not null check (defender_committed_influence > 0),
  attacker_remaining_influence integer not null check (attacker_remaining_influence >= 0),
  defender_remaining_influence integer not null check (defender_remaining_influence >= 0),
  round_number integer not null default 0 check (round_number >= 0),
  status text not null default 'active'
    check (status in ('active', 'captured', 'defended', 'withdrawn', 'cancelled')),
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
  check (attacker_player_id <> defender_player_id),
  check (attacker_remaining_influence <= attacker_committed_influence),
  check (defender_remaining_influence <= defender_committed_influence),
  check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index grid_contests_active_target_uq
  on public.grid_contests (season_id, target_territory_id)
  where status = 'active';

create index grid_contests_attacker_active_idx
  on public.grid_contests (season_id, attacker_player_id, started_at desc)
  where status = 'active';

create index grid_contests_defender_active_idx
  on public.grid_contests (season_id, defender_player_id, started_at desc)
  where status = 'active';

alter table public.grid_contests enable row level security;
revoke insert, update, delete on public.grid_contests from anon, authenticated;

create or replace function public.grid_start_contest(
  p_season_id uuid,
  p_attacker_player_id uuid,
  p_defender_player_id uuid,
  p_source_territory_id uuid,
  p_target_territory_id uuid,
  p_attacker_committed_influence integer,
  p_defender_committed_influence integer,
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
  v_defender_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_contest_config jsonb;
  v_attacker_dice integer;
  v_defender_dice integer;
  v_contest_id uuid;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_attacker_player_id = p_defender_player_id then
    raise exception 'CONTEST_PLAYERS_MUST_DIFFER';
  end if;
  if p_source_territory_id = p_target_territory_id then
    raise exception 'CONTEST_TERRITORIES_MUST_DIFFER';
  end if;
  if p_attacker_committed_influence <= 0 or p_defender_committed_influence <= 0 then
    raise exception 'CONTEST_COMMITMENT_INVALID';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:contest_started'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', v_existing_event.entity_id,
      'seasonId', p_season_id,
      'cityId', v_existing_event.city_id,
      'attackerPlayerId', p_attacker_player_id,
      'defenderPlayerId', (v_existing_event.payload ->> 'defenderPlayerId')::uuid,
      'sourceTerritoryId', (v_existing_event.payload ->> 'sourceTerritoryId')::uuid,
      'targetTerritoryId', (v_existing_event.payload ->> 'targetTerritoryId')::uuid,
      'attackerCommittedInfluence', (v_existing_event.payload ->> 'attackerCommittedInfluence')::integer,
      'defenderCommittedInfluence', (v_existing_event.payload ->> 'defenderCommittedInfluence')::integer,
      'status', 'active',
      'startedAt', v_existing_event.created_at,
      'eventId', v_existing_event.id
    );
  end if;

  select *
    into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then
    raise exception 'SEASON_NOT_FOUND';
  end if;
  if v_season.status not in ('active', 'surge')
     or (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_now >= v_season.ends_at) then
    raise exception 'SEASON_NOT_ACTIVE';
  end if;

  v_contest_config := v_season.config -> 'contest';
  if jsonb_typeof(v_contest_config) <> 'object' then
    raise exception 'CONTEST_NOT_CONFIGURED';
  end if;
  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_attacker_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'attacker' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_attacker_committed_influence;

  select coalesce(max((band.value ->> 'dice')::integer), 0)
    into v_defender_dice
    from jsonb_array_elements(
      coalesce(v_contest_config -> 'defender' -> 'bands', '[]'::jsonb)
    ) band(value)
   where coalesce(band.value ->> 'minCommittedInfluence', '') ~ '^[1-9][0-9]*$'
     and coalesce(band.value ->> 'dice', '') ~ '^[1-9][0-9]*$'
     and (band.value ->> 'minCommittedInfluence')::integer <= p_defender_committed_influence;

  if v_attacker_dice <= 0 or v_defender_dice <= 0 then
    raise exception 'CONTEST_COMMITMENT_BELOW_DICE_THRESHOLD';
  end if;

  select * into v_source
    from public.grid_territories
   where id = p_source_territory_id;
  if not found then
    raise exception 'SOURCE_TERRITORY_NOT_FOUND';
  end if;

  select * into v_target
    from public.grid_territories
   where id = p_target_territory_id;
  if not found then
    raise exception 'TARGET_TERRITORY_NOT_FOUND';
  end if;
  if v_source.city_id <> v_season.city_id or v_target.city_id <> v_season.city_id then
    raise exception 'CONTEST_TERRITORY_WRONG_CITY';
  end if;
  if not exists (
    select 1
      from public.grid_territory_edges e
     where e.city_id = v_season.city_id
       and (
         (e.territory_a_id = p_source_territory_id and e.territory_b_id = p_target_territory_id)
         or
         (e.territory_b_id = p_source_territory_id and e.territory_a_id = p_target_territory_id)
       )
  ) then
    raise exception 'CONTEST_TERRITORIES_NOT_ADJACENT';
  end if;

  perform 1
    from public.grid_season_territory_state
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
  if not found or v_target_state.owner_player_id is distinct from p_defender_player_id then
    raise exception 'TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER';
  end if;

  if exists (
    select 1 from public.grid_contests
     where season_id = p_season_id
       and target_territory_id = p_target_territory_id
       and status = 'active'
  ) then
    raise exception 'TARGET_ALREADY_CONTESTED';
  end if;
  if p_attacker_player_id::text < p_defender_player_id::text then
    perform public.grid_settle_player_resources(
      p_season_id, p_attacker_player_id, 'precontest-start:a:' || p_idempotency_key, p_now
    );
    perform public.grid_settle_player_resources(
      p_season_id, p_defender_player_id, 'precontest-start:d:' || p_idempotency_key, p_now
    );
  else
    perform public.grid_settle_player_resources(
      p_season_id, p_defender_player_id, 'precontest-start:d:' || p_idempotency_key, p_now
    );
    perform public.grid_settle_player_resources(
      p_season_id, p_attacker_player_id, 'precontest-start:a:' || p_idempotency_key, p_now
    );
  end if;

  perform 1
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id in (p_attacker_player_id, p_defender_player_id)
   order by player_id
   for update;

  select * into v_attacker_state
    from public.grid_player_season_state
   where season_id = p_season_id and player_id = p_attacker_player_id;
  if not found then raise exception 'ATTACKER_NOT_JOINED'; end if;

  select * into v_defender_state
    from public.grid_player_season_state
   where season_id = p_season_id and player_id = p_defender_player_id;
  if not found then raise exception 'DEFENDER_NOT_JOINED'; end if;

  if v_attacker_state.influence < p_attacker_committed_influence then
    raise exception 'ATTACKER_INSUFFICIENT_INFLUENCE';
  end if;
  if v_defender_state.influence < p_defender_committed_influence then
    raise exception 'DEFENDER_INSUFFICIENT_INFLUENCE';
  end if;
  update public.grid_player_season_state
     set influence = influence - p_attacker_committed_influence,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_attacker_state.id;

  update public.grid_player_season_state
     set influence = influence - p_defender_committed_influence,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_defender_state.id;

  insert into public.grid_contests (
    season_id, city_id, source_territory_id, target_territory_id,
    attacker_player_id, defender_player_id,
    attacker_committed_influence, defender_committed_influence,
    attacker_remaining_influence, defender_remaining_influence,
    status, started_at, created_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_source_territory_id, p_target_territory_id,
    p_attacker_player_id, p_defender_player_id,
    p_attacker_committed_influence, p_defender_committed_influence,
    p_attacker_committed_influence, p_defender_committed_influence,
    'active', p_now, p_now, p_now
  )
  returning id into v_contest_id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_attacker_player_id,
    'grid:contest_started', 'contest', v_contest_id,
    jsonb_build_object(
      'defenderPlayerId', p_defender_player_id,
      'sourceTerritoryId', p_source_territory_id,
      'targetTerritoryId', p_target_territory_id,
      'attackerCommittedInfluence', p_attacker_committed_influence,
      'defenderCommittedInfluence', p_defender_committed_influence
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'contestId', v_contest_id,
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'attackerPlayerId', p_attacker_player_id,
    'defenderPlayerId', p_defender_player_id,
    'sourceTerritoryId', p_source_territory_id,
    'targetTerritoryId', p_target_territory_id,
    'attackerCommittedInfluence', p_attacker_committed_influence,
    'defenderCommittedInfluence', p_defender_committed_influence,
    'status', 'active',
    'startedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_start_contest(
  uuid, uuid, uuid, uuid, uuid, integer, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_start_contest(
  uuid, uuid, uuid, uuid, uuid, integer, integer, text, timestamptz
) to service_role;

create or replace function public.grid_withdraw_contest(
  p_contest_id uuid,
  p_attacker_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contest public.grid_contests%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;

  select * into v_contest
    from public.grid_contests
   where id = p_contest_id
   for update;
  if not found then
    raise exception 'CONTEST_NOT_FOUND';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = v_contest.season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:contest_withdrawn'
       or v_existing_event.actor_player_id is distinct from p_attacker_player_id
       or v_existing_event.entity_id is distinct from p_contest_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return jsonb_build_object(
      'contestId', p_contest_id,
      'seasonId', v_contest.season_id,
      'cityId', v_contest.city_id,
      'status', 'withdrawn',
      'attackerRefundedInfluence', (v_existing_event.payload ->> 'attackerRefundedInfluence')::integer,
      'defenderRefundedInfluence', (v_existing_event.payload ->> 'defenderRefundedInfluence')::integer,
      'endedAt', v_existing_event.created_at,
      'eventId', v_existing_event.id
    );
  end if;
  if v_contest.status <> 'active' then
    raise exception 'CONTEST_NOT_ACTIVE';
  end if;
  if v_contest.attacker_player_id is distinct from p_attacker_player_id then
    raise exception 'CONTEST_WITHDRAW_NOT_ATTACKER';
  end if;

  perform 1
    from public.grid_player_season_state
   where season_id = v_contest.season_id
     and player_id in (v_contest.attacker_player_id, v_contest.defender_player_id)
   order by player_id
   for update;

  update public.grid_player_season_state
     set influence = influence + v_contest.attacker_remaining_influence,
         last_active_at = p_now,
         updated_at = p_now
   where season_id = v_contest.season_id
     and player_id = v_contest.attacker_player_id;

  update public.grid_player_season_state
     set influence = influence + v_contest.defender_remaining_influence,
         last_active_at = p_now,
         updated_at = p_now
   where season_id = v_contest.season_id
     and player_id = v_contest.defender_player_id;

  update public.grid_contests
     set status = 'withdrawn',
         ended_at = p_now,
         updated_at = p_now
   where id = p_contest_id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_contest.city_id, v_contest.season_id, p_attacker_player_id,
    'grid:contest_withdrawn', 'contest', p_contest_id,
    jsonb_build_object(
      'attackerRefundedInfluence', v_contest.attacker_remaining_influence,
      'defenderRefundedInfluence', v_contest.defender_remaining_influence
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'contestId', p_contest_id,
    'seasonId', v_contest.season_id,
    'cityId', v_contest.city_id,
    'status', 'withdrawn',
    'attackerRefundedInfluence', v_contest.attacker_remaining_influence,
    'defenderRefundedInfluence', v_contest.defender_remaining_influence,
    'endedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_withdraw_contest(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_withdraw_contest(uuid, uuid, text, timestamptz)
  to service_role;
