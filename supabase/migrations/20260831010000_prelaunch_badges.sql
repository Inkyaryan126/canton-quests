-- Canton Quests — Pre-launch badges
-- =================================================================
-- Three real, earnable-before-launch achievements, additive only (no
-- existing row touched). Mirrors the exact INSERT ... ON CONFLICT pattern
-- from the original achievements catalog seed
-- (20260814000000_player_identity_three_path_architecture.sql).
--
-- 'first-to-arrive' — granted the moment a player enters a known Canton
--   Quests Mission (event_players participation created), regardless of
--   whether the Mission has officially opened yet.
-- 'path-chosen'      — granted the moment a player's universal starting
--   path is first set.
-- 'field-ready'       — granted alongside the existing PROFILE_COMPLETION
--   XP reward (a real avatar selected), see
--   evaluateAndGrantProfileCompletionRewardDB in lib/supabase-db.ts.
--
-- All three are granted by app/api/game/operations/[slug]/enter/route.ts
-- and lib/supabase-db.ts respectively — see those files for the exact
-- trigger conditions. Idempotent per-player via player_achievements'
-- existing UNIQUE(player_id, achievement_slug) constraint; no new index
-- needed since these grants never route through reward_grants.

INSERT INTO public.achievements (id, slug, name, description, badge_symbol, category, rarity, district)
VALUES
  ('ach-first-to-arrive', 'first-to-arrive', 'First to Arrive', 'Entered a Canton Quests Mission and confirmed your permanent Player Identity — even before the Mission opened.', '🚩', 'exploration', 'common', NULL),
  ('ach-path-chosen', 'path-chosen', 'Path Chosen', 'Chose your starting path — Family, Challenge, or Secret — and locked it into your permanent Player Identity.', '🧭', 'path', 'common', NULL),
  ('ach-field-ready', 'field-ready', 'Field Ready', 'Completed your Player Identity setup with a real avatar. Geared up and ready for the field.', '🥾', 'exploration', 'common', NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  badge_symbol = EXCLUDED.badge_symbol,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  district = EXCLUDED.district;
