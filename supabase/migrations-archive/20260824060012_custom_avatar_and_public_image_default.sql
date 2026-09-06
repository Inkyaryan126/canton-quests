-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260824060012
-- Original recorded name:    custom_avatar_and_public_image_default

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_avatar_preset_key_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_avatar_preset_key_check
  CHECK (
    avatar_preset_key IS NULL
    OR avatar_preset_key = ANY (
      ARRAY['1'::text,'2'::text,'3'::text,'4'::text,'5'::text,'6'::text,'7'::text,'8'::text,'custom'::text]
    )
  );

ALTER TABLE public.players
  ALTER COLUMN player_image_visibility SET DEFAULT 'public'::text;
