-- =============================================================================
-- Canton Quests Migration: Custom Avatar Selection + Public Image Default
-- Version: 20260824000000
-- Description: Allows a player's uploaded photo to be selected as their active
--              avatar (avatar_preset_key = 'custom') alongside the eight
--              numbered CQ presets, and flips the default player image
--              visibility to public so new players show their photo by default.
-- =============================================================================

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_avatar_preset_key_check,
  ADD CONSTRAINT players_avatar_preset_key_check
    CHECK (avatar_preset_key IS NULL OR avatar_preset_key IN ('1', '2', '3', '4', '5', '6', '7', '8', 'custom'));

ALTER TABLE public.players ALTER COLUMN player_image_visibility SET DEFAULT 'public';
