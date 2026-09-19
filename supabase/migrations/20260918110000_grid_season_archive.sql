-- THE GRID: season conclusion and permanent archive boundary.
-- Freezes final standings, resolves safe end-of-season commitments, writes
-- permanent Passport events, and marks the season archived atomically.

create table public.grid_season_archives (
  season_id uuid primary key references public.grid_seasons(id) on delete restrict,
  city_id uuid not null references public.grid_cities(id) on delete restrict,
  archived_at timestamptz not null,
  champion_player_id uuid references public.players(id) on delete restrict,
  standings_count integer not null check (standings_count >= 0),
  created_at timestamptz not null default now(),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete restrict
);

create table public.grid_season_final_standings (
  season_id uuid not null references public.grid_seasons(id) on delete restrict,
  city_id uuid not null references public.grid_cities(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  final_rank integer not null check (final_rank > 0),
  city_power_bps integer not null check (city_power_bps between 0 and 10000),
  grid_rating integer not null check (grid_rating between 0 and 10000),
  total_xp bigint not null check (total_xp >= 0),
  city_power_breakdown jsonb not null
    check (jsonb_typeof(city_power_breakdown) = 'array'),
  archived_at timestamptz not null,
  primary key (season_id, player_id),
  unique (season_id, final_rank),
  foreign key (season_id, city_id)
    references public.grid_seasons(id, city_id) on delete restrict
);

create index grid_season_final_standings_rank_idx
  on public.grid_season_final_standings (season_id, final_rank);

alter table public.grid_season_archives enable row level security;
alter table public.grid_season_final_standings enable row level security;

revoke insert, update, delete on public.grid_season_archives
  from anon, authenticated;
revoke insert, update, delete on public.grid_season_final_standings
  from anon, authenticated;

create or replace function public.grid_archive_season(
  p_season_id uuid,
  p_standings jsonb,
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
  v_city public.grid_cities%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_archive_event_id uuid;
  v_entry jsonb;
  v_ordinality bigint;
  v_player_id uuid;
  v_final_rank integer;
  v_city_power_bps integer;
  v_grid_rating integer;
  v_total_xp bigint;
  v_breakdown jsonb;
  v_joined_count integer;
  v_standings_count integer;
  v_champion_player_id uuid;
  v_auction record;
  v_listing record;
  v_deal record;
  v_contract record;
  v_territory record;
  v_cancelled_listings integer := 0;
  v_cancelled_deals integer := 0;
  v_settled_auctions integer := 0;
  v_expired_contracts integer := 0;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_now is null then
    raise exception 'COMMAND_TIME_REQUIRED';
  end if;
  if p_standings is null or jsonb_typeof(p_standings) <> 'array' then
    raise exception 'SEASON_ARCHIVE_STANDINGS_REQUIRED';
  end if;

  select * into v_existing_event
    from public.grid_game_events
   where season_id = p_season_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing_event.event_type <> 'grid:season_archived'
       or v_existing_event.entity_id is distinct from p_season_id then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return v_existing_event.payload ||
      jsonb_build_object('eventId', v_existing_event.id);
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;

  if not found then raise exception 'SEASON_NOT_FOUND'; end if;
  if v_season.status = 'archived' then
    raise exception 'SEASON_ALREADY_ARCHIVED';
  end if;
  if v_season.status not in ('active', 'surge', 'complete') then
    raise exception 'SEASON_ARCHIVE_STATUS_INVALID';
  end if;
  if v_season.ends_at is null then
    raise exception 'SEASON_ARCHIVE_END_TIME_REQUIRED';
  end if;
  if p_now < v_season.ends_at then
    raise exception 'SEASON_ARCHIVE_TOO_EARLY';
  end if;

  select * into v_city
    from public.grid_cities
   where id = v_season.city_id;
  if not found then raise exception 'CITY_NOT_FOUND'; end if;

  if exists (
    select 1 from public.grid_contests
     where season_id = p_season_id and status = 'active'
  ) then
    raise exception 'SEASON_ARCHIVE_ACTIVE_PVP_CONTESTS';
  end if;

  if exists (
    select 1 from public.grid_pve_stronghold_contests
     where season_id = p_season_id and status = 'active'
  ) then
    raise exception 'SEASON_ARCHIVE_ACTIVE_PVE_CONTESTS';
  end if;

  if exists (
    select 1 from public.grid_contract_reward_outbox
     where season_id = p_season_id and processed_at is null
  ) then
    raise exception 'SEASON_ARCHIVE_PENDING_CONTRACT_REWARDS';
  end if;
  -- Auction scheduling already constrains ends_at to the season window.
  -- At season end every scheduled/open auction is therefore safe to settle.
  for v_auction in
    select id
      from public.grid_property_auctions
     where season_id = p_season_id
       and status in ('scheduled', 'open')
     order by ends_at, id
     for update
  loop
    perform public.grid_settle_property_auction(
      v_auction.id,
      'season-archive-auction:' || p_season_id::text || ':' || v_auction.id::text,
      p_now
    );
    v_settled_auctions := v_settled_auctions + 1;
  end loop;

  -- Fixed-price listings and direct deals hold no escrow. Cancel through their
  -- existing command functions so the immutable event ledger remains complete.
  for v_listing in
    select listing_id, seller_player_id
      from public.grid_market_fixed_price_listings
     where season_id = p_season_id
       and status = 'open'
     order by listing_id
     for update
  loop
    perform public.grid_cancel_fixed_price_property_listing(
      p_season_id,
      v_listing.listing_id,
      v_listing.seller_player_id,
      'season-archive-listing:' || p_season_id::text || ':' || v_listing.listing_id,
      p_now
    );
    v_cancelled_listings := v_cancelled_listings + 1;
  end loop;

  for v_deal in
    select proposal_id, proposer_player_id
      from public.grid_direct_deal_proposals
     where season_id = p_season_id
       and status = 'open'
     order by proposal_id
     for update
  loop
    perform public.grid_cancel_direct_deal_proposal(
      p_season_id,
      v_deal.proposal_id,
      v_deal.proposer_player_id,
      'season-archive-deal:' || p_season_id::text || ':' || v_deal.proposal_id,
      p_now
    );
    v_cancelled_deals := v_cancelled_deals + 1;
  end loop;

  -- Active contracts cannot continue beyond an archived season.
  for v_contract in
    select id, player_id, contract_id
      from public.grid_contract_instances
     where season_id = p_season_id
       and status = 'active'
     order by id
     for update
  loop
    update public.grid_contract_instances
       set status = 'expired',
           updated_at = p_now
     where id = v_contract.id;

    insert into public.grid_game_events (
      city_id, season_id, actor_player_id, event_type, entity_type,
      entity_id, payload, idempotency_key, created_at
    ) values (
      v_season.city_id,
      p_season_id,
      v_contract.player_id,
      'grid:contract_expired',
      'contract',
      v_contract.id,
      jsonb_build_object(
        'contractId', v_contract.contract_id,
        'reason', 'season-ended'
      ),
      'season-archive-contract:' || p_season_id::text || ':' || v_contract.id::text,
      p_now
    );
    v_expired_contracts := v_expired_contracts + 1;
  end loop;

  select count(*)::integer into v_joined_count
    from public.grid_player_season_state
   where season_id = p_season_id;

  v_standings_count := jsonb_array_length(p_standings);
  if v_standings_count <> v_joined_count then
    raise exception 'SEASON_ARCHIVE_STANDINGS_COUNT_MISMATCH';
  end if;

  for v_entry, v_ordinality in
    select value, ordinality
      from jsonb_array_elements(p_standings) with ordinality
  loop
    begin
      v_player_id := (v_entry ->> 'playerId')::uuid;
      v_final_rank := (v_entry ->> 'finalRank')::integer;
      v_city_power_bps := (v_entry ->> 'cityPowerBps')::integer;
      v_grid_rating := (v_entry ->> 'gridRating')::integer;
      v_total_xp := (v_entry ->> 'totalXp')::bigint;
      v_breakdown := v_entry -> 'cityPowerBreakdown';
    exception when others then
      raise exception 'SEASON_ARCHIVE_STANDING_INVALID';
    end;

    if v_final_rank <> v_ordinality::integer then
      raise exception 'SEASON_ARCHIVE_RANK_SEQUENCE_INVALID';
    end if;
    if v_city_power_bps < 0 or v_city_power_bps > 10000
       or v_grid_rating < 0 or v_grid_rating > 10000
       or v_total_xp < 0
       or v_breakdown is null
       or jsonb_typeof(v_breakdown) <> 'array' then
      raise exception 'SEASON_ARCHIVE_STANDING_INVALID';
    end if;

    if not exists (
      select 1 from public.grid_player_season_state
       where season_id = p_season_id
         and player_id = v_player_id
    ) then
      raise exception 'SEASON_ARCHIVE_PLAYER_NOT_JOINED';
    end if;

    insert into public.grid_season_final_standings (
      season_id, city_id, player_id, final_rank,
      city_power_bps, grid_rating, total_xp,
      city_power_breakdown, archived_at
    ) values (
      p_season_id, v_season.city_id, v_player_id, v_final_rank,
      v_city_power_bps, v_grid_rating, v_total_xp,
      v_breakdown, p_now
    );

    update public.grid_player_season_state
       set city_power = v_city_power_bps,
           updated_at = p_now
     where season_id = p_season_id
       and player_id = v_player_id;

    insert into public.grid_game_events (
      city_id, season_id, actor_player_id, event_type, entity_type,
      entity_id, payload, idempotency_key, created_at
    ) values (
      v_season.city_id,
      p_season_id,
      v_player_id,
      'grid:passport_city_rank_recorded',
      'season',
      p_season_id,
      jsonb_build_object(
        'citySlug', v_city.slug,
        'rank', v_final_rank
      ),
      'season-archive-rank:' || p_season_id::text || ':' || v_player_id::text,
      p_now
    );

    if v_final_rank <= 3 then
      insert into public.grid_game_events (
        city_id, season_id, actor_player_id, event_type, entity_type,
        entity_id, payload, idempotency_key, created_at
      ) values (
        v_season.city_id,
        p_season_id,
        v_player_id,
        'grid:passport_seasonal_trophy_earned',
        'season',
        p_season_id,
        jsonb_build_object(
          'citySlug', v_city.slug,
          'seasonSlug', v_season.slug,
          'achievementId', v_season.slug || '-podium-' || v_final_rank::text,
          'label',
            case v_final_rank
              when 1 then v_season.name || ' Champion'
              when 2 then v_season.name || ' Runner-Up'
              else v_season.name || ' Third Place'
            end
        ),
        'season-archive-trophy:' || p_season_id::text || ':' || v_player_id::text,
        p_now
      );
    end if;

    if v_final_rank = 1 then
      v_champion_player_id := v_player_id;
      insert into public.grid_game_events (
        city_id, season_id, actor_player_id, event_type, entity_type,
        entity_id, payload, idempotency_key, created_at
      ) values (
        v_season.city_id,
        p_season_id,
        v_player_id,
        'grid:passport_championship_earned',
        'season',
        p_season_id,
        jsonb_build_object(
          'citySlug', v_city.slug,
          'seasonSlug', v_season.slug,
          'achievementId', v_season.slug || '-city-champion',
          'label', v_season.name || ' Champion'
        ),
        'season-archive-champion:' || p_season_id::text,
        p_now
      );
    end if;
  end loop;
  -- Record every territory held at the final whistle as permanent career history.
  for v_territory in
    select state.owner_player_id, state.territory_id, territory.slug
      from public.grid_season_territory_state state
      join public.grid_territories territory
        on territory.id = state.territory_id
       and territory.city_id = state.city_id
     where state.season_id = p_season_id
       and state.owner_player_id is not null
     order by state.territory_id
  loop
    insert into public.grid_game_events (
      city_id, season_id, actor_player_id, event_type, entity_type,
      entity_id, payload, idempotency_key, created_at
    ) values (
      v_season.city_id,
      p_season_id,
      v_territory.owner_player_id,
      'grid:passport_territory_control_recorded',
      'territory',
      v_territory.territory_id,
      jsonb_build_object(
        'citySlug', v_city.slug,
        'seasonSlug', v_season.slug,
        'territorySlug', v_territory.slug
      ),
      'season-archive-territory:' || p_season_id::text || ':' ||
        v_territory.territory_id::text,
      p_now
    );
  end loop;

  insert into public.grid_season_archives (
    season_id, city_id, archived_at, champion_player_id, standings_count
  ) values (
    p_season_id, v_season.city_id, p_now,
    v_champion_player_id, v_standings_count
  );

  update public.grid_seasons
     set status = 'archived',
         updated_at = p_now
   where id = p_season_id;

  insert into public.grid_game_events (
    city_id, season_id, event_type, entity_type,
    entity_id, payload, idempotency_key, created_at
  ) values (
    v_season.city_id,
    p_season_id,
    'grid:season_archived',
    'season',
    p_season_id,
    jsonb_build_object(
      'seasonId', p_season_id,
      'citySlug', v_city.slug,
      'seasonSlug', v_season.slug,
      'status', 'archived',
      'archivedAt', p_now,
      'standingsCount', v_standings_count,
      'championPlayerId', v_champion_player_id,
      'settledAuctions', v_settled_auctions,
      'cancelledListings', v_cancelled_listings,
      'cancelledDirectDeals', v_cancelled_deals,
      'expiredContracts', v_expired_contracts
    ),
    p_idempotency_key,
    p_now
  )
  returning id into v_archive_event_id;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'cityId', v_season.city_id,
    'status', 'archived',
    'archivedAt', p_now,
    'standingsCount', v_standings_count,
    'championPlayerId', v_champion_player_id,
    'eventId', v_archive_event_id
  );
end;
$$;

revoke all on function public.grid_archive_season(
  uuid, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_archive_season(
  uuid, jsonb, text, timestamptz
) to service_role;
