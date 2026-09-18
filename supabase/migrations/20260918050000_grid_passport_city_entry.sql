-- GRID Passport 2: atomic permanent city-entry history.
-- City-local economy balances are deliberately untouched.

create or replace function public.grid_record_passport_city_entry(
  p_player_id uuid,
  p_city_id uuid,
  p_idempotency_key text,
  p_entered_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.grid_player_profiles%rowtype;
  v_existing_event public.grid_game_events%rowtype;
  v_event_id uuid;
  v_passport jsonb;
  v_stamps jsonb;
  v_existing_stamp jsonb;
  v_first_entered_at timestamptz;
  v_last_entered_at timestamptz;
  v_entry_count integer;
  v_entries_recorded bigint;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'PASSPORT_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_entered_at is null then
    raise exception 'PASSPORT_ENTERED_AT_REQUIRED';
  end if;

  perform 1 from public.grid_cities where id = p_city_id;
  if not found then
    raise exception 'PASSPORT_CITY_NOT_FOUND';
  end if;

  select *
    into v_profile
    from public.grid_player_profiles
   where player_id = p_player_id
   for update;

  if not found then
    raise exception 'PASSPORT_PROFILE_NOT_FOUND';
  end if;
  if v_profile.home_city_id is null then
    raise exception 'PASSPORT_HOME_CITY_REQUIRED';
  end if;

  select *
    into v_existing_event
    from public.grid_game_events
   where season_id is null
     and idempotency_key = p_idempotency_key
   limit 1;

  if found then
    if v_existing_event.actor_player_id is distinct from p_player_id
       or v_existing_event.city_id is distinct from p_city_id
       or v_existing_event.event_type <> 'grid:passport_city_entered' then
      raise exception 'PASSPORT_IDEMPOTENCY_KEY_REUSED';
    end if;

    return jsonb_build_object(
      'passport', v_profile.passport,
      'eventId', v_existing_event.id,
      'recorded', false
    );
  end if;

  v_passport := coalesce(v_profile.passport, '{}'::jsonb);
  if jsonb_typeof(v_passport) <> 'object' then
    raise exception 'PASSPORT_STATE_INVALID';
  end if;
  if v_passport ? 'version' and (v_passport ->> 'version')::integer <> 1 then
    raise exception 'PASSPORT_VERSION_UNSUPPORTED';
  end if;

  v_stamps := coalesce(v_passport -> 'stamps', '[]'::jsonb);
  if jsonb_typeof(v_stamps) <> 'array' then
    raise exception 'PASSPORT_STAMPS_INVALID';
  end if;

  select value
    into v_existing_stamp
    from jsonb_array_elements(v_stamps) value
   where value ->> 'cityId' = p_city_id::text
   limit 1;

  if found then
    if coalesce((v_existing_stamp ->> 'entryCount')::integer, 0) < 1 then
      raise exception 'PASSPORT_STAMP_COUNT_INVALID';
    end if;

    v_first_entered_at := least(
      (v_existing_stamp ->> 'firstEnteredAt')::timestamptz,
      p_entered_at
    );
    v_last_entered_at := greatest(
      (v_existing_stamp ->> 'lastEnteredAt')::timestamptz,
      p_entered_at
    );
    v_entry_count := (v_existing_stamp ->> 'entryCount')::integer + 1;

    select coalesce(
      jsonb_agg(
        case
          when item.value ->> 'cityId' = p_city_id::text then
            jsonb_build_object(
              'cityId', p_city_id::text,
              'firstEnteredAt', v_first_entered_at,
              'lastEnteredAt', v_last_entered_at,
              'entryCount', v_entry_count,
              'isHomeCity', p_city_id = v_profile.home_city_id
            )
          else item.value
        end
        order by item.ordinality
      ),
      '[]'::jsonb
    )
      into v_stamps
      from jsonb_array_elements(v_stamps) with ordinality as item(value, ordinality);
  else
    v_stamps := v_stamps || jsonb_build_array(
      jsonb_build_object(
        'cityId', p_city_id::text,
        'firstEnteredAt', p_entered_at,
        'lastEnteredAt', p_entered_at,
        'entryCount', 1,
        'isHomeCity', p_city_id = v_profile.home_city_id
      )
    );
  end if;

  -- Recalculate Home City markers and stable discovery order from canonical profile state.
  select coalesce(
    jsonb_agg(
      jsonb_set(
        item.value,
        '{isHomeCity}',
        to_jsonb((item.value ->> 'cityId') = v_profile.home_city_id::text),
        true
      )
      order by item.value ->> 'firstEnteredAt', item.value ->> 'cityId'
    ),
    '[]'::jsonb
  )
    into v_stamps
    from jsonb_array_elements(v_stamps) item(value);

  v_entries_recorded := coalesce((v_passport ->> 'entriesRecorded')::bigint, 0) + 1;
  v_passport := jsonb_set(v_passport, '{version}', '1'::jsonb, true);
  v_passport := jsonb_set(v_passport, '{homeCityId}', to_jsonb(v_profile.home_city_id::text), true);
  v_passport := jsonb_set(v_passport, '{citiesEntered}', to_jsonb(jsonb_array_length(v_stamps)), true);
  v_passport := jsonb_set(v_passport, '{entriesRecorded}', to_jsonb(v_entries_recorded), true);
  v_passport := jsonb_set(v_passport, '{stamps}', v_stamps, true);

  update public.grid_player_profiles
     set passport = v_passport,
         updated_at = greatest(updated_at, p_entered_at)
   where player_id = p_player_id;

  insert into public.grid_game_events (
    city_id,
    season_id,
    actor_player_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key,
    created_at
  ) values (
    p_city_id,
    null,
    p_player_id,
    'grid:passport_city_entered',
    'city',
    p_city_id,
    jsonb_build_object('enteredAt', p_entered_at),
    p_idempotency_key,
    p_entered_at
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'passport', v_passport,
    'eventId', v_event_id,
    'recorded', true
  );
end;
$$;

revoke all on function public.grid_record_passport_city_entry(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grid_record_passport_city_entry(uuid, uuid, text, timestamptz)
  to service_role;
