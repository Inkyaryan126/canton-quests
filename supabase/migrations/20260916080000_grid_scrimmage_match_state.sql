-- GRID Scrimmage 5: isolated session-only combat state.
-- This state never writes Grid economy, ownership, XP, or rankings.

alter table public.grid_scrimmage_sessions
  add column match_state jsonb;

alter table public.grid_scrimmage_sessions
  add constraint grid_scrimmage_match_state_shape_ck
  check (
    match_state is null
    or jsonb_typeof(match_state) = 'object'
  );

alter table public.grid_scrimmage_sessions
  add constraint grid_scrimmage_active_match_state_ck
  check (
    status <> 'active'
    or match_state is not null
  );
