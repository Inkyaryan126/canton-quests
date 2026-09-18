-- Seasonless permanent Grid events need a separate uniqueness boundary because
-- PostgreSQL traditional unique indexes allow multiple NULL season_id values.
do $$
begin
  if exists (
    select 1
      from public.grid_game_events
     where season_id is null and idempotency_key is not null
     group by idempotency_key
    having count(*) > 1
  ) then
    raise exception 'GRID_GLOBAL_EVENT_IDEMPOTENCY_DUPLICATES_EXIST';
  end if;
end;
$$;

create unique index if not exists grid_game_events_global_idempotency_uq
  on public.grid_game_events (idempotency_key)
  where season_id is null and idempotency_key is not null;
