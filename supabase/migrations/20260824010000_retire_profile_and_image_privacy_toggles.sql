-- =============================================================================
-- Canton Quests Migration: Retire Profile & Player-Image Privacy Toggles
-- Version: 20260824010000
-- Description: Player profiles and player images are now always public —
--              the app no longer exposes a way to set either to 'private'.
--              This does not drop the columns (kept for compatibility and
--              to avoid unnecessary schema churn); it only normalizes any
--              legacy 'private' rows and re-asserts the public default.
-- =============================================================================

ALTER TABLE public.players ALTER COLUMN profile_visibility SET DEFAULT 'public';
ALTER TABLE public.players ALTER COLUMN player_image_visibility SET DEFAULT 'public';

UPDATE public.players
SET profile_visibility = 'public'
WHERE profile_visibility IS DISTINCT FROM 'public';

UPDATE public.players
SET player_image_visibility = 'public'
WHERE player_image_visibility IS DISTINCT FROM 'public';
