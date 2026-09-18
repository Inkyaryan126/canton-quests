-- GRID Contest takeover persistence.
-- Additive local-first migration. Do not apply to production without a separate approval gate.
--
-- Contest capture events are the authoritative boundary for takeover damage.
-- This deliberately does not trigger on arbitrary territory-owner changes, so
-- future trades, admin repairs, and other non-contest transfers are unaffected.

create or replace function public.grid_apply_takeover_damage_from_capture_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_territory_id uuid;
  v_defender_player_id uuid;
  v_policy jsonb;
  v_retention_bps integer := 10000;
  v_condition_damage_bps integer := 0;
  v_condition_floor_bps integer := 0;
  v_property record;
  v_next_level integer;
  v_next_condition integer;
  v_properties_transferred integer := 0;
  v_development_levels_lost integer := 0;
  v_condition_lost_bps integer := 0;
begin
  if new.event_type = 'grid:contest_session_round_resolved' then
    if not coalesce((new.payload ->> 'territoryCaptured')::boolean, false) then
      return new;
    end if;

    select contest.target_territory_id, contest.defender_player_id
      into v_target_territory_id, v_defender_player_id
      from public.grid_contests contest
     where contest.id = new.entity_id
       and contest.season_id = new.season_id;

    if not found then
      raise exception 'TAKEOVER_DAMAGE_CONTEST_NOT_FOUND';
    end if;
  elsif new.event_type = 'grid:contest_auto_retreat_capture' then
    v_target_territory_id := new.entity_id;
    v_defender_player_id :=
      nullif(new.payload ->> 'defenderPlayerId', '')::uuid;
  else
    return new;
  end if;

  if new.season_id is null
     or new.actor_player_id is null
     or v_target_territory_id is null
     or v_defender_player_id is null then
    raise exception 'TAKEOVER_DAMAGE_CAPTURE_CONTEXT_INVALID';
  end if;
  select season.config -> 'contest' -> 'takeoverDamage'
    into v_policy
    from public.grid_seasons season
   where season.id = new.season_id
     and season.city_id = new.city_id;

  if not found then
    raise exception 'TAKEOVER_DAMAGE_SEASON_NOT_FOUND';
  end if;

  -- Missing tuning is backward compatible: transfer property control without
  -- destructive damage. Cities opt into damage by providing all three fields.
  if v_policy is not null then
    if jsonb_typeof(v_policy) <> 'object'
       or coalesce(v_policy ->> 'developmentRetentionBps', '') !~ '^[0-9]+$'
       or coalesce(v_policy ->> 'conditionDamageBps', '') !~ '^[0-9]+$'
       or coalesce(v_policy ->> 'conditionFloorBps', '') !~ '^[0-9]+$' then
      raise exception 'TAKEOVER_DAMAGE_CONFIG_INVALID';
    end if;

    v_retention_bps :=
      (v_policy ->> 'developmentRetentionBps')::integer;
    v_condition_damage_bps :=
      (v_policy ->> 'conditionDamageBps')::integer;
    v_condition_floor_bps :=
      (v_policy ->> 'conditionFloorBps')::integer;
    if v_retention_bps not between 0 and 10000
       or v_condition_damage_bps not between 0 and 10000
       or v_condition_floor_bps not between 0 and 10000 then
      raise exception 'TAKEOVER_DAMAGE_CONFIG_INVALID';
    end if;
  end if;

  for v_property in
    select state.id,
           state.development_level,
           state.development_branch,
           state.condition_bps
      from public.grid_season_property_state state
      join public.grid_properties property
        on property.id = state.property_id
       and property.city_id = state.city_id
     where state.season_id = new.season_id
       and state.city_id = new.city_id
       and property.territory_id = v_target_territory_id
       and state.owner_player_id = v_defender_player_id
     order by state.id
     for update of state
  loop
    v_next_level :=
      ((v_property.development_level::bigint * v_retention_bps) / 10000)::integer;
    v_next_condition := least(
      v_property.condition_bps,
      greatest(
        v_condition_floor_bps,
        v_property.condition_bps - v_condition_damage_bps
      )
    );

    update public.grid_season_property_state
       set owner_player_id = new.actor_player_id,
           acquired_at = new.created_at,
           development_level = v_next_level,
           development_branch = case
             when v_next_level = 0 then null
             else v_property.development_branch
           end,
           condition_bps = v_next_condition,
           updated_at = new.created_at
     where id = v_property.id;

    v_properties_transferred := v_properties_transferred + 1;
    v_development_levels_lost :=
      v_development_levels_lost
      + (v_property.development_level - v_next_level);
    v_condition_lost_bps :=
      v_condition_lost_bps
      + (v_property.condition_bps - v_next_condition);
  end loop;

  insert into public.grid_game_events (
    city_id,
    season_id,
    actor_player_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    correlation_id,
    causation_id,
    created_at
  ) values (
    new.city_id,
    new.season_id,
    new.actor_player_id,
    'grid:takeover_property_damage_applied',
    'territory',
    v_target_territory_id,
    jsonb_build_object(
      'sourceCaptureEventId', new.id,
      'defenderPlayerId', v_defender_player_id,
      'propertiesTransferred', v_properties_transferred,
      'developmentLevelsLost', v_development_levels_lost,
      'conditionLostBps', v_condition_lost_bps,
      'policy', jsonb_build_object(
        'developmentRetentionBps', v_retention_bps,
        'conditionDamageBps', v_condition_damage_bps,
        'conditionFloorBps', v_condition_floor_bps
      )
    ),
    'takeover-damage:' || new.id::text,
    new.correlation_id,
    new.id,
    new.created_at
  );

  return new;
end;
$$;

revoke all on function public.grid_apply_takeover_damage_from_capture_event()
  from public, anon, authenticated;

drop trigger if exists grid_game_events_apply_takeover_damage
  on public.grid_game_events;

create trigger grid_game_events_apply_takeover_damage
after insert on public.grid_game_events
for each row
when (
  new.event_type = 'grid:contest_session_round_resolved'
  or new.event_type = 'grid:contest_auto_retreat_capture'
)
execute function public.grid_apply_takeover_damage_from_capture_event();
