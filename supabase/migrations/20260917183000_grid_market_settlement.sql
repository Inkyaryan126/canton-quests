-- GRID Market 5: server-authoritative fixed-price listing persistence and atomic settlement.
-- Local-first migration. Do not apply to production without a separate approval gate.

create table public.grid_market_fixed_price_listings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  listing_id text not null,
  seller_player_id uuid not null references public.players(id) on delete restrict,
  property_id uuid not null,
  price_credits bigint not null check (price_credits > 0),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (status in ('open', 'sold', 'cancelled')),
  buyer_player_id uuid references public.players(id) on delete restrict,
  sold_at timestamptz,
  cancelled_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, listing_id),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (property_id, city_id)
    references public.grid_properties(id, city_id) on delete cascade,
  check (expires_at > created_at),
  check (
    (status = 'open' and buyer_player_id is null and sold_at is null and cancelled_at is null)
    or (status = 'sold' and buyer_player_id is not null and sold_at is not null and cancelled_at is null)
    or (status = 'cancelled' and buyer_player_id is null and sold_at is null and cancelled_at is not null)
  )
);

create unique index grid_market_open_property_uq
  on public.grid_market_fixed_price_listings (season_id, property_id)
  where status = 'open';

create index grid_market_listings_season_status_expires_idx
  on public.grid_market_fixed_price_listings (season_id, status, expires_at);

create table public.grid_market_transactions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  transaction_id text not null,
  source text not null check (source in ('direct-deal', 'fixed-price')),
  source_id text not null,
  occurred_at timestamptz not null,
  participant_a_id uuid not null references public.players(id) on delete restrict,
  participant_b_id uuid not null references public.players(id) on delete restrict,
  credit_transfers jsonb not null check (jsonb_typeof(credit_transfers) = 'array'),
  asset_transfers jsonb not null check (jsonb_typeof(asset_transfers) = 'array'),
  tax_charges jsonb not null check (jsonb_typeof(tax_charges) = 'array'),
  facts jsonb not null check (jsonb_typeof(facts) = 'object'),
  idempotency_key text not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  check (participant_a_id <> participant_b_id),
  unique (season_id, transaction_id)
);

create unique index grid_market_transactions_idempotency_uq
  on public.grid_market_transactions (season_id, idempotency_key);

create index grid_market_transactions_city_occurred_idx
  on public.grid_market_transactions (city_id, occurred_at desc, id desc);

create index grid_market_transactions_participant_a_idx
  on public.grid_market_transactions (participant_a_id, occurred_at desc);

create index grid_market_transactions_participant_b_idx
  on public.grid_market_transactions (participant_b_id, occurred_at desc);

create or replace function public.grid_reject_market_transaction_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'grid_market_transactions is append-only; write a compensating transaction instead';
end;
$$;

create trigger grid_market_transactions_immutable
before update or delete on public.grid_market_transactions
for each row execute function public.grid_reject_market_transaction_mutation();

alter table public.grid_market_fixed_price_listings enable row level security;
alter table public.grid_market_transactions enable row level security;

revoke insert, update, delete on public.grid_market_fixed_price_listings from anon, authenticated;
revoke insert, update, delete on public.grid_market_transactions from anon, authenticated;

create or replace function public.grid_open_fixed_price_property_listing(
  p_season_id uuid,
  p_listing_id text,
  p_seller_player_id uuid,
  p_property_id uuid,
  p_price_credits bigint,
  p_created_at timestamptz,
  p_expires_at timestamptz,
  p_minimum_price_credits bigint,
  p_maximum_price_credits bigint,
  p_minimum_listing_duration_minutes bigint,
  p_maximum_listing_duration_minutes bigint,
  p_property_trade_cooldown_minutes bigint,
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
  v_listing public.grid_market_fixed_price_listings%rowtype;
  v_event_id uuid;
  v_duration_minutes numeric;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_listing_id is null or btrim(p_listing_id) = '' then
    raise exception 'MARKET_LISTING_ID_REQUIRED';
  end if;
  if p_now is null or p_created_at is null or p_expires_at is null then
    raise exception 'MARKET_TIME_REQUIRED';
  end if;
  if p_price_credits <= 0
     or p_minimum_price_credits < 0
     or p_maximum_price_credits <= 0
     or p_maximum_price_credits < p_minimum_price_credits
     or p_price_credits < p_minimum_price_credits
     or p_price_credits > p_maximum_price_credits then
    raise exception 'MARKET_LISTING_PRICE_INVALID';
  end if;
  if p_minimum_listing_duration_minutes <= 0
     or p_maximum_listing_duration_minutes <= 0
     or p_maximum_listing_duration_minutes < p_minimum_listing_duration_minutes then
    raise exception 'MARKET_LISTING_DURATION_RULES_INVALID';
  end if;
  if p_property_trade_cooldown_minutes < 0 then
    raise exception 'MARKET_PROPERTY_COOLDOWN_INVALID';
  end if;
  if p_property_trade_cooldown_minutes > 2147483647 then
    raise exception 'MARKET_PROPERTY_COOLDOWN_INVALID';
  end if;
  if p_expires_at <= p_created_at or p_now >= p_expires_at then
    raise exception 'MARKET_LISTING_WINDOW_INVALID';
  end if;

  v_duration_minutes := extract(epoch from (p_expires_at - p_created_at)) / 60;
  if v_duration_minutes < p_minimum_listing_duration_minutes
     or v_duration_minutes > p_maximum_listing_duration_minutes then
    raise exception 'MARKET_LISTING_DURATION_INVALID';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:market_listing_opened'
       or v_existing_event.actor_player_id is distinct from p_seller_player_id
       or v_existing_event.payload ->> 'listingId' <> p_listing_id then
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
    raise exception 'MARKET_SEASON_NOT_ACTIVE';
  end if;

  select * into v_property
    from public.grid_properties
   where id = p_property_id
   for update;
  if not found then raise exception 'MARKET_PROPERTY_NOT_FOUND'; end if;
  if v_property.city_id <> v_season.city_id then
    raise exception 'MARKET_CITY_MISMATCH';
  end if;
  if lower(coalesce(v_property.config ->> 'tradable', 'true')) = 'false' then
    raise exception 'MARKET_PROPERTY_NOT_TRADABLE';
  end if;
  if lower(coalesce(v_property.config ->> 'majorLandmark', 'false')) = 'true' then
    raise exception 'MARKET_MAJOR_LANDMARK';
  end if;

  select * into v_state
    from public.grid_season_property_state
   where season_id = p_season_id
     and property_id = p_property_id
   for update;
  if not found or v_state.owner_player_id is distinct from p_seller_player_id then
    raise exception 'MARKET_PROPERTY_OWNER_MISMATCH';
  end if;

  if p_property_trade_cooldown_minutes > 0 then
    if v_state.acquired_at is null
       or p_now < v_state.acquired_at + make_interval(mins => p_property_trade_cooldown_minutes::integer) then
      raise exception 'MARKET_PROPERTY_COOLDOWN_ACTIVE';
    end if;
  end if;

  if exists (
    select 1 from public.grid_market_fixed_price_listings listing
     where listing.season_id = p_season_id
       and listing.property_id = p_property_id
       and listing.status = 'open'
  ) then
    raise exception 'MARKET_PROPERTY_ALREADY_LISTED';
  end if;

  insert into public.grid_market_fixed_price_listings (
    season_id, city_id, listing_id, seller_player_id, property_id,
    price_credits, created_at, expires_at, status, inserted_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_listing_id, p_seller_player_id, p_property_id,
    p_price_credits, p_created_at, p_expires_at, 'open', p_now, p_now
  ) returning * into v_listing;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id, p_seller_player_id,
    'grid:market_listing_opened', 'property', p_property_id,
    jsonb_build_object(
      'listingId', p_listing_id,
      'seasonId', p_season_id,
      'cityId', v_season.city_id,
      'sellerPlayerId', p_seller_player_id,
      'propertyId', p_property_id,
      'priceCredits', p_price_credits,
      'createdAt', p_created_at,
      'expiresAt', p_expires_at,
      'status', 'open'
    ),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'listingId', v_listing.listing_id,
    'seasonId', v_listing.season_id,
    'cityId', v_listing.city_id,
    'sellerPlayerId', v_listing.seller_player_id,
    'propertyId', v_listing.property_id,
    'priceCredits', v_listing.price_credits,
    'createdAt', v_listing.created_at,
    'expiresAt', v_listing.expires_at,
    'status', v_listing.status,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_cancel_fixed_price_property_listing(
  p_season_id uuid,
  p_listing_id text,
  p_seller_player_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listing public.grid_market_fixed_price_listings%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_listing_id is null or btrim(p_listing_id) = '' then
    raise exception 'MARKET_LISTING_ID_REQUIRED';
  end if;
  if p_now is null then raise exception 'MARKET_TIME_REQUIRED'; end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_event.event_type <> 'grid:market_listing_cancelled'
       or v_existing_event.actor_player_id is distinct from p_seller_player_id
       or v_existing_event.payload ->> 'listingId' <> p_listing_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object('eventId', v_existing_event.id);
  end if;

  select * into v_listing
    from public.grid_market_fixed_price_listings
   where season_id = p_season_id
     and listing_id = p_listing_id
   for update;
  if not found then raise exception 'MARKET_LISTING_NOT_FOUND'; end if;
  if v_listing.seller_player_id <> p_seller_player_id then
    raise exception 'MARKET_LISTING_SELLER_ONLY';
  end if;
  if v_listing.status <> 'open' then
    raise exception 'MARKET_LISTING_NOT_OPEN';
  end if;
  if p_now < v_listing.created_at or p_now >= v_listing.expires_at then
    raise exception 'MARKET_LISTING_OUTSIDE_WINDOW';
  end if;

  update public.grid_market_fixed_price_listings
     set status = 'cancelled', cancelled_at = p_now, updated_at = p_now
   where id = v_listing.id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_listing.city_id, p_season_id, p_seller_player_id,
    'grid:market_listing_cancelled', 'property', v_listing.property_id,
    jsonb_build_object(
      'listingId', p_listing_id,
      'seasonId', p_season_id,
      'status', 'cancelled',
      'cancelledAt', p_now
    ),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'listingId', p_listing_id,
    'seasonId', p_season_id,
    'status', 'cancelled',
    'cancelledAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_settle_market_transaction(
  p_season_id uuid,
  p_transaction jsonb,
  p_transaction_tax_bps integer,
  p_property_trade_cooldown_minutes bigint,
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
  v_existing_transaction public.grid_market_transactions%rowtype;
  v_listing public.grid_market_fixed_price_listings%rowtype;
  v_property public.grid_properties%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_state_a public.grid_player_season_state%rowtype;
  v_state_b public.grid_player_season_state%rowtype;
  v_transaction_id text;
  v_source text;
  v_source_id text;
  v_city_id uuid;
  v_occurred_at timestamptz;
  v_participant_a_id uuid;
  v_participant_b_id uuid;
  transfer jsonb;
  charge jsonb;
  v_from_player_id uuid;
  v_to_player_id uuid;
  v_property_id uuid;
  v_amount bigint;
  v_estimated_value bigint;
  v_incoming_a bigint := 0;
  v_incoming_b bigint := 0;
  v_outgoing_a bigint := 0;
  v_outgoing_b bigint := 0;
  v_tax_a bigint := 0;
  v_tax_b bigint := 0;
  v_expected_tax bigint := 0;
  v_gross_credits bigint := 0;
  v_gross_asset_value bigint := 0;
  v_total_tax bigint := 0;
  v_property_count integer := 0;
  v_delta_a bigint := 0;
  v_delta_b bigint := 0;
  v_after_a bigint;
  v_after_b bigint;
  v_reciprocal boolean;
  v_seen_properties uuid[] := '{}'::uuid[];
  v_property_owners jsonb := '{}'::jsonb;
  v_credits_after jsonb;
  v_event_id uuid;
  v_result jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then raise exception 'MARKET_TIME_REQUIRED'; end if;
  if p_transaction is null or jsonb_typeof(p_transaction) <> 'object' then
    raise exception 'MARKET_TRANSACTION_REQUIRED';
  end if;
  if p_transaction_tax_bps < 0 or p_transaction_tax_bps > 10000 then
    raise exception 'MARKET_TAX_RULE_INVALID';
  end if;
  if p_property_trade_cooldown_minutes < 0 then
    raise exception 'MARKET_PROPERTY_COOLDOWN_INVALID';
  end if;
  if p_property_trade_cooldown_minutes > 2147483647 then
    raise exception 'MARKET_PROPERTY_COOLDOWN_INVALID';
  end if;

  v_transaction_id := btrim(coalesce(p_transaction ->> 'transactionId', ''));
  v_source := p_transaction ->> 'source';
  v_source_id := btrim(coalesce(p_transaction ->> 'sourceId', ''));
  if v_transaction_id = '' or v_source_id = '' then
    raise exception 'MARKET_TRANSACTION_ID_REQUIRED';
  end if;
  if (p_transaction ->> 'version')::integer <> 1 then
    raise exception 'MARKET_TRANSACTION_VERSION_UNSUPPORTED';
  end if;
  if p_transaction ->> 'source' not in ('direct-deal', 'fixed-price') then
    raise exception 'MARKET_TRANSACTION_SOURCE_UNSUPPORTED';
  end if;
  if jsonb_typeof(p_transaction -> 'participantIds') <> 'array'
     or jsonb_array_length(p_transaction -> 'participantIds') <> 2 then
    raise exception 'MARKET_PARTICIPANTS_INVALID';
  end if;
  if jsonb_typeof(p_transaction -> 'creditTransfers') <> 'array'
     or jsonb_typeof(p_transaction -> 'assetTransfers') <> 'array'
     or jsonb_typeof(p_transaction -> 'taxCharges') <> 'array'
     or jsonb_typeof(p_transaction -> 'facts') <> 'object' then
    raise exception 'MARKET_TRANSACTION_SHAPE_INVALID';
  end if;
  if jsonb_array_length(p_transaction -> 'creditTransfers') = 0
     and jsonb_array_length(p_transaction -> 'assetTransfers') = 0 then
    raise exception 'MARKET_TRANSACTION_EMPTY';
  end if;

  v_city_id := (p_transaction ->> 'cityId')::uuid;
  v_occurred_at := (p_transaction ->> 'occurredAt')::timestamptz;
  if v_occurred_at is distinct from p_now then
    raise exception 'MARKET_TRANSACTION_TIME_MISMATCH';
  end if;
  v_participant_a_id := (p_transaction #>> '{participantIds,0}')::uuid;
  v_participant_b_id := (p_transaction #>> '{participantIds,1}')::uuid;
  if v_participant_a_id = v_participant_b_id
     or v_participant_a_id::text >= v_participant_b_id::text then
    raise exception 'MARKET_PARTICIPANTS_INVALID';
  end if;

  select * into v_existing_transaction
    from public.grid_market_transactions
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;
  if found then
    if v_existing_transaction.transaction_id <> v_transaction_id
       or v_existing_transaction.source <> v_source
       or v_existing_transaction.source_id <> v_source_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_transaction.result;
  end if;

  if exists (
    select 1 from public.grid_game_events event
     where event.season_id = p_season_id
       and event.idempotency_key = p_idempotency_key
  ) then
    raise exception 'IDEMPOTENCY_KEY_COLLISION';
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.status not in ('active', 'surge') then
    raise exception 'MARKET_SEASON_NOT_ACTIVE';
  end if;
  if v_city_id <> v_season.city_id then
    raise exception 'MARKET_CITY_MISMATCH';
  end if;

  perform public.grid_settle_player_resources(
    p_season_id,
    v_participant_a_id,
    'premarket:' || p_idempotency_key || ':' || v_participant_a_id::text,
    p_now
  );
  perform public.grid_settle_player_resources(
    p_season_id,
    v_participant_b_id,
    'premarket:' || p_idempotency_key || ':' || v_participant_b_id::text,
    p_now
  );

  select * into v_state_a
    from public.grid_player_season_state
   where season_id = p_season_id and player_id = v_participant_a_id
   for update;
  if not found then raise exception 'MARKET_PLAYER_NOT_JOINED'; end if;

  select * into v_state_b
    from public.grid_player_season_state
   where season_id = p_season_id and player_id = v_participant_b_id
   for update;
  if not found then raise exception 'MARKET_PLAYER_NOT_JOINED'; end if;

  for transfer in select value from jsonb_array_elements(p_transaction -> 'creditTransfers') loop
    v_from_player_id := (transfer ->> 'fromPlayerId')::uuid;
    v_to_player_id := (transfer ->> 'toPlayerId')::uuid;
    v_amount := (transfer ->> 'amountCredits')::bigint;
    if v_from_player_id = v_to_player_id
       or v_amount <= 0
       or v_from_player_id not in (v_participant_a_id, v_participant_b_id)
       or v_to_player_id not in (v_participant_a_id, v_participant_b_id) then
      raise exception 'MARKET_CREDIT_TRANSFER_INVALID';
    end if;
    v_gross_credits := v_gross_credits + v_amount;
    if v_from_player_id = v_participant_a_id then v_outgoing_a := v_outgoing_a + v_amount; end if;
    if v_from_player_id = v_participant_b_id then v_outgoing_b := v_outgoing_b + v_amount; end if;
    if v_to_player_id = v_participant_a_id then v_incoming_a := v_incoming_a + v_amount; end if;
    if v_to_player_id = v_participant_b_id then v_incoming_b := v_incoming_b + v_amount; end if;
  end loop;

  for charge in select value from jsonb_array_elements(p_transaction -> 'taxCharges') loop
    v_from_player_id := (charge ->> 'playerId')::uuid;
    v_amount := (charge ->> 'amountCredits')::bigint;
    if v_amount <= 0 or v_from_player_id not in (v_participant_a_id, v_participant_b_id) then
      raise exception 'MARKET_TAX_CHARGE_INVALID';
    end if;
    if v_from_player_id = v_participant_a_id then v_tax_a := v_tax_a + v_amount; end if;
    if v_from_player_id = v_participant_b_id then v_tax_b := v_tax_b + v_amount; end if;
    v_total_tax := v_total_tax + v_amount;
  end loop;

  v_expected_tax := floor(v_outgoing_a::numeric * p_transaction_tax_bps::numeric / 10000)::bigint;
  if v_tax_a <> v_expected_tax then raise exception 'MARKET_TAX_MISMATCH'; end if;
  v_expected_tax := floor(v_outgoing_b::numeric * p_transaction_tax_bps::numeric / 10000)::bigint;
  if v_tax_b <> v_expected_tax then raise exception 'MARKET_TAX_MISMATCH'; end if;

  if v_source = 'fixed-price' then
    if jsonb_array_length(p_transaction -> 'creditTransfers') <> 1
       or jsonb_array_length(p_transaction -> 'assetTransfers') <> 1 then
      raise exception 'MARKET_LISTING_TRANSACTION_MISMATCH';
    end if;
    select * into v_listing
      from public.grid_market_fixed_price_listings
     where season_id = p_season_id
       and listing_id = v_source_id
     for update;
    if not found or v_listing.status <> 'open' then
      raise exception 'MARKET_LISTING_NOT_OPEN';
    end if;
    if p_now < v_listing.created_at or p_now >= v_listing.expires_at then
      raise exception 'MARKET_LISTING_OUTSIDE_WINDOW';
    end if;
  end if;

  for transfer in select value from jsonb_array_elements(p_transaction -> 'assetTransfers') loop
    if transfer ->> 'kind' <> 'property' then
      raise exception 'MARKET_ASSET_KIND_UNSUPPORTED';
    end if;
    v_property_id := (transfer ->> 'assetId')::uuid;
    v_from_player_id := (transfer ->> 'fromPlayerId')::uuid;
    v_to_player_id := (transfer ->> 'toPlayerId')::uuid;
    v_estimated_value := (transfer ->> 'estimatedValueCredits')::bigint;
    if v_from_player_id = v_to_player_id
       or v_estimated_value < 0
       or v_from_player_id not in (v_participant_a_id, v_participant_b_id)
       or v_to_player_id not in (v_participant_a_id, v_participant_b_id) then
      raise exception 'MARKET_PROPERTY_TRANSFER_INVALID';
    end if;
    if v_property_id = any(v_seen_properties) then
      raise exception 'MARKET_PROPERTY_TRANSFER_DUPLICATE';
    end if;
    v_seen_properties := array_append(v_seen_properties, v_property_id);
    v_property_count := v_property_count + 1;
    v_gross_asset_value := v_gross_asset_value + v_estimated_value;

    select * into v_property
      from public.grid_properties
     where id = v_property_id
     for update;
    if not found then raise exception 'MARKET_PROPERTY_NOT_FOUND'; end if;
    if v_property.city_id <> v_city_id then raise exception 'MARKET_CITY_MISMATCH'; end if;
    if lower(coalesce(v_property.config ->> 'tradable', 'true')) = 'false' then
      raise exception 'MARKET_PROPERTY_NOT_TRADABLE';
    end if;
    if lower(coalesce(v_property.config ->> 'majorLandmark', 'false')) = 'true' then
      raise exception 'MARKET_MAJOR_LANDMARK';
    end if;

    select * into v_property_state
      from public.grid_season_property_state
     where season_id = p_season_id and property_id = v_property_id
     for update;
    if not found or v_property_state.owner_player_id is distinct from v_from_player_id then
      raise exception 'MARKET_PROPERTY_OWNER_MISMATCH';
    end if;
    if p_property_trade_cooldown_minutes > 0 then
      if v_property_state.acquired_at is null
         or p_now < v_property_state.acquired_at + make_interval(mins => p_property_trade_cooldown_minutes::integer) then
        raise exception 'MARKET_PROPERTY_COOLDOWN_ACTIVE';
      end if;
    end if;

    if v_source = 'fixed-price' then
      if v_listing.property_id <> v_property_id
         or v_listing.seller_player_id <> v_from_player_id
         or v_listing.price_credits <> (p_transaction #>> '{creditTransfers,0,amountCredits}')::bigint
         or (p_transaction #>> '{creditTransfers,0,fromPlayerId}')::uuid <> v_to_player_id
         or (p_transaction #>> '{creditTransfers,0,toPlayerId}')::uuid <> v_from_player_id then
        raise exception 'MARKET_LISTING_TRANSACTION_MISMATCH';
      end if;
    elsif exists (
      select 1 from public.grid_market_fixed_price_listings listing
       where listing.season_id = p_season_id
         and listing.property_id = v_property_id
         and listing.status = 'open'
         and p_now >= listing.created_at
         and p_now < listing.expires_at
    ) then
      raise exception 'MARKET_PROPERTY_LISTED';
    end if;
  end loop;

  v_reciprocal := v_outgoing_a > 0 and v_outgoing_b > 0;
  if (p_transaction #>> '{facts,grossCreditsTransferred}')::bigint <> v_gross_credits
     or (p_transaction #>> '{facts,grossEstimatedAssetValue}')::bigint <> v_gross_asset_value
     or (p_transaction #>> '{facts,grossEstimatedValue}')::bigint <> v_gross_credits + v_gross_asset_value
     or (p_transaction #>> '{facts,totalTaxCredits}')::bigint <> v_total_tax
     or (p_transaction #>> '{facts,propertyTransfers}')::integer <> v_property_count
     or (p_transaction #>> '{facts,otherAssetTransfers}')::integer <> 0
     or (p_transaction #>> '{facts,zeroCreditTransaction}')::boolean <> (v_gross_credits = 0)
     or (p_transaction #>> '{facts,reciprocalCreditFlow}')::boolean <> v_reciprocal then
    raise exception 'MARKET_TRANSACTION_FACTS_MISMATCH';
  end if;

  v_delta_a := v_incoming_a - v_outgoing_a - v_tax_a;
  v_delta_b := v_incoming_b - v_outgoing_b - v_tax_b;
  if v_state_a.credits + v_delta_a < 0 or v_state_b.credits + v_delta_b < 0 then
    raise exception 'MARKET_INSUFFICIENT_CREDITS';
  end if;

  update public.grid_player_season_state
     set credits = credits + v_delta_a,
         last_active_at = p_now,
         updated_at = p_now
   where season_id = p_season_id and player_id = v_participant_a_id
   returning credits into v_after_a;

  update public.grid_player_season_state
     set credits = credits + v_delta_b,
         last_active_at = p_now,
         updated_at = p_now
   where season_id = p_season_id and player_id = v_participant_b_id
   returning credits into v_after_b;

  for transfer in select value from jsonb_array_elements(p_transaction -> 'assetTransfers') loop
    v_property_id := (transfer ->> 'assetId')::uuid;
    v_to_player_id := (transfer ->> 'toPlayerId')::uuid;
    update public.grid_season_property_state
       set owner_player_id = v_to_player_id,
           acquired_at = p_now,
           updated_at = p_now
     where season_id = p_season_id and property_id = v_property_id;
    v_property_owners := v_property_owners || jsonb_build_object(v_property_id::text, v_to_player_id::text);
  end loop;

  if v_source = 'fixed-price' then
    update public.grid_market_fixed_price_listings
       set status = 'sold',
           buyer_player_id = (p_transaction #>> '{assetTransfers,0,toPlayerId}')::uuid,
           sold_at = p_now,
           updated_at = p_now
     where id = v_listing.id;
  end if;

  v_credits_after := jsonb_build_object(
    v_participant_a_id::text, v_after_a,
    v_participant_b_id::text, v_after_b
  );

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_city_id, p_season_id, null,
    'grid:market_transaction_settled', 'market_transaction', null,
    jsonb_build_object(
      'transactionId', v_transaction_id,
      'source', v_source,
      'sourceId', v_source_id,
      'participantIds', p_transaction -> 'participantIds',
      'facts', p_transaction -> 'facts'
    ),
    p_idempotency_key, p_now
  ) returning id into v_event_id;

  v_result := jsonb_build_object(
    'transactionId', v_transaction_id,
    'seasonId', p_season_id,
    'cityId', v_city_id,
    'source', v_source,
    'sourceId', v_source_id,
    'occurredAt', v_occurred_at,
    'participantIds', p_transaction -> 'participantIds',
    'creditsAfter', v_credits_after,
    'propertyOwnerPlayerIds', v_property_owners,
    'totalTaxCredits', v_total_tax,
    'eventId', v_event_id
  );

  insert into public.grid_market_transactions (
    season_id, city_id, transaction_id, source, source_id, occurred_at,
    participant_a_id, participant_b_id, credit_transfers, asset_transfers,
    tax_charges, facts, idempotency_key, result, created_at
  ) values (
    p_season_id, v_city_id, v_transaction_id, v_source, v_source_id, v_occurred_at,
    v_participant_a_id, v_participant_b_id,
    p_transaction -> 'creditTransfers', p_transaction -> 'assetTransfers',
    p_transaction -> 'taxCharges', p_transaction -> 'facts',
    p_idempotency_key, v_result, p_now
  );

  return v_result;
end;
$$;

revoke all on function public.grid_open_fixed_price_property_listing(
  uuid, text, uuid, uuid, bigint, timestamptz, timestamptz,
  bigint, bigint, bigint, bigint, bigint, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_open_fixed_price_property_listing(
  uuid, text, uuid, uuid, bigint, timestamptz, timestamptz,
  bigint, bigint, bigint, bigint, bigint, text, timestamptz
) to service_role;

revoke all on function public.grid_cancel_fixed_price_property_listing(
  uuid, text, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_cancel_fixed_price_property_listing(
  uuid, text, uuid, text, timestamptz
) to service_role;

revoke all on function public.grid_settle_market_transaction(
  uuid, jsonb, integer, bigint, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_settle_market_transaction(
  uuid, jsonb, integer, bigint, text, timestamptz
) to service_role;
