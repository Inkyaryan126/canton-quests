-- THE GRID: server-authoritative season lifecycle reconciliation.
-- Moves scheduled -> active -> surge -> complete from persisted timestamps.
-- Safe to call repeatedly; never regresses or archives a season.

create or replace function public.grid_reconcile_season_lifecycle(
  p_season_id uuid,
  p_surge_hours integer,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season public.grid_seasons%rowtype;
  v_previous_status text;
  v_desired_status text;
  v_surge_starts_at timestamptz;
  v_current_rank integer;
  v_desired_rank integer;
  v_event_id uuid;
  v_idempotency_key text;
begin
  if p_now is null then
    raise exception 'GRID_SEASON_LIFECYCLE_NOW_REQUIRED';
  end if;

  select * into v_season
    from public.grid_seasons
   where id = p_season_id
   for update;

  if not found then
    raise exception 'GRID_SEASON_LIFECYCLE_SEASON_NOT_FOUND';
  end if;

  v_previous_status := v_season.status;

  if v_previous_status in ('draft', 'complete', 'archived') then
    return jsonb_build_object(
      'seasonId', v_season.id,
      'previousStatus', v_previous_status,
      'status', v_previous_status,
      'changed', false,
      'duplicate', false,
      'eventId', null,
      'updatedAt', p_now
    );
  end if;

  if p_surge_hours is null or p_surge_hours <= 0 then
    raise exception 'GRID_SEASON_LIFECYCLE_SURGE_HOURS_INVALID';
  end if;
  if v_season.starts_at is null or v_season.ends_at is null then
    raise exception 'GRID_SEASON_LIFECYCLE_WINDOW_REQUIRED';
  end if;
  if v_season.starts_at >= v_season.ends_at then
    raise exception 'GRID_SEASON_LIFECYCLE_WINDOW_INVALID';
  end if;

  if v_season.surge_starts_at is not null then
    if v_season.surge_starts_at < v_season.starts_at
       or v_season.surge_starts_at >= v_season.ends_at then
      raise exception 'GRID_SEASON_LIFECYCLE_SURGE_START_INVALID';
    end if;
    v_surge_starts_at := v_season.surge_starts_at;
  else
    v_surge_starts_at := greatest(
      v_season.starts_at,
      v_season.ends_at - make_interval(hours => p_surge_hours)
    );
  end if;

  if p_now >= v_season.ends_at then
    v_desired_status := 'complete';
  elsif p_now >= v_surge_starts_at then
    v_desired_status := 'surge';
  elsif p_now >= v_season.starts_at then
    v_desired_status := 'active';
  else
    v_desired_status := 'scheduled';
  end if;

  v_current_rank := case v_previous_status
    when 'scheduled' then 1
    when 'active' then 2
    when 'surge' then 3
    when 'complete' then 4
    when 'archived' then 5
    else 0
  end;

  v_desired_rank := case v_desired_status
    when 'scheduled' then 1
    when 'active' then 2
    when 'surge' then 3
    when 'complete' then 4
    else 0
  end;

  if v_desired_rank <= v_current_rank then
    return jsonb_build_object(
      'seasonId', v_season.id,
      'previousStatus', v_previous_status,
      'status', v_previous_status,
      'changed', false,
      'duplicate', false,
      'eventId', null,
      'updatedAt', p_now
    );
  end if;

  v_idempotency_key :=
    'season-lifecycle:' || v_season.id::text || ':' || v_desired_status;

  select id into v_event_id
    from public.grid_game_events
   where season_id = v_season.id
     and idempotency_key = v_idempotency_key;

  if found then
    if v_season.status <> v_desired_status then
      raise exception 'GRID_SEASON_LIFECYCLE_REPLAY_STATE_MISMATCH';
    end if;
    return jsonb_build_object(
      'seasonId', v_season.id,
      'previousStatus', v_previous_status,
      'status', v_desired_status,
      'changed', false,
      'duplicate', true,
      'eventId', v_event_id,
      'updatedAt', p_now
    );
  end if;

  update public.grid_seasons
     set status = v_desired_status,
         updated_at = p_now
   where id = v_season.id;

  insert into public.grid_game_events (
    city_id,
    season_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    created_at
  ) values (
    v_season.city_id,
    v_season.id,
    'grid:season_status_reconciled',
    'season',
    v_season.id,
    jsonb_build_object(
      'previousStatus', v_previous_status,
      'status', v_desired_status,
      'startsAt', v_season.starts_at,
      'surgeStartsAt', v_surge_starts_at,
      'endsAt', v_season.ends_at,
      'reconciledAt', p_now
    ),
    v_idempotency_key,
    p_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'seasonId', v_season.id,
    'previousStatus', v_previous_status,
    'status', v_desired_status,
    'changed', true,
    'duplicate', false,
    'eventId', v_event_id,
    'updatedAt', p_now
  );
end;
$$;

revoke all on function public.grid_reconcile_season_lifecycle(
  uuid, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.grid_reconcile_season_lifecycle(
  uuid, integer, timestamptz
) to service_role;
