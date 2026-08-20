-- =============================================================================
-- Canton Quests Migration: Enforce Featured BADGE Integrity
-- Version: 20260820193856
-- Description: Ensures Player ID Card featured BADGES are earned, unique,
--              ordered, and capped to the six live round card slots.
-- =============================================================================

UPDATE public.players
SET featured_badge_slugs = '{}'
WHERE featured_badge_slugs IS NULL;

CREATE OR REPLACE FUNCTION public.validate_player_featured_badges()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_slugs text[];
  requested_count integer;
  earned_count integer;
BEGIN
  SELECT COALESCE(array_agg(clean_slug), '{}')
  INTO normalized_slugs
  FROM (
    SELECT btrim(slug) AS clean_slug
    FROM unnest(COALESCE(NEW.featured_badge_slugs, '{}')) AS requested(slug)
    WHERE btrim(slug) <> ''
  ) cleaned;

  requested_count := COALESCE(array_length(normalized_slugs, 1), 0);

  IF requested_count > 6 THEN
    RAISE EXCEPTION 'Only six featured BADGES can fit on the Player ID Card.';
  END IF;

  IF requested_count <> (
    SELECT COUNT(DISTINCT slug)
    FROM unnest(normalized_slugs) AS requested(slug)
  ) THEN
    RAISE EXCEPTION 'Duplicate featured BADGES are not allowed.';
  END IF;

  SELECT COUNT(DISTINCT pa.achievement_slug)
  INTO earned_count
  FROM public.player_achievements pa
  JOIN unnest(normalized_slugs) AS requested(slug)
    ON requested.slug = pa.achievement_slug
  WHERE pa.player_id = NEW.id;

  IF earned_count <> requested_count THEN
    RAISE EXCEPTION 'Only earned BADGES can be featured.';
  END IF;

  NEW.featured_badge_slugs := normalized_slugs;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_player_featured_badges ON public.players;
CREATE TRIGGER trg_validate_player_featured_badges
  BEFORE INSERT OR UPDATE OF featured_badge_slugs ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_player_featured_badges();
