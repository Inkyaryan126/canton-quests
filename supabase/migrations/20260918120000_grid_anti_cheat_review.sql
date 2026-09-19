-- THE GRID: private, append-only anti-cheat evidence and human review queue.
-- This migration is additive. It records telemetry only and never changes player state.

create table public.grid_anti_cheat_assessments (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete restrict,
  season_id uuid not null references public.grid_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  action_id text not null check (char_length(btrim(action_id)) between 1 and 256),
  assessment_key text not null check (char_length(btrim(assessment_key)) between 1 and 256),
  risk_score_bps integer not null check (risk_score_bps between 0 and 10000),
  disposition text not null check (disposition in ('allow', 'monitor', 'review', 'reject-command')),
  signal_ids text[] not null default '{}',
  hard_reject_signal_ids text[] not null default '{}',
  assessment_snapshot jsonb not null check (jsonb_typeof(assessment_snapshot) = 'object'),
  signals_snapshot jsonb not null check (jsonb_typeof(signals_snapshot) = 'array'),
  created_at timestamptz not null,
  unique (city_id, season_id, assessment_key)
);

create table public.grid_anti_cheat_signals (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.grid_anti_cheat_assessments(id) on delete restrict,
  signal_id text not null check (char_length(btrim(signal_id)) between 1 and 256),
  signal_order integer not null check (signal_order >= 0),
  signal_kind text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence_bps integer not null check (confidence_bps between 0 and 10000),
  source text not null,
  reason_code text not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, signal_id),
  unique (assessment_id, signal_order)
);

create table public.grid_anti_cheat_reviews (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.grid_anti_cheat_assessments(id) on delete restrict,
  revision bigint not null check (revision > 0),
  status text not null check (status in ('pending', 'in-review', 'resolved')),
  resolution jsonb check (resolution is null or jsonb_typeof(resolution) = 'object'),
  created_at timestamptz not null default now(),
  unique (assessment_id, revision)
);

create index grid_anti_cheat_assessments_player_idx
  on public.grid_anti_cheat_assessments (player_id, season_id, created_at desc);
create index grid_anti_cheat_reviews_queue_idx
  on public.grid_anti_cheat_reviews (status, created_at desc);

alter table public.grid_anti_cheat_assessments enable row level security;
alter table public.grid_anti_cheat_signals enable row level security;
alter table public.grid_anti_cheat_reviews enable row level security;

revoke all on public.grid_anti_cheat_assessments from anon, authenticated;
revoke all on public.grid_anti_cheat_signals from anon, authenticated;
revoke all on public.grid_anti_cheat_reviews from anon, authenticated;

create or replace function public.grid_reject_anti_cheat_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'grid anti-cheat telemetry is append-only';
end;
$$;

create trigger grid_anti_cheat_assessments_immutable
before update or delete on public.grid_anti_cheat_assessments
for each row execute function public.grid_reject_anti_cheat_mutation();
create trigger grid_anti_cheat_signals_immutable
before update or delete on public.grid_anti_cheat_signals
for each row execute function public.grid_reject_anti_cheat_mutation();
create trigger grid_anti_cheat_reviews_immutable
before update or delete on public.grid_anti_cheat_reviews
for each row execute function public.grid_reject_anti_cheat_mutation();

create or replace function public.grid_record_anti_cheat_assessment(
  p_city_id uuid,
  p_season_id uuid,
  p_player_id uuid,
  p_action_id text,
  p_assessment_key text,
  p_risk_score_bps integer,
  p_disposition text,
  p_signal_ids text[],
  p_hard_reject_signal_ids text[],
  p_signals jsonb,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_assessment public.grid_anti_cheat_assessments%rowtype;
  v_inserted boolean := false;
  v_signal jsonb;
  v_index integer := 0;
begin
  if p_city_id is null or p_season_id is null or p_player_id is null then raise exception 'ANTI_CHEAT_SCOPE_REQUIRED'; end if;
  if p_action_id is null or char_length(btrim(p_action_id)) = 0 then raise exception 'ANTI_CHEAT_ACTION_REQUIRED'; end if;
  if p_assessment_key is null or char_length(btrim(p_assessment_key)) = 0 then raise exception 'ANTI_CHEAT_ASSESSMENT_KEY_REQUIRED'; end if;
  if p_created_at is null then raise exception 'ANTI_CHEAT_TIME_REQUIRED'; end if;
  if p_risk_score_bps is null or p_risk_score_bps not between 0 and 10000 then raise exception 'ANTI_CHEAT_SCORE_INVALID'; end if;
  if p_disposition not in ('allow', 'monitor', 'review', 'reject-command') then raise exception 'ANTI_CHEAT_DISPOSITION_INVALID'; end if;
  if jsonb_typeof(p_signals) <> 'array' then raise exception 'ANTI_CHEAT_SIGNALS_INVALID'; end if;
  if not exists (select 1 from public.grid_seasons where id = p_season_id and city_id = p_city_id) then raise exception 'ANTI_CHEAT_CITY_SEASON_MISMATCH'; end if;
  if not exists (select 1 from public.players where id = p_player_id) then raise exception 'ANTI_CHEAT_PLAYER_NOT_FOUND'; end if;

  insert into public.grid_anti_cheat_assessments (
    city_id, season_id, player_id, action_id, assessment_key, risk_score_bps,
    disposition, signal_ids, hard_reject_signal_ids, assessment_snapshot,
    signals_snapshot, created_at
  ) values (
    p_city_id, p_season_id, p_player_id, btrim(p_action_id), btrim(p_assessment_key),
    p_risk_score_bps, p_disposition, coalesce(p_signal_ids, '{}'),
    coalesce(p_hard_reject_signal_ids, '{}'),
    jsonb_build_object(
      'riskScoreBps', p_risk_score_bps, 'disposition', p_disposition,
      'signalIds', to_jsonb(coalesce(p_signal_ids, '{}')),
      'hardRejectSignalIds', to_jsonb(coalesce(p_hard_reject_signal_ids, '{}'))
    ), p_signals, p_created_at
  ) on conflict (city_id, season_id, assessment_key) do nothing
  returning * into v_assessment;

  if not found then
    select * into v_assessment
      from public.grid_anti_cheat_assessments
     where city_id = p_city_id and season_id = p_season_id and assessment_key = btrim(p_assessment_key)
     for update;
    if v_assessment.action_id <> btrim(p_action_id)
       or v_assessment.player_id <> p_player_id
       or v_assessment.risk_score_bps <> p_risk_score_bps
       or v_assessment.disposition <> p_disposition
       or v_assessment.signal_ids <> coalesce(p_signal_ids, '{}')
       or v_assessment.hard_reject_signal_ids <> coalesce(p_hard_reject_signal_ids, '{}')
       or v_assessment.signals_snapshot <> p_signals
       or v_assessment.created_at <> p_created_at then
       raise exception 'GRID_ANTI_CHEAT_ASSESSMENT_CONFLICT';
    end if;
    return jsonb_build_object(
      'assessmentId', v_assessment.id, 'idempotent', true,
      'assessment', v_assessment.assessment_snapshot
    );
  end if;

  for v_signal in select value from jsonb_array_elements(p_signals) loop
    insert into public.grid_anti_cheat_signals (
      assessment_id, signal_id, signal_order, signal_kind, severity,
      confidence_bps, source, reason_code, created_at
    ) values (
      v_assessment.id, v_signal ->> 'id', v_index, v_signal ->> 'kind',
      v_signal ->> 'severity', (v_signal ->> 'confidenceBps')::integer,
      v_signal ->> 'source', v_signal ->> 'reasonCode', p_created_at
    );
    v_index := v_index + 1;
  end loop;

  if p_disposition in ('monitor', 'review', 'reject-command') then
    insert into public.grid_anti_cheat_reviews (assessment_id, revision, status, created_at)
    values (v_assessment.id, 1, 'pending', p_created_at);
  end if;

  return jsonb_build_object(
    'assessmentId', v_assessment.id, 'idempotent', v_inserted,
    'assessment', v_assessment.assessment_snapshot
  );
end;
$$;

create or replace function public.grid_list_anti_cheat_review_queue(p_limit integer default 100)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(row_data order by created_at asc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'assessmentId', assessment.id, 'cityId', assessment.city_id,
        'seasonId', assessment.season_id, 'playerId', assessment.player_id,
        'actionId', assessment.action_id, 'assessmentKey', assessment.assessment_key,
        'assessment', assessment.assessment_snapshot,
        'signals', assessment.signals_snapshot, 'status', review.status,
        'resolution', review.resolution, 'createdAt', assessment.created_at,
        'reviewedAt', case when review.revision > 1 then review.created_at else null end
      ) as row_data, assessment.created_at
        from public.grid_anti_cheat_assessments assessment
        join lateral (
          select review.* from public.grid_anti_cheat_reviews review
           where review.assessment_id = assessment.id
           order by review.revision desc limit 1
        ) review on true
       where assessment.disposition in ('monitor', 'review', 'reject-command')
         and review.status <> 'resolved'
       order by assessment.created_at asc
       limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) queued;
$$;

create or replace function public.grid_record_anti_cheat_review(
  p_assessment_id uuid,
  p_status text,
  p_resolution jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_assessment public.grid_anti_cheat_assessments%rowtype;
  v_previous public.grid_anti_cheat_reviews%rowtype;
  v_revision bigint;
begin
  if p_assessment_id is null then raise exception 'ANTI_CHEAT_ASSESSMENT_REQUIRED'; end if;
  if p_status not in ('pending', 'in-review', 'resolved') then raise exception 'ANTI_CHEAT_REVIEW_STATUS_INVALID'; end if;
  if p_status = 'resolved' and (p_resolution is null or jsonb_typeof(p_resolution) <> 'object') then raise exception 'ANTI_CHEAT_RESOLUTION_REQUIRED'; end if;
  select * into v_assessment from public.grid_anti_cheat_assessments where id = p_assessment_id;
  if not found then raise exception 'ANTI_CHEAT_ASSESSMENT_NOT_FOUND'; end if;
  if v_assessment.disposition not in ('monitor', 'review', 'reject-command') then raise exception 'ANTI_CHEAT_ASSESSMENT_NOT_REVIEWABLE'; end if;
  select * into v_previous from public.grid_anti_cheat_reviews where assessment_id = p_assessment_id order by revision desc limit 1 for update;
  if v_previous.status = 'resolved' then raise exception 'ANTI_CHEAT_REVIEW_ALREADY_RESOLVED'; end if;
  if p_status = 'pending' and v_previous.status <> 'pending' then raise exception 'ANTI_CHEAT_REVIEW_TRANSITION_INVALID'; end if;
  v_revision := v_previous.revision + 1;
  insert into public.grid_anti_cheat_reviews (assessment_id, revision, status, resolution)
  values (p_assessment_id, v_revision, p_status, p_resolution);
  return jsonb_build_object(
    'assessmentId', v_assessment.id, 'cityId', v_assessment.city_id,
    'seasonId', v_assessment.season_id, 'playerId', v_assessment.player_id,
    'actionId', v_assessment.action_id, 'assessmentKey', v_assessment.assessment_key,
    'assessment', v_assessment.assessment_snapshot, 'signals', v_assessment.signals_snapshot,
    'status', p_status, 'resolution', p_resolution, 'createdAt', v_assessment.created_at,
    'reviewedAt', now()
  );
end;
$$;

revoke all on function public.grid_record_anti_cheat_assessment(uuid, uuid, uuid, text, text, integer, text, text[], text[], jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.grid_list_anti_cheat_review_queue(integer) from public, anon, authenticated;
revoke all on function public.grid_record_anti_cheat_review(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.grid_record_anti_cheat_assessment(uuid, uuid, uuid, text, text, integer, text, text[], text[], jsonb, timestamptz) to service_role;
grant execute on function public.grid_list_anti_cheat_review_queue(integer) to service_role;
grant execute on function public.grid_record_anti_cheat_review(uuid, text, jsonb) to service_role;
