-- THE GRID: authoritative dynamic-event instance projection.
-- This table contains gameplay state, not player location data.

create table if not exists public.grid_dynamic_event_instances (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  instance_key text not null check (length(btrim(instance_key)) > 0),
  template_id text not null check (length(btrim(template_id)) > 0),
  kind text not null check (length(btrim(kind)) > 0),
  priority integer not null check (priority >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  target jsonb not null check (jsonb_typeof(target) = 'object'),
  modifiers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(modifiers) = 'array'),
  tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tags) = 'array'),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  unique (season_id, instance_key),
  unique (season_id, idempotency_key)
);

create index if not exists grid_dynamic_event_instances_active_idx
  on public.grid_dynamic_event_instances
    (season_id, starts_at, ends_at, priority desc);

alter table public.grid_dynamic_event_instances enable row level security;
revoke all on public.grid_dynamic_event_instances from anon, authenticated;

create or replace function public.grid_start_dynamic_event_instance(
  p_city_id uuid,
  p_season_id uuid,
  p_instance_key text,
  p_template_id text,
  p_kind text,
  p_priority integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_target jsonb,
  p_modifiers jsonb,
  p_tags jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_instance public.grid_dynamic_event_instances%rowtype;
begin
  if length(btrim(coalesce(p_instance_key, ''))) = 0
     or length(btrim(coalesce(p_template_id, ''))) = 0
     or length(btrim(coalesce(p_kind, ''))) = 0
     or length(btrim(coalesce(p_idempotency_key, ''))) = 0
     or p_priority < 0
     or p_ends_at <= p_starts_at
     or jsonb_typeof(p_target) <> 'object'
     or jsonb_typeof(p_modifiers) <> 'array'
     or jsonb_typeof(p_tags) <> 'array' then
    raise exception 'invalid Grid dynamic event instance';
  end if;

  if not exists (
    select 1
      from public.grid_seasons
     where id = p_season_id
       and city_id = p_city_id
  ) then
    raise exception 'Grid dynamic event season does not belong to city';
  end if;

  insert into public.grid_dynamic_event_instances (
    city_id,
    season_id,
    instance_key,
    template_id,
    kind,
    priority,
    starts_at,
    ends_at,
    target,
    modifiers,
    tags,
    idempotency_key
  )
  values (
    p_city_id,
    p_season_id,
    btrim(p_instance_key),
    btrim(p_template_id),
    btrim(p_kind),
    p_priority,
    p_starts_at,
    p_ends_at,
    p_target,
    p_modifiers,
    p_tags,
    btrim(p_idempotency_key)
  )
  on conflict (season_id, idempotency_key) do nothing
  returning * into v_instance;

  if not found then
    select *
      into v_instance
      from public.grid_dynamic_event_instances
     where season_id = p_season_id
       and idempotency_key = btrim(p_idempotency_key);

    return jsonb_build_object(
      'status', 'duplicate',
      'instance', to_jsonb(v_instance)
    );
  end if;

  insert into public.grid_game_events (
    city_id,
    season_id,
    actor_player_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key
  )
  values (
    p_city_id,
    p_season_id,
    null,
    'grid:dynamic_event_started',
    'dynamic_event',
    v_instance.id,
    jsonb_build_object(
      'instanceId', v_instance.instance_key,
      'templateId', v_instance.template_id,
      'kind', v_instance.kind,
      'priority', v_instance.priority,
      'startsAt', v_instance.starts_at,
      'endsAt', v_instance.ends_at,
      'target', v_instance.target,
      'modifiers', v_instance.modifiers,
      'tags', v_instance.tags
    ),
    'dynamic-event:' || btrim(p_idempotency_key)
  );

  return jsonb_build_object(
    'status', 'inserted',
    'instance', to_jsonb(v_instance)
  );
end;
$$;

revoke all on function public.grid_start_dynamic_event_instance(
  uuid, uuid, text, text, text, integer, timestamptz, timestamptz,
  jsonb, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.grid_start_dynamic_event_instance(
  uuid, uuid, text, text, text, integer, timestamptz, timestamptz,
  jsonb, jsonb, jsonb, text
) to service_role;
