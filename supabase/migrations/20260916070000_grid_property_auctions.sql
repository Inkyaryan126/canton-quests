-- GRID Auction 2: server-authoritative property auction persistence.
-- Local-first only. Do not apply to production without explicit approval.

create table public.grid_property_auctions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  city_id uuid not null,
  property_id uuid not null,
  status text not null
    check (status in ('scheduled', 'open', 'settled', 'cancelled')),
  reserve_credits bigint not null check (reserve_credits >= 0),
  minimum_bid_increment_credits bigint not null
    check (minimum_bid_increment_credits > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  leading_bidder_player_id uuid references public.players(id) on delete set null,
  leading_bid_credits bigint check (leading_bid_credits is null or leading_bid_credits >= 0),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete cascade,
  foreign key (property_id, city_id)
    references public.grid_properties(id, city_id) on delete cascade,
  check (ends_at > starts_at)
);

create unique index grid_property_auctions_active_property_uq
  on public.grid_property_auctions (season_id, property_id)
  where status in ('scheduled', 'open');

create index grid_property_auctions_season_status_ends_idx
  on public.grid_property_auctions (season_id, status, ends_at);

create table public.grid_property_auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null
    references public.grid_property_auctions(id) on delete cascade,
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  property_id uuid not null references public.grid_properties(id) on delete cascade,
  bidder_player_id uuid not null references public.players(id) on delete restrict,
  amount_credits bigint not null check (amount_credits >= 0),
  credits_escrowed_delta bigint not null check (credits_escrowed_delta >= 0),
  previous_leader_player_id uuid references public.players(id) on delete set null,
  previous_leader_refunded_credits bigint not null default 0
    check (previous_leader_refunded_credits >= 0),
  created_at timestamptz not null default now()
);

create index grid_property_auction_bids_auction_created_idx
  on public.grid_property_auction_bids (auction_id, created_at, id);

alter table public.grid_property_auctions enable row level security;
alter table public.grid_property_auction_bids enable row level security;

revoke insert, update, delete on public.grid_property_auctions
  from anon, authenticated;
revoke insert, update, delete on public.grid_property_auction_bids
  from anon, authenticated;

create or replace function public.grid_guard_property_auction_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auction_id uuid;
  v_settlement_id text;
begin
  if new.owner_player_id is not distinct from old.owner_player_id
     or new.owner_player_id is null then
    return new;
  end if;

  select auction.id
    into v_auction_id
    from public.grid_property_auctions auction
   where auction.season_id = new.season_id
     and auction.property_id = new.property_id
     and auction.status in ('scheduled', 'open')
   order by auction.created_at, auction.id
   limit 1;

  if not found then
    return new;
  end if;

  v_settlement_id := current_setting('grid.auction_settlement_id', true);
  if v_settlement_id is null or v_settlement_id <> v_auction_id::text then
    raise exception 'PROPERTY_AUCTION_ACTIVE';
  end if;

  return new;
end;
$$;

create trigger grid_season_property_state_auction_guard
before update of owner_player_id on public.grid_season_property_state
for each row
execute function public.grid_guard_property_auction_ownership();

create or replace function public.grid_schedule_property_auction(
  p_season_id uuid,
  p_property_id uuid,
  p_reserve_credits bigint,
  p_minimum_bid_increment_credits bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
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
  v_property_state public.grid_season_property_state%rowtype;
  v_auction public.grid_property_auctions%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_status text;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_reserve_credits < 0 then
    raise exception 'AUCTION_RESERVE_INVALID';
  end if;
  if p_minimum_bid_increment_credits <= 0 then
    raise exception 'AUCTION_INCREMENT_INVALID';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'AUCTION_WINDOW_INVALID';
  end if;
  if p_now >= p_ends_at then
    raise exception 'AUCTION_ALREADY_ENDED';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:auction_scheduled'
       or v_existing_event.entity_id is distinct from p_property_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;

    return v_existing_event.payload || jsonb_build_object(
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
  if (v_season.starts_at is not null and p_starts_at < v_season.starts_at)
     or (v_season.ends_at is not null and p_ends_at > v_season.ends_at) then
    raise exception 'AUCTION_OUTSIDE_SEASON_WINDOW';
  end if;

  select *
    into v_property
    from public.grid_properties
   where id = p_property_id
   for update;

  if not found then
    raise exception 'PROPERTY_NOT_FOUND';
  end if;
  if v_property.city_id <> v_season.city_id then
    raise exception 'PROPERTY_WRONG_CITY';
  end if;

  insert into public.grid_season_property_state (
    season_id, city_id, property_id, owner_player_id, acquired_at,
    development_branch, development_level, condition_bps,
    created_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_property_id, null, null,
    null, 0, 10000, p_now, p_now
  )
  on conflict (season_id, property_id) do nothing;

  select *
    into v_property_state
    from public.grid_season_property_state
   where season_id = p_season_id
     and property_id = p_property_id
   for update;

  if v_property_state.owner_player_id is not null then
    raise exception 'PROPERTY_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
      from public.grid_property_auctions auction
     where auction.season_id = p_season_id
       and auction.property_id = p_property_id
       and auction.status in ('scheduled', 'open')
  ) then
    raise exception 'PROPERTY_AUCTION_ACTIVE';
  end if;

  v_status := case when p_now >= p_starts_at then 'open' else 'scheduled' end;
  insert into public.grid_property_auctions (
    season_id, city_id, property_id, status,
    reserve_credits, minimum_bid_increment_credits,
    starts_at, ends_at, created_at, updated_at
  ) values (
    p_season_id, v_season.city_id, p_property_id, v_status,
    p_reserve_credits, p_minimum_bid_increment_credits,
    p_starts_at, p_ends_at, p_now, p_now
  )
  returning * into v_auction;

  insert into public.grid_game_events (
    city_id, season_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id, p_season_id,
    'grid:auction_scheduled', 'property', p_property_id,
    jsonb_build_object(
      'auctionId', v_auction.id,
      'seasonId', p_season_id,
      'cityId', v_season.city_id,
      'propertyId', p_property_id,
      'status', v_status,
      'reserveCredits', p_reserve_credits,
      'minimumBidIncrementCredits', p_minimum_bid_increment_credits,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'auctionId', v_auction.id,
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'propertyId', p_property_id,
    'status', v_status,
    'reserveCredits', p_reserve_credits,
    'minimumBidIncrementCredits', p_minimum_bid_increment_credits,
    'startsAt', p_starts_at,
    'endsAt', p_ends_at,
    'eventId', v_event_id
  );
end;
$$;
create or replace function public.grid_place_property_auction_bid(
  p_auction_id uuid,
  p_player_id uuid,
  p_amount_credits bigint,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auction public.grid_property_auctions%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_player_state public.grid_player_season_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_previous_leader uuid;
  v_previous_bid bigint;
  v_minimum_bid bigint;
  v_escrow_delta bigint;
  v_refund bigint := 0;
  v_event_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_amount_credits < 0 then
    raise exception 'AUCTION_BID_INVALID';
  end if;

  select *
    into v_auction
    from public.grid_property_auctions
   where id = p_auction_id
   for update;
  if not found then
    raise exception 'AUCTION_NOT_FOUND';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = v_auction.season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:auction_bid_placed'
       or v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.entity_id is distinct from p_auction_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object(
      'eventId', v_existing_event.id
    );
  end if;

  if v_auction.status not in ('scheduled', 'open') then
    raise exception 'AUCTION_NOT_OPEN';
  end if;
  if p_now < v_auction.starts_at or p_now >= v_auction.ends_at then
    raise exception 'AUCTION_OUTSIDE_BID_WINDOW';
  end if;

  if v_auction.status = 'scheduled' then
    update public.grid_property_auctions
       set status = 'open', updated_at = p_now
     where id = p_auction_id;
    v_auction.status := 'open';
  end if;

  select *
    into v_property_state
    from public.grid_season_property_state
   where season_id = v_auction.season_id
     and property_id = v_auction.property_id
   for update;
  if not found or v_property_state.owner_player_id is not null then
    raise exception 'PROPERTY_NOT_AVAILABLE';
  end if;

  if v_auction.leading_bid_credits is null then
    v_minimum_bid := v_auction.reserve_credits;
  else
    if v_auction.leading_bid_credits >
       9223372036854775807 - v_auction.minimum_bid_increment_credits then
      raise exception 'AUCTION_BID_OVERFLOW';
    end if;
    v_minimum_bid :=
      v_auction.leading_bid_credits + v_auction.minimum_bid_increment_credits;
  end if;

  if p_amount_credits < v_minimum_bid then
    raise exception 'AUCTION_BID_TOO_LOW';
  end if;

  perform public.grid_settle_player_resources(
    v_auction.season_id,
    p_player_id,
    'preauctionbid:' || p_idempotency_key,
    p_now
  );

  v_previous_leader := v_auction.leading_bidder_player_id;
  v_previous_bid := coalesce(v_auction.leading_bid_credits, 0);

  perform 1
    from public.grid_player_season_state
   where season_id = v_auction.season_id
     and player_id in (p_player_id, v_previous_leader)
   order by player_id
   for update;

  select *
    into v_player_state
    from public.grid_player_season_state
   where season_id = v_auction.season_id
     and player_id = p_player_id
   for update;
  if not found then
    raise exception 'PLAYER_NOT_JOINED';
  end if;

  if v_previous_leader is not distinct from p_player_id then
    v_escrow_delta := p_amount_credits - v_previous_bid;
  else
    v_escrow_delta := p_amount_credits;
  end if;

  if v_player_state.credits < v_escrow_delta then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.grid_player_season_state
     set credits = credits - v_escrow_delta,
         last_active_at = p_now,
         updated_at = p_now
   where id = v_player_state.id
  returning * into v_player_state;

  if v_previous_leader is not null
     and v_previous_leader is distinct from p_player_id then
    v_refund := v_previous_bid;

    update public.grid_player_season_state
       set credits = credits + v_refund,
           updated_at = p_now
     where season_id = v_auction.season_id
       and player_id = v_previous_leader;
    if not found then
      raise exception 'PREVIOUS_AUCTION_LEADER_NOT_JOINED';
    end if;
  end if;

  insert into public.grid_property_auction_bids (
    auction_id, season_id, city_id, property_id,
    bidder_player_id, amount_credits, credits_escrowed_delta,
    previous_leader_player_id, previous_leader_refunded_credits, created_at
  ) values (
    p_auction_id, v_auction.season_id, v_auction.city_id, v_auction.property_id,
    p_player_id, p_amount_credits, v_escrow_delta,
    v_previous_leader, v_refund, p_now
  );

  update public.grid_property_auctions
     set status = 'open',
         leading_bidder_player_id = p_player_id,
         leading_bid_credits = p_amount_credits,
         updated_at = p_now
   where id = p_auction_id;

  insert into public.grid_game_events (
    city_id, season_id, actor_player_id, event_type,
    entity_type, entity_id, payload, idempotency_key, created_at
  ) values (
    v_auction.city_id, v_auction.season_id, p_player_id,
    'grid:auction_bid_placed', 'auction', p_auction_id,
    jsonb_build_object(
      'auctionId', p_auction_id,
      'seasonId', v_auction.season_id,
      'propertyId', v_auction.property_id,
      'bidderPlayerId', p_player_id,
      'amountCredits', p_amount_credits,
      'creditsEscrowedDelta', v_escrow_delta,
      'creditsAfter', v_player_state.credits,
      'previousLeaderPlayerId', v_previous_leader,
      'previousLeaderRefundedCredits', v_refund
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'auctionId', p_auction_id,
    'seasonId', v_auction.season_id,
    'propertyId', v_auction.property_id,
    'bidderPlayerId', p_player_id,
    'amountCredits', p_amount_credits,
    'creditsAfter', v_player_state.credits,
    'previousLeaderPlayerId', v_previous_leader,
    'previousLeaderRefundedCredits', v_refund,
    'eventId', v_event_id
  );
end;
$$;

create or replace function public.grid_settle_property_auction(
  p_auction_id uuid,
  p_idempotency_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auction public.grid_property_auctions%rowtype;
  v_property_state public.grid_season_property_state%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_sold boolean;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;

  select *
    into v_auction
    from public.grid_property_auctions
   where id = p_auction_id
   for update;
  if not found then
    raise exception 'AUCTION_NOT_FOUND';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id = v_auction.season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:auction_settled'
       or v_existing_event.entity_id is distinct from p_auction_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload || jsonb_build_object(
      'eventId', v_existing_event.id
    );
  end if;

  if v_auction.status = 'cancelled' then
    raise exception 'AUCTION_CANCELLED';
  end if;
  if v_auction.status = 'settled' then
    raise exception 'AUCTION_ALREADY_SETTLED';
  end if;
  if p_now < v_auction.ends_at then
    raise exception 'AUCTION_NOT_ENDED';
  end if;

  select *
    into v_property_state
    from public.grid_season_property_state
   where season_id = v_auction.season_id
     and property_id = v_auction.property_id
   for update;
  if not found then
    raise exception 'PROPERTY_STATE_NOT_FOUND';
  end if;
  if v_property_state.owner_player_id is not null then
    raise exception 'PROPERTY_NOT_AVAILABLE';
  end if;

  v_sold := v_auction.leading_bidder_player_id is not null;

  if v_sold then
    perform set_config('grid.auction_settlement_id', v_auction.id::text, true);

    update public.grid_season_property_state
       set owner_player_id = v_auction.leading_bidder_player_id,
           acquired_at = p_now,
           updated_at = p_now
     where id = v_property_state.id
       and owner_player_id is null;
    if not found then
      raise exception 'PROPERTY_NOT_AVAILABLE';
    end if;
  end if;

  update public.grid_property_auctions
     set status = 'settled',
         settled_at = p_now,
         updated_at = p_now
   where id = p_auction_id;

  insert into public.grid_game_events (
    city_id, season_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_auction.city_id, v_auction.season_id,
    'grid:auction_settled', 'auction', p_auction_id,
    jsonb_build_object(
      'auctionId', p_auction_id,
      'seasonId', v_auction.season_id,
      'cityId', v_auction.city_id,
      'propertyId', v_auction.property_id,
      'sold', v_sold,
      'winnerPlayerId', v_auction.leading_bidder_player_id,
      'winningBidCredits', v_auction.leading_bid_credits,
      'settledAt', p_now
    ),
    p_idempotency_key, p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'auctionId', p_auction_id,
    'seasonId', v_auction.season_id,
    'cityId', v_auction.city_id,
    'propertyId', v_auction.property_id,
    'sold', v_sold,
    'winnerPlayerId', v_auction.leading_bidder_player_id,
    'winningBidCredits', v_auction.leading_bid_credits,
    'settledAt', p_now,
    'eventId', v_event_id
  );
end;
$$;

revoke all on function public.grid_schedule_property_auction(
  uuid, uuid, bigint, bigint, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_schedule_property_auction(
  uuid, uuid, bigint, bigint, timestamptz, timestamptz, text, timestamptz
) to service_role;

revoke all on function public.grid_place_property_auction_bid(
  uuid, uuid, bigint, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_place_property_auction_bid(
  uuid, uuid, bigint, text, timestamptz
) to service_role;

revoke all on function public.grid_settle_property_auction(
  uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.grid_settle_property_auction(
  uuid, text, timestamptz
) to service_role;
