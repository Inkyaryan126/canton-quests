-- Canton Quests — Launch hot-path FK indexes
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations, version 20260820091206) — this
-- file did not previously exist in the repo; the change was applied
-- directly to production without ever being committed. Added here so a
-- fresh environment reconstruction matches production exactly. No
-- behavior change: purely additive indexes, all IF NOT EXISTS.
create index if not exists idx_host_broadcasts_event_id on public.host_broadcasts(event_id);
create index if not exists idx_audience_event_options_audience_event_id on public.audience_event_options(audience_event_id);
create index if not exists idx_audience_votes_option_event on public.audience_votes(option_id, audience_event_id);
create index if not exists idx_audience_votes_player_id on public.audience_votes(player_id);
create index if not exists idx_quest_submissions_quest_event on public.quest_submissions(quest_id, event_id);
create index if not exists idx_quest_submissions_team_id on public.quest_submissions(team_id);
create index if not exists idx_quests_location_id on public.quests(location_id);
create index if not exists idx_score_ledger_player_id on public.score_ledger(player_id);
create index if not exists idx_score_ledger_quest_id on public.score_ledger(quest_id);
create index if not exists idx_score_ledger_submission_id on public.score_ledger(submission_id);
create index if not exists idx_score_ledger_team_id on public.score_ledger(team_id);
create index if not exists idx_drawing_entry_ledger_player_id on public.drawing_entry_ledger(player_id);
create index if not exists idx_drawing_entry_ledger_submission_id on public.drawing_entry_ledger(submission_id);
create index if not exists idx_event_players_player_id on public.event_players(player_id);
create index if not exists idx_spectator_sessions_converted_player on public.spectator_sessions(converted_to_player_id);
