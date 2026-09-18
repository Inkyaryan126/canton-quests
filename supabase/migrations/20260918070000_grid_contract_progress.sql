-- THE GRID: durable, server-authoritative contract progress and reward intent outbox.
-- Additive/local-first migration. Do not apply to production without approval.

create table public.grid_contract_definitions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  season_id uuid not null,
  contract_id text not null check (length(btrim(contract_id)) > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, season_id, contract_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade
);

create table public.grid_contract_instances (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  season_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  contract_id text not null check (length(btrim(contract_id)) > 0),
  status text not null check (status in ('active', 'completed', 'expired')),
  accepted_at_ms bigint not null check (accepted_at_ms >= 0),
  expires_at_ms bigint check (expires_at_ms is null or expires_at_ms > accepted_at_ms),
  completed_at_ms bigint check (completed_at_ms is null or completed_at_ms >= accepted_at_ms),
  location_enhanced boolean not null default false,
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, season_id, player_id, contract_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (city_id, season_id, contract_id)
    references public.grid_contract_definitions(city_id, season_id, contract_id) on delete restrict
);

create table public.grid_contract_progress_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  season_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  contract_id text not null,
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  outcome text not null check (outcome in ('applied', 'duplicate')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  unique (season_id, idempotency_key),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade
);

create table public.grid_contract_reward_outbox (
  id uuid primary key default gen_random_uuid(),
  progress_event_id uuid not null references public.grid_contract_progress_events(id) on delete cascade,
  city_id uuid not null,
  season_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  contract_id text not null,
  reward_kind text not null check (reward_kind in ('contract', 'location-bonus')),
  reward jsonb not null check (jsonb_typeof(reward) = 'object'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (progress_event_id, reward_kind),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade
);

create index grid_contract_instances_player_idx
  on public.grid_contract_instances (player_id, season_id);
create index grid_contract_reward_outbox_pending_idx
  on public.grid_contract_reward_outbox (created_at)
  where processed_at is null;

alter table public.grid_contract_definitions enable row level security;
alter table public.grid_contract_instances enable row level security;
alter table public.grid_contract_progress_events enable row level security;
alter table public.grid_contract_reward_outbox enable row level security;

revoke all on public.grid_contract_definitions from anon, authenticated;
revoke all on public.grid_contract_instances from anon, authenticated;
revoke all on public.grid_contract_progress_events from anon, authenticated;
revoke all on public.grid_contract_reward_outbox from anon, authenticated;

create or replace function public.grid_commit_contract_progress(
  p_city_id uuid,
  p_season_id uuid,
  p_player_id uuid,
  p_contract_id text,
  p_objective_id text,
  p_amount bigint,
  p_now_ms bigint,
  p_location_enhanced boolean,
  p_idempotency_key text,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_definition jsonb;
  v_instance public.grid_contract_instances%rowtype;
  v_previous_event public.grid_contract_progress_events%rowtype;
  v_objective jsonb;
  v_request jsonb;
  v_result jsonb;
  v_progress jsonb;
  v_current bigint;
  v_target bigint;
  v_next bigint;
  v_completed boolean;
  v_location_enhanced boolean;
  v_next_status text;
  v_completed_at bigint;
  v_event_id uuid;
  v_version bigint;
begin
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'CONTRACT_PLAYER_NOT_FOUND';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'CONTRACT_IDEMPOTENCY_REQUIRED';
  end if;
  if p_contract_id is null or btrim(p_contract_id) = '' or p_objective_id is null or btrim(p_objective_id) = '' then
    raise exception 'CONTRACT_IDENTITY_REQUIRED';
  end if;
  if p_amount is null or p_amount < 1 then raise exception 'CONTRACT_AMOUNT_INVALID'; end if;
  if p_now_ms is null or p_now_ms < 0 then raise exception 'CONTRACT_TIME_INVALID'; end if;

  v_request := jsonb_build_object(
    'cityId', p_city_id, 'seasonId', p_season_id, 'playerId', p_player_id,
    'contractId', p_contract_id, 'objectiveId', p_objective_id,
    'amount', p_amount, 'nowMs', p_now_ms,
    'locationEnhanced', coalesce(p_location_enhanced, false),
    'expectedVersion', p_expected_version
  );

  select * into v_previous_event
    from public.grid_contract_progress_events
   where season_id = p_season_id and idempotency_key = btrim(p_idempotency_key)
   for update;
  if found then
    if v_previous_event.request <> v_request then raise exception 'CONTRACT_IDEMPOTENCY_COLLISION'; end if;
    return v_previous_event.result || jsonb_build_object('outcome', 'duplicate');
  end if;

  if not exists (
    select 1 from public.grid_seasons
     where id = p_season_id and city_id = p_city_id
  ) then raise exception 'CONTRACT_CITY_MISMATCH'; end if;

  select definition into v_definition
    from public.grid_contract_definitions
   where city_id = p_city_id and season_id = p_season_id and contract_id = p_contract_id;
  if not found then raise exception 'CONTRACT_DEFINITION_NOT_FOUND'; end if;

  select * into v_instance
    from public.grid_contract_instances
   where city_id = p_city_id and season_id = p_season_id
     and player_id = p_player_id and contract_id = p_contract_id
   for update;
  if not found then raise exception 'CONTRACT_INSTANCE_NOT_FOUND'; end if;
  if v_instance.version <> p_expected_version then
    return jsonb_build_object(
      'outcome', 'conflict',
      'stored', jsonb_build_object(
        'instance', jsonb_build_object(
          'contractId', v_instance.contract_id, 'playerId', v_instance.player_id,
          'status', v_instance.status, 'acceptedAtMs', v_instance.accepted_at_ms,
          'expiresAtMs', v_instance.expires_at_ms, 'completedAtMs', v_instance.completed_at_ms,
          'locationEnhanced', v_instance.location_enhanced, 'progress', v_instance.progress
        ), 'version', v_instance.version
      )
    );
  end if;

  if v_instance.status <> 'active' then
    v_next_status := v_instance.status;
    v_progress := v_instance.progress;
    v_completed_at := v_instance.completed_at_ms;
    v_location_enhanced := v_instance.location_enhanced;
  elsif v_instance.expires_at_ms is not null and p_now_ms >= v_instance.expires_at_ms then
    v_next_status := 'expired';
    v_progress := v_instance.progress;
    v_completed_at := null;
    v_location_enhanced := v_instance.location_enhanced;
  else
    select item into v_objective
      from jsonb_array_elements(v_definition -> 'objectives') item
     where item ->> 'id' = p_objective_id;
    if not found then raise exception 'CONTRACT_OBJECTIVE_NOT_FOUND'; end if;
    v_target := (v_objective ->> 'target')::bigint;
    v_current := coalesce((v_instance.progress ->> p_objective_id)::bigint, 0);
    v_next := least(v_target, v_current + p_amount);
    v_progress := jsonb_set(v_instance.progress, array[p_objective_id], to_jsonb(v_next), true);
    if exists (
      select 1 from jsonb_array_elements(v_definition -> 'objectives') item
       where coalesce((v_progress ->> (item ->> 'id'))::bigint, 0) < (item ->> 'target')::bigint
    ) then
      v_completed := false;
    else
      v_completed := true;
    end if;
    v_next_status := case when v_completed then 'completed' else 'active' end;
    v_completed_at := case when v_completed then p_now_ms else null end;
    v_location_enhanced := v_instance.location_enhanced or coalesce(p_location_enhanced, false);
  end if;

  v_version := v_instance.version + 1;
  update public.grid_contract_instances
     set status = v_next_status, progress = v_progress,
         completed_at_ms = v_completed_at,
         location_enhanced = v_location_enhanced,
         version = v_version, updated_at = now()
   where id = v_instance.id;

  v_result := jsonb_build_object(
    'outcome', 'applied',
    'stored', jsonb_build_object(
      'instance', jsonb_build_object(
        'contractId', v_instance.contract_id, 'playerId', v_instance.player_id,
        'status', v_next_status, 'acceptedAtMs', v_instance.accepted_at_ms,
        'expiresAtMs', v_instance.expires_at_ms, 'completedAtMs', v_completed_at,
        'locationEnhanced', v_location_enhanced, 'progress', v_progress
      ), 'version', v_version
    )
  );
  insert into public.grid_contract_progress_events (
    city_id, season_id, player_id, contract_id, idempotency_key, request, outcome, result
  ) values (
    p_city_id, p_season_id, p_player_id, p_contract_id, btrim(p_idempotency_key),
    v_request, 'applied', v_result
  ) returning id into v_event_id;

  if v_instance.status = 'active' and v_next_status = 'completed' then
    insert into public.grid_contract_reward_outbox (
      progress_event_id, city_id, season_id, player_id, contract_id, reward_kind, reward
    ) values (
      v_event_id, p_city_id, p_season_id, p_player_id, p_contract_id, 'contract',
      v_definition -> 'reward'
    );
    if v_location_enhanced and v_definition -> 'locationEnhancement' ? 'bonusReward' then
      insert into public.grid_contract_reward_outbox (
        progress_event_id, city_id, season_id, player_id, contract_id, reward_kind, reward
      ) values (
        v_event_id, p_city_id, p_season_id, p_player_id, p_contract_id, 'location-bonus',
        v_definition -> 'locationEnhancement' -> 'bonusReward'
      );
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.grid_commit_contract_progress(
  uuid, uuid, uuid, text, text, bigint, bigint, boolean, text, bigint
) from public, anon, authenticated;
grant execute on function public.grid_commit_contract_progress(
  uuid, uuid, uuid, text, text, bigint, bigint, boolean, text, bigint
) to service_role;
