-- =============================================================================
-- Canton Quests Migration: Player Command Center Profile Fields
-- Version: 20260820000000
-- Description: Adds player card avatar/photo/privacy/featured BADGE metadata
--              and a private Supabase Storage bucket for authenticated player
--              profile images.
-- =============================================================================

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_preset_key TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_image_path TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_image_crop_zoom NUMERIC(4,2) DEFAULT 1.00;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_image_crop_x NUMERIC(5,2) DEFAULT 50.00;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_image_crop_y NUMERIC(5,2) DEFAULT 50.00;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS player_image_visibility TEXT DEFAULT 'private';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS featured_badge_slugs TEXT[] DEFAULT '{}';

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_avatar_preset_key_check,
  ADD CONSTRAINT players_avatar_preset_key_check
    CHECK (avatar_preset_key IS NULL OR avatar_preset_key IN ('1', '2', '3', '4', '5', '6', '7', '8'));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_profile_image_crop_zoom_check,
  ADD CONSTRAINT players_profile_image_crop_zoom_check
    CHECK (profile_image_crop_zoom >= 1 AND profile_image_crop_zoom <= 3);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_profile_image_crop_x_check,
  ADD CONSTRAINT players_profile_image_crop_x_check
    CHECK (profile_image_crop_x >= 0 AND profile_image_crop_x <= 100);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_profile_image_crop_y_check,
  ADD CONSTRAINT players_profile_image_crop_y_check
    CHECK (profile_image_crop_y >= 0 AND profile_image_crop_y <= 100);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_profile_visibility_check,
  ADD CONSTRAINT players_profile_visibility_check
    CHECK (profile_visibility IN ('public', 'private'));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_player_image_visibility_check,
  ADD CONSTRAINT players_player_image_visibility_check
    CHECK (player_image_visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_players_profile_visibility ON public.players(profile_visibility);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-profile-images',
  'player-profile-images',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Players can read own profile image objects" ON storage.objects;
CREATE POLICY "Players can read own profile image objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'player-profile-images'
    AND EXISTS (
      SELECT 1
      FROM public.players
      WHERE players.id::text = (storage.foldername(name))[1]
        AND players.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Players can insert own profile image objects" ON storage.objects;
CREATE POLICY "Players can insert own profile image objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-profile-images'
    AND EXISTS (
      SELECT 1
      FROM public.players
      WHERE players.id::text = (storage.foldername(name))[1]
        AND players.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Players can update own profile image objects" ON storage.objects;
CREATE POLICY "Players can update own profile image objects"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-profile-images'
    AND EXISTS (
      SELECT 1
      FROM public.players
      WHERE players.id::text = (storage.foldername(name))[1]
        AND players.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'player-profile-images'
    AND EXISTS (
      SELECT 1
      FROM public.players
      WHERE players.id::text = (storage.foldername(name))[1]
        AND players.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Players can delete own profile image objects" ON storage.objects;
CREATE POLICY "Players can delete own profile image objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-profile-images'
    AND EXISTS (
      SELECT 1
      FROM public.players
      WHERE players.id::text = (storage.foldername(name))[1]
        AND players.user_id = (select auth.uid())
    )
  );
