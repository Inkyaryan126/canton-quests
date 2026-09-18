-- THE GRID: privacy-safe, idempotent location-enhancement grant ledger.
-- Precise GPS values and measurement precision do not belong in this table.

create table if not exists public.grid_location_enhancement_claims (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rule_id text not null check (length(btrim(rule_id)) > 0),
  verification_id text not null check (length(btrim(verification_id)) > 0),
  benefit jsonb not null,
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  claimed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (season_id, player_id, idempotency_key)
);

create index if not exists grid_location_enhancement_claims_rule_idx
  on public.grid_location_enhancement_claims
    (season_id, player_id, rule_id, claimed_at desc);

alter table public.grid_location_enhancement_claims enable row level security;
revoke all on public.grid_location_enhancement_claims from anon, authenticated;

create or replace function public.grid_claim_location_enhancement(
  p_season_id uuid,
  p_player_id uuid,
  p_rule_id text,
  p_verification_id text,
  p_benefit jsonb,
  p_idempotency_key text,
  p_claimed_at timestamptz,
  p_max_claims integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.grid_location_enhancement_claims%rowtype;
  v_grant public.grid_location_enhancement_claims%rowtype;
  v_claim_count integer;
begin
  if length(btrim(coalesce(p_rule_id, ''))) = 0
     or length(btrim(coalesce(p_verification_id, ''))) = 0
     or length(btrim(coalesce(p_idempotency_key, ''))) = 0 then
    raise exception 'invalid Grid location enhancement claim';
  end if;

  if p_max_claims is not null and p_max_claims <= 0 then
    raise exception 'invalid Grid location enhancement max claims';
  end if;

  -- Serialize all location grants for one player/season so both idempotency
  -- and per-rule limits remain correct under concurrent requests.
  perform pg_advisory_xact_lock(
    hashtextextended(p_season_id::text || ':' || p_player_id::text, 0)
  );

  select *
    into v_existing
    from public.grid_location_enhancement_claims
   where season_id = p_season_id
     and player_id = p_player_id
     and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'grant', to_jsonb(v_existing)
    );
  end if;

  if p_max_claims is not null then
    select count(*)
      into v_claim_count
      from public.grid_location_enhancement_claims
     where season_id = p_season_id
       and player_id = p_player_id
       and rule_id = p_rule_id;

    if v_claim_count >= p_max_claims then
      return jsonb_build_object(
        'status', 'limit_reached',
        'grant', null
      );
    end if;
  end if;

  insert into public.grid_location_enhancement_claims (
    season_id,
    player_id,
    rule_id,
    verification_id,
    benefit,
    idempotency_key,
    claimed_at
  )
  values (
    p_season_id,
    p_player_id,
    btrim(p_rule_id),
    btrim(p_verification_id),
    p_benefit,
    btrim(p_idempotency_key),
    p_claimed_at
  )
  returning * into v_grant;

  return jsonb_build_object(
    'status', 'inserted',
    'grant', to_jsonb(v_grant)
  );
end;
$$;

revoke all on function public.grid_claim_location_enhancement(
  uuid, uuid, text, text, jsonb, text, timestamptz, integer
) from public, anon, authenticated;

grant execute on function public.grid_claim_location_enhancement(
  uuid, uuid, text, text, jsonb, text, timestamptz, integer
) to service_role;
