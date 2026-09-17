-- GRID Market 6: durable Direct Deal proposals with explicit counterparty consent.
-- Local-first migration. Do not apply to production without a separate approval gate.

create table public.grid_direct_deal_proposals (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  proposal_id text not null,
  proposer_player_id uuid not null references public.players(id) on delete restrict,
  counterparty_player_id uuid not null references public.players(id) on delete restrict,
  proposer_credits bigint not null check (proposer_credits >= 0),
  counterparty_credits bigint not null check (counterparty_credits >= 0),
  proposer_property_ids uuid[] not null default '{}'::uuid[],
  counterparty_property_ids uuid[] not null default '{}'::uuid[],
  transaction_tax_bps integer not null check (transaction_tax_bps between 0 and 10000),
  property_trade_cooldown_minutes bigint not null
    check (property_trade_cooldown_minutes between 0 and 2147483647),
  max_assets_per_side integer not null check (max_assets_per_side > 0),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (status in ('open', 'accepted', 'cancelled')),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  settlement_transaction_id text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, proposal_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  check (proposer_player_id <> counterparty_player_id),
  check (expires_at > created_at),
  check (cardinality(proposer_property_ids) <= max_assets_per_side),
  check (cardinality(counterparty_property_ids) <= max_assets_per_side),
  check (
    proposer_credits > 0
    or counterparty_credits > 0
    or cardinality(proposer_property_ids) > 0
    or cardinality(counterparty_property_ids) > 0
  ),
  check (
    (status = 'open' and accepted_at is null and cancelled_at is null and settlement_transaction_id is null)
    or (status = 'accepted' and accepted_at is not null and cancelled_at is null and settlement_transaction_id is not null)
    or (status = 'cancelled' and accepted_at is null and cancelled_at is not null and settlement_transaction_id is null)
  )
);

create index grid_direct_deal_proposals_proposer_status_idx
  on public.grid_direct_deal_proposals (season_id, proposer_player_id, status, expires_at);
create index grid_direct_deal_proposals_counterparty_status_idx
  on public.grid_direct_deal_proposals (season_id, counterparty_player_id, status, expires_at);

create or replace function public.grid_guard_direct_deal_proposal_terms()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.season_id is distinct from old.season_id
     or new.city_id is distinct from old.city_id
     or new.proposal_id is distinct from old.proposal_id
     or new.proposer_player_id is distinct from old.proposer_player_id
     or new.counterparty_player_id is distinct from old.counterparty_player_id
     or new.proposer_credits is distinct from old.proposer_credits
     or new.counterparty_credits is distinct from old.counterparty_credits
     or new.proposer_property_ids is distinct from old.proposer_property_ids
     or new.counterparty_property_ids is distinct from old.counterparty_property_ids
     or new.transaction_tax_bps is distinct from old.transaction_tax_bps
     or new.property_trade_cooldown_minutes is distinct from old.property_trade_cooldown_minutes
     or new.max_assets_per_side is distinct from old.max_assets_per_side
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'DIRECT_DEAL_PROPOSAL_TERMS_IMMUTABLE';
  end if;

  if old.status <> 'open' and row(new.status, new.accepted_at, new.cancelled_at, new.settlement_transaction_id)
     is distinct from row(old.status, old.accepted_at, old.cancelled_at, old.settlement_transaction_id) then
    raise exception 'DIRECT_DEAL_PROPOSAL_RESOLVED';
  end if;
  return new;
end;
$$;

create trigger grid_direct_deal_proposal_terms_immutable
before update on public.grid_direct_deal_proposals
for each row execute function public.grid_guard_direct_deal_proposal_terms();

alter table public.grid_direct_deal_proposals enable row level security;
revoke insert, update, delete on public.grid_direct_deal_proposals from anon, authenticated;

create or replace function public.grid_create_direct_deal_proposal(
  p_season_id uuid,
  p_proposal_id text,
  p_proposer_player_id uuid,
  p_counterparty_player_id uuid,
  p_proposer_credits bigint,
  p_counterparty_credits bigint,
  p_proposer_property_ids uuid[],
  p_counterparty_property_ids uuid[],
  p_transaction_tax_bps integer,
  p_property_trade_cooldown_minutes bigint,
  p_max_assets_per_side integer,
  p_created_at timestamptz,
  p_expires_at timestamptz,
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
  v_property public.grid_properties%rowtype;
  v_state public.grid_season_property_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_proposal public.grid_direct_deal_proposals%rowtype;
  v_proposer_ids uuid[];
  v_counterparty_ids uuid[];
  v_property_id uuid;
  v_total_property_count integer;
  v_distinct_property_count integer;
  v_event_id uuid;
  v_payload jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_proposal_id is null or btrim(p_proposal_id) = '' then
    raise exception 'DIRECT_DEAL_PROPOSAL_ID_REQUIRED';
  end if;
  if p_now is null or p_created_at is null or p_expires_at is null then
    raise exception 'DIRECT_DEAL_TIME_REQUIRED';
  end if;
  if p_created_at is distinct from p_now then
    raise exception 'DIRECT_DEAL_CREATED_AT_MISMATCH';
  end if;
  if p_expires_at <= p_created_at then
    raise exception 'DIRECT_DEAL_PROPOSAL_WINDOW_INVALID';
  end if;
  if p_proposer_player_id = p_counterparty_player_id then
    raise exception 'DIRECT_DEAL_SAME_PLAYER';
  end if;
  if p_proposer_credits < 0 or p_counterparty_credits < 0 then
    raise exception 'DIRECT_DEAL_CREDITS_INVALID';
  end if;
  if p_transaction_tax_bps < 0 or p_transaction_tax_bps > 10000 then
    raise exception 'DIRECT_DEAL_TAX_RULE_INVALID';
  end if;
  if p_property_trade_cooldown_minutes < 0
     or p_property_trade_cooldown_minutes > 2147483647 then
    raise exception 'DIRECT_DEAL_PROPERTY_COOLDOWN_INVALID';
  end if;
  if p_max_assets_per_side <= 0 then
    raise exception 'DIRECT_DEAL_MAX_ASSETS_INVALID';
  end if;
  if p_proposer_property_ids is null or p_counterparty_property_ids is null then
    raise exception 'DIRECT_DEAL_PROPERTY_IDS_REQUIRED';
  end if;
  if cardinality(p_proposer_property_ids) > p_max_assets_per_side
     or cardinality(p_counterparty_property_ids) > p_max_assets_per_side then
    raise exception 'DIRECT_DEAL_MAX_ASSETS_EXCEEDED';
  end if;
  if p_proposer_credits = 0 and p_counterparty_credits = 0
     and cardinality(p_proposer_property_ids) = 0
     and cardinality(p_counterparty_property_ids) = 0 then
    raise exception 'DIRECT_DEAL_EMPTY';
  end if;

  select coalesce(array_agg(property_id order by property_id), '{}'::uuid[])
    into v_proposer_ids
    from unnest(p_proposer_property_ids) as property_id;
  select coalesce(array_agg(property_id order by property_id), '{}'::uuid[])
    into v_counterparty_ids
    from unnest(p_counterparty_property_ids) as property_id;

  select count(*), count(distinct property_id)
    into v_total_property_count, v_distinct_property_count
    from unnest(v_proposer_ids || v_counterparty_ids) as property_id;
  if v_total_property_count <> v_distinct_property_count then
    raise exception 'DIRECT_DEAL_DUPLICATE_PROPERTY';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:direct_deal_proposed'
       or v_existing_event.actor_player_id is distinct from p_proposer_player_id
       or v_existing_event.payload ->> 'proposalId' <> p_proposal_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object('eventId', v_existing_event.id);
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.status not in ('active', 'surge') then
    raise exception 'DIRECT_DEAL_SEASON_NOT_ACTIVE';
  end if;
  if (v_season.starts_at is not null and p_now < v_season.starts_at)
     or (v_season.ends_at is not null and p_expires_at > v_season.ends_at) then
    raise exception 'DIRECT_DEAL_OUTSIDE_SEASON_WINDOW';
  end if;

  if not exists (
    select 1 from public.grid_player_season_state
     where season_id = p_season_id and player_id = p_proposer_player_id
  ) or not exists (
    select 1 from public.grid_player_season_state
     where season_id = p_season_id and player_id = p_counterparty_player_id
  ) then
    raise exception 'DIRECT_DEAL_PLAYER_NOT_JOINED';
  end if;

  foreach v_property_id in array v_proposer_ids loop
    select * into v_property
      from public.grid_properties
     where id = v_property_id
     for update;
    if not found then raise exception 'DIRECT_DEAL_PROPERTY_NOT_FOUND'; end if;
    if v_property.city_id <> v_season.city_id then
      raise exception 'DIRECT_DEAL_CITY_MISMATCH';
    end if;
    if lower(coalesce(v_property.config ->> 'tradable', 'true')) = 'false' then
      raise exception 'DIRECT_DEAL_PROPERTY_NOT_TRADABLE';
    end if;
    if lower(coalesce(v_property.config ->> 'majorLandmark', 'false')) = 'true' then
      raise exception 'DIRECT_DEAL_MAJOR_LANDMARK';
    end if;
    select * into v_state
      from public.grid_season_property_state
     where season_id = p_season_id and property_id = v_property_id
     for update;
    if not found or v_state.owner_player_id is distinct from p_proposer_player_id then
      raise exception 'DIRECT_DEAL_PROPERTY_OWNER_MISMATCH';
    end if;
    if p_property_trade_cooldown_minutes > 0 then
      if v_state.acquired_at is null
         or p_now < v_state.acquired_at + make_interval(mins => p_property_trade_cooldown_minutes::integer) then
        raise exception 'DIRECT_DEAL_PROPERTY_COOLDOWN_ACTIVE';
      end if;
    end if;
    if exists (
      select 1 from public.grid_market_fixed_price_listings listing
       where listing.season_id = p_season_id
         and listing.property_id = v_property_id
         and listing.status = 'open'
    ) then
      raise exception 'DIRECT_DEAL_PROPERTY_LISTED';
    end if;
  end loop;

  foreach v_property_id in array v_counterparty_ids loop
    select * into v_property
      from public.grid_properties
     where id = v_property_id
     for update;
    if not found then raise exception 'DIRECT_DEAL_PROPERTY_NOT_FOUND'; end if;
    if v_property.city_id <> v_season.city_id then
      raise exception 'DIRECT_DEAL_CITY_MISMATCH';
    end if;
    if lower(coalesce(v_property.config ->> 'tradable', 'true')) = 'false' then
      raise exception 'DIRECT_DEAL_PROPERTY_NOT_TRADABLE';
    end if;
    if lower(coalesce(v_property.config ->> 'majorLandmark', 'false')) = 'true' then
      raise exception 'DIRECT_DEAL_MAJOR_LANDMARK';
    end if;
    select * into v_state
      from public.grid_season_property_state
     where season_id = p_season_id and property_id = v_property_id
     for update;
    if not found or v_state.owner_player_id is distinct from p_counterparty_player_id then
      raise exception 'DIRECT_DEAL_PROPERTY_OWNER_MISMATCH';
    end if;
    if p_property_trade_cooldown_minutes > 0 then
      if v_state.acquired_at is null
         or p_now < v_state.acquired_at + make_interval(mins => p_property_trade_cooldown_minutes::integer) then
        raise exception 'DIRECT_DEAL_PROPERTY_COOLDOWN_ACTIVE';
      end if;
    end if;
    if exists (
      select 1 from public.grid_market_fixed_price_listings listing
       where listing.season_id = p_season_id
         and listing.property_id = v_property_id
         and listing.status = 'open'
    ) then
      raise exception 'DIRECT_DEAL_PROPERTY_LISTED';
    end if;
  end loop;

  insert into public.grid_direct_deal_proposals (
    season_id, city_id, proposal_id, proposer_player_id, counterparty_player_id,
    proposer_credits, counterparty_credits,
    proposer_property_ids, counterparty_property_ids,
    transaction_tax_bps, property_trade_cooldown_minutes, max_assets_per_side,
    created_at, expires_at, status, inserted_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_proposal_id, p_proposer_player_id, p_counterparty_player_id,
    p_proposer_credits, p_counterparty_credits,
    v_proposer_ids, v_counterparty_ids,
    p_transaction_tax_bps, p_property_trade_cooldown_minutes, p_max_assets_per_side,
    p_created_at, p_expires_at, 'open', p_now, p_now
  ) returning * into v_proposal;

  v_payload := jsonb_build_object(
    'proposalId', v_proposal.proposal_id,
    'seasonId', v_proposal.season_id,
    'cityId', v_proposal.city_id,
    'proposerPlayerId', v_proposal.proposer_player_id,
    'counterpartyPlayerId', v_proposal.counterparty_player_id,
    'proposerCredits', v_proposal.proposer_credits,
    'counterpartyCredits', v_proposal.counterparty_credits,
    'proposerPropertyIds', to_jsonb(v_proposal.proposer_property_ids),
    'counterpartyPropertyIds', to_jsonb(v_proposal.counterparty_property_ids),
    'transactionTaxBps', v_proposal.transaction_tax_bps,
    'propertyTradeCooldownMinutes', v_proposal.property_trade_cooldown_minutes,
    'maxAssetsPerSide', v_proposal.max_assets_per_side,
    'createdAt', v_proposal.created_at,
    'expiresAt', v_proposal.expires_at,
    'status', v_proposal.status
  );

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_proposal.city_id, p_season_id, p_proposer_player_id,
    'grid:direct_deal_proposed', 'direct_deal', null,
    v_payload, p_idempotency_key, p_now
  ) returning id into v_event_id;

  return v_payload || jsonb_build_object('eventId', v_event_id);
end;
$$;

create or replace function public.grid_cancel_direct_deal_proposal(
  p_season_id uuid,
  p_proposal_id text,
  p_proposer_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.grid_direct_deal_proposals%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_payload jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_proposal_id is null or btrim(p_proposal_id) = '' then
    raise exception 'DIRECT_DEAL_PROPOSAL_ID_REQUIRED';
  end if;
  if p_now is null then raise exception 'DIRECT_DEAL_TIME_REQUIRED'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:direct_deal_cancelled'
       or v_existing_event.actor_player_id is distinct from p_proposer_player_id
       or v_existing_event.payload ->> 'proposalId' <> p_proposal_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object('eventId', v_existing_event.id);
  end if;

  select * into v_proposal
    from public.grid_direct_deal_proposals
   where season_id = p_season_id and proposal_id = p_proposal_id
   for update;
  if not found then raise exception 'DIRECT_DEAL_PROPOSAL_NOT_FOUND'; end if;
  if v_proposal.proposer_player_id <> p_proposer_player_id then
    raise exception 'DIRECT_DEAL_PROPOSER_ONLY';
  end if;
  if v_proposal.status <> 'open' then
    raise exception 'DIRECT_DEAL_PROPOSAL_NOT_OPEN';
  end if;

  update public.grid_direct_deal_proposals
     set status = 'cancelled', cancelled_at = p_now, updated_at = p_now
   where id = v_proposal.id;

  v_payload := jsonb_build_object(
    'proposalId', p_proposal_id,
    'seasonId', p_season_id,
    'status', 'cancelled',
    'cancelledAt', p_now
  );
  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_proposal.city_id, p_season_id, p_proposer_player_id,
    'grid:direct_deal_cancelled', 'direct_deal', null,
    v_payload, p_idempotency_key, p_now
  ) returning id into v_event_id;

  return v_payload || jsonb_build_object('eventId', v_event_id);
end;
$$;

create or replace function public.grid_accept_direct_deal_proposal(
  p_season_id uuid,
  p_proposal_id text,
  p_accepting_player_id uuid,
  p_transaction jsonb,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.grid_direct_deal_proposals%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_property public.grid_properties%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  transfer jsonb;
  v_from_player_id uuid;
  v_to_player_id uuid;
  v_property_id uuid;
  v_amount bigint;
  v_participant_a_id uuid;
  v_participant_b_id uuid;
  v_proposer_credit_seen boolean := false;
  v_counterparty_credit_seen boolean := false;
  v_proposer_transfer_ids uuid[] := '{}'::uuid[];
  v_counterparty_transfer_ids uuid[] := '{}'::uuid[];
  v_expected_value bigint;
  v_settlement jsonb;
  v_event_id uuid;
  v_payload jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_proposal_id is null or btrim(p_proposal_id) = '' then
    raise exception 'DIRECT_DEAL_PROPOSAL_ID_REQUIRED';
  end if;
  if p_now is null then raise exception 'DIRECT_DEAL_TIME_REQUIRED'; end if;
  if p_transaction is null or jsonb_typeof(p_transaction) <> 'object' then
    raise exception 'DIRECT_DEAL_TRANSACTION_REQUIRED';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:direct_deal_accepted'
       or v_existing_event.actor_player_id is distinct from p_accepting_player_id
       or v_existing_event.payload ->> 'proposalId' <> p_proposal_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object('eventId', v_existing_event.id);
  end if;

  select * into v_proposal
    from public.grid_direct_deal_proposals
   where season_id = p_season_id and proposal_id = p_proposal_id
   for update;
  if not found then raise exception 'DIRECT_DEAL_PROPOSAL_NOT_FOUND'; end if;
  if v_proposal.status <> 'open' then
    raise exception 'DIRECT_DEAL_PROPOSAL_NOT_OPEN';
  end if;
  if v_proposal.counterparty_player_id <> p_accepting_player_id then
    raise exception 'DIRECT_DEAL_COUNTERPARTY_ONLY';
  end if;
  if p_now < v_proposal.created_at or p_now >= v_proposal.expires_at then
    raise exception 'DIRECT_DEAL_PROPOSAL_EXPIRED';
  end if;

  if p_transaction ->> 'source' <> 'direct-deal'
     or p_transaction ->> 'sourceId' <> p_proposal_id
     or (p_transaction ->> 'cityId')::uuid <> v_proposal.city_id
     or (p_transaction ->> 'occurredAt')::timestamptz is distinct from p_now then
    raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
  end if;
  if jsonb_typeof(p_transaction -> 'participantIds') <> 'array'
     or jsonb_array_length(p_transaction -> 'participantIds') <> 2
     or jsonb_typeof(p_transaction -> 'creditTransfers') <> 'array'
     or jsonb_typeof(p_transaction -> 'assetTransfers') <> 'array' then
    raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
  end if;

  v_participant_a_id := (p_transaction #>> '{participantIds,0}')::uuid;
  v_participant_b_id := (p_transaction #>> '{participantIds,1}')::uuid;
  if not (
    (v_participant_a_id = v_proposal.proposer_player_id and v_participant_b_id = v_proposal.counterparty_player_id)
    or (v_participant_a_id = v_proposal.counterparty_player_id and v_participant_b_id = v_proposal.proposer_player_id)
  ) then
    raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
  end if;

  for transfer in select value from jsonb_array_elements(p_transaction -> 'creditTransfers') loop
    v_from_player_id := (transfer ->> 'fromPlayerId')::uuid;
    v_to_player_id := (transfer ->> 'toPlayerId')::uuid;
    v_amount := (transfer ->> 'amountCredits')::bigint;
    if v_from_player_id = v_proposal.proposer_player_id
       and v_to_player_id = v_proposal.counterparty_player_id
       and not v_proposer_credit_seen
       and v_amount = v_proposal.proposer_credits
       and v_amount > 0 then
      v_proposer_credit_seen := true;
    elsif v_from_player_id = v_proposal.counterparty_player_id
       and v_to_player_id = v_proposal.proposer_player_id
       and not v_counterparty_credit_seen
       and v_amount = v_proposal.counterparty_credits
       and v_amount > 0 then
      v_counterparty_credit_seen := true;
    else
      raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
    end if;
  end loop;
  if v_proposer_credit_seen <> (v_proposal.proposer_credits > 0)
     or v_counterparty_credit_seen <> (v_proposal.counterparty_credits > 0) then
    raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
  end if;

  for transfer in select value from jsonb_array_elements(p_transaction -> 'assetTransfers') loop
    if transfer ->> 'kind' <> 'property' then
      raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
    end if;
    v_property_id := (transfer ->> 'assetId')::uuid;
    v_from_player_id := (transfer ->> 'fromPlayerId')::uuid;
    v_to_player_id := (transfer ->> 'toPlayerId')::uuid;
    v_expected_value := (transfer ->> 'estimatedValueCredits')::bigint;

    select * into v_property
      from public.grid_properties
     where id = v_property_id
     for update;
    if not found then raise exception 'DIRECT_DEAL_PROPERTY_NOT_FOUND'; end if;
    if v_property.city_id <> v_proposal.city_id then
      raise exception 'DIRECT_DEAL_CITY_MISMATCH';
    end if;
    if lower(coalesce(v_property.config ->> 'tradable', 'true')) = 'false' then
      raise exception 'DIRECT_DEAL_PROPERTY_NOT_TRADABLE';
    end if;
    if lower(coalesce(v_property.config ->> 'majorLandmark', 'false')) = 'true' then
      raise exception 'DIRECT_DEAL_MAJOR_LANDMARK';
    end if;
    if v_expected_value <> v_property.base_value then
      raise exception 'DIRECT_DEAL_PROPERTY_VALUE_MISMATCH';
    end if;

    select * into v_property_state
      from public.grid_season_property_state
     where season_id = p_season_id and property_id = v_property_id
     for update;
    if v_from_player_id = v_proposal.proposer_player_id
       and v_to_player_id = v_proposal.counterparty_player_id then
      if not found or v_property_state.owner_player_id is distinct from v_proposal.proposer_player_id then
        raise exception 'DIRECT_DEAL_PROPERTY_OWNER_MISMATCH';
      end if;
      v_proposer_transfer_ids := array_append(v_proposer_transfer_ids, v_property_id);
    elsif v_from_player_id = v_proposal.counterparty_player_id
       and v_to_player_id = v_proposal.proposer_player_id then
      if not found or v_property_state.owner_player_id is distinct from v_proposal.counterparty_player_id then
        raise exception 'DIRECT_DEAL_PROPERTY_OWNER_MISMATCH';
      end if;
      v_counterparty_transfer_ids := array_append(v_counterparty_transfer_ids, v_property_id);
    else
      raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
    end if;

    if v_proposal.property_trade_cooldown_minutes > 0 then
      if v_property_state.acquired_at is null
         or p_now < v_property_state.acquired_at + make_interval(mins => v_proposal.property_trade_cooldown_minutes::integer) then
        raise exception 'DIRECT_DEAL_PROPERTY_COOLDOWN_ACTIVE';
      end if;
    end if;
    if exists (
      select 1 from public.grid_market_fixed_price_listings listing
       where listing.season_id = p_season_id
         and listing.property_id = v_property_id
         and listing.status = 'open'
    ) then
      raise exception 'DIRECT_DEAL_PROPERTY_LISTED';
    end if;
  end loop;

  select coalesce(array_agg(property_id order by property_id), '{}'::uuid[])
    into v_proposer_transfer_ids
    from unnest(v_proposer_transfer_ids) as property_id;
  select coalesce(array_agg(property_id order by property_id), '{}'::uuid[])
    into v_counterparty_transfer_ids
    from unnest(v_counterparty_transfer_ids) as property_id;
  if v_proposer_transfer_ids <> v_proposal.proposer_property_ids
     or v_counterparty_transfer_ids <> v_proposal.counterparty_property_ids then
    raise exception 'DIRECT_DEAL_TRANSACTION_TERMS_MISMATCH';
  end if;

  v_settlement := public.grid_settle_market_transaction(
    p_season_id,
    p_transaction,
    v_proposal.transaction_tax_bps,
    v_proposal.property_trade_cooldown_minutes,
    'direct-deal-settle:' || p_idempotency_key,
    p_now
  );

  update public.grid_direct_deal_proposals
     set status = 'accepted',
         accepted_at = p_now,
         settlement_transaction_id = v_settlement ->> 'transactionId',
         updated_at = p_now
   where id = v_proposal.id;

  v_payload := jsonb_build_object(
    'proposalId', p_proposal_id,
    'seasonId', p_season_id,
    'status', 'accepted',
    'acceptedAt', p_now,
    'settlement', v_settlement
  );
  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_proposal.city_id, p_season_id, p_accepting_player_id,
    'grid:direct_deal_accepted', 'direct_deal', null,
    v_payload, p_idempotency_key, p_now
  ) returning id into v_event_id;

  return v_payload || jsonb_build_object('eventId', v_event_id);
end;
$$;

revoke all on function public.grid_create_direct_deal_proposal(
  uuid, text, uuid, uuid, bigint, bigint, uuid[], uuid[], integer, bigint,
  integer, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_create_direct_deal_proposal(
  uuid, text, uuid, uuid, bigint, bigint, uuid[], uuid[], integer, bigint,
  integer, timestamptz, timestamptz, text, timestamptz
) to service_role;

revoke all on function public.grid_cancel_direct_deal_proposal(
  uuid, text, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_cancel_direct_deal_proposal(
  uuid, text, uuid, text, timestamptz
) to service_role;

revoke all on function public.grid_accept_direct_deal_proposal(
  uuid, text, uuid, jsonb, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_accept_direct_deal_proposal(
  uuid, text, uuid, jsonb, text, timestamptz
) to service_role;
