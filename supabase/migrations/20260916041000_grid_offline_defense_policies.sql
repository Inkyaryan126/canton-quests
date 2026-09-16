-- GRID Contest 4: persistent offline-defense policy.
-- Policy affects future contest behavior, so writes are service-role only,
-- idempotent, and recorded in the immutable Grid game-event ledger.

create table public.grid_offline_defense_policies (
  season_id uuid not null,
  player_id uuid not null,
  doctrine_id text not null
    check (char_length(btrim(doctrine_id)) between 1 and 64),
  reserve_influence integer not null check (reserve_influence >= 0),
  max_commit_per_contest integer not null check (max_commit_per_contest >= 0),
  default_commit_bps integer not null
    check (default_commit_bps between 0 and 10000),
  auto_retreat_below_influence integer not null
    check (auto_retreat_below_influence >= 0),
  auto_retreat_after_losses integer not null
    check (auto_retreat_after_losses >= 0),
  default_tactic text not null
    check (default_tactic in ('pressure', 'flank', 'fortify', 'feint')),
  priority_rules jsonb not null default '[]'::jsonb
    check (jsonb_typeof(priority_rules) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id),
  foreign key (season_id, player_id)
    references public.grid_player_season_state(season_id, player_id)
    on delete cascade
);

alter table public.grid_offline_defense_policies enable row level security;
revoke all on public.grid_offline_defense_policies from anon, authenticated;

create or replace function public.grid_set_offline_defense_policy(
  p_season_id uuid,
  p_player_id uuid,
  p_doctrine_id text,
  p_reserve_influence integer,
  p_max_commit_per_contest integer,
  p_default_commit_bps integer,
  p_auto_retreat_below_influence integer,
  p_auto_retreat_after_losses integer,
  p_default_tactic text,
  p_priority_rules jsonb,
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
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_policy jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_doctrine_id is null
     or char_length(btrim(p_doctrine_id)) not between 1 and 64 then
    raise exception 'OFFLINE_DEFENSE_DOCTRINE_INVALID';
  end if;
  if p_reserve_influence < 0
     or p_max_commit_per_contest < 0
     or p_auto_retreat_below_influence < 0
     or p_auto_retreat_after_losses < 0 then
    raise exception 'OFFLINE_DEFENSE_INFLUENCE_VALUE_INVALID';
  end if;
  if p_default_commit_bps < 0 or p_default_commit_bps > 10000 then
    raise exception 'OFFLINE_DEFENSE_COMMIT_BPS_INVALID';
  end if;
  if p_default_tactic not in ('pressure', 'flank', 'fortify', 'feint') then
    raise exception 'OFFLINE_DEFENSE_TACTIC_INVALID';
  end if;
  if jsonb_typeof(p_priority_rules) <> 'array' then
    raise exception 'OFFLINE_DEFENSE_PRIORITY_RULES_INVALID';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_priority_rules) rule(value)
     where jsonb_typeof(rule.value) <> 'object'
        or btrim(coalesce(rule.value ->> 'territorySlug', '')) = ''
        or coalesce(rule.value ->> 'priority', '') !~ '^[0-9]+$'
        or (
          rule.value ? 'commitBps'
          and (
            coalesce(rule.value ->> 'commitBps', '') !~ '^[0-9]+$'
            or (rule.value ->> 'commitBps')::integer > 10000
          )
        )
        or (
          rule.value ? 'tactic'
          and coalesce(rule.value ->> 'tactic', '') not in
            ('pressure', 'flank', 'fortify', 'feint')
        )
  ) then
    raise exception 'OFFLINE_DEFENSE_PRIORITY_RULE_INVALID';
  end if;

  if exists (
    select 1
      from (
        select rule.value ->> 'territorySlug' as territory_slug
          from jsonb_array_elements(p_priority_rules) rule(value)
         group by rule.value ->> 'territorySlug'
        having count(*) > 1
      ) duplicates
  ) then
    raise exception 'OFFLINE_DEFENSE_PRIORITY_RULE_DUPLICATE';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:offline_defense_policy_set'
       or v_existing_event.actor_player_id is distinct from p_player_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return jsonb_build_object(
      'seasonId', p_season_id,
      'playerId', p_player_id,
      'policy', v_existing_event.payload -> 'policy',
      'updatedAt', v_existing_event.created_at,
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
  if v_season.status not in ('scheduled', 'active', 'surge') then
    raise exception 'SEASON_NOT_CONFIGURABLE';
  end if;

  perform 1
    from public.grid_player_season_state
   where season_id = p_season_id
     and player_id = p_player_id
   for update;
  if not found then
    raise exception 'GRID_PLAYER_NOT_JOINED';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_priority_rules) rule(value)
     where not exists (
       select 1
         from public.grid_territories territory
        where territory.city_id = v_season.city_id
          and territory.slug = rule.value ->> 'territorySlug'
     )
  ) then
    raise exception 'OFFLINE_DEFENSE_PRIORITY_TERRITORY_NOT_FOUND';
  end if;

  v_policy := jsonb_build_object(
    'doctrineId', btrim(p_doctrine_id),
    'reserveInfluence', p_reserve_influence,
    'maxCommitPerContest', p_max_commit_per_contest,
    'defaultCommitBps', p_default_commit_bps,
    'autoRetreatBelowInfluence', p_auto_retreat_below_influence,
    'autoRetreatAfterLosses', p_auto_retreat_after_losses,
    'defaultTactic', p_default_tactic,
    'priorityRules', p_priority_rules
  );

  insert into public.grid_offline_defense_policies (
    season_id,
    player_id,
    doctrine_id,
    reserve_influence,
    max_commit_per_contest,
    default_commit_bps,
    auto_retreat_below_influence,
    auto_retreat_after_losses,
    default_tactic,
    priority_rules,
    created_at,
    updated_at
  ) values (
    p_season_id,
    p_player_id,
    btrim(p_doctrine_id),
    p_reserve_influence,
    p_max_commit_per_contest,
    p_default_commit_bps,
    p_auto_retreat_below_influence,
    p_auto_retreat_after_losses,
    p_default_tactic,
    p_priority_rules,
    p_now,
    p_now
  )
  on conflict (season_id, player_id) do update
    set doctrine_id = excluded.doctrine_id,
        reserve_influence = excluded.reserve_influence,
        max_commit_per_contest = excluded.max_commit_per_contest,
        default_commit_bps = excluded.default_commit_bps,
        auto_retreat_below_influence = excluded.auto_retreat_below_influence,
        auto_retreat_after_losses = excluded.auto_retreat_after_losses,
        default_tactic = excluded.default_tactic,
        priority_rules = excluded.priority_rules,
        updated_at = excluded.updated_at;

  insert into public.grid_game_events (
    city_id,
    season_id,
    actor_player_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    created_at
  ) values (
    v_season.city_id,
    p_season_id,
    p_player_id,
    'grid:offline_defense_policy_set',
    'player',
    p_player_id,
    jsonb_build_object('policy', v_policy),
    p_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'playerId', p_player_id,
    'policy', v_policy,
    'updatedAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_set_offline_defense_policy(
  uuid, uuid, text, integer, integer, integer, integer, integer,
  text, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_set_offline_defense_policy(
  uuid, uuid, text, integer, integer, integer, integer, integer,
  text, jsonb, text, timestamptz
) to service_role;
