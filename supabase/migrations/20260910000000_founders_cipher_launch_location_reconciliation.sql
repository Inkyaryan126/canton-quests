-- Canton Quests — Founder's Cipher Launch Location Reconciliation
-- Migration: 20260910000000_founders_cipher_launch_location_reconciliation.sql
--
-- ONE authoritative reconciliation for the 14 canonical September launch
-- district quests (lib/finale.ts LAUNCH_DISTRICT_QUESTS): every quest gets
-- exactly one authoritative physical location, and quest.instructions never
-- duplicates or contradicts quest.location. Quest.instructions = WHAT TO
-- DO; quest.location = WHERE TO GO.
--
-- IMPORTANT FINDING FROM THIS RECONCILIATION PASS: repo-wide migration
-- history search found that 13 of the 14 canonical launch quests
-- (everything except mckinley-monument-year, which reuses a pre-existing
-- legacy slug/row from 20260814030000) have never actually been inserted
-- into the production `quests` table by any migration — they exist only in
-- lib/seed-data.ts's local-engine fixture data. This migration does NOT
-- create those missing quest rows (that is quest-content authoring, a
-- separate, much larger task, and explicitly out of scope for a location
-- reconciliation pass) — it only prepares the location infrastructure they
-- will need, and safely (idempotently) rebinds/corrects whichever of the
-- 14 quest rows already exist by slug. The UPDATE statements below no-op
-- for any quest slug not yet present, exactly as intended — they will
-- start taking effect the moment those quest rows are created by a
-- separate migration.
--
-- Sources used, per instruction not to invent coordinates:
--   1. lib/seed-data.ts (current reconciled TypeScript source of truth)
--   2. docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md (real field/photo
--      evidence audit — see doc for full citations)
--   3. Existing dedicated location rows in prior migrations
--      (20260814030000, 20260824030000)
--   4. This task's own brief, for the one address correction (Kraken
--      Wall) that reuses an already-migrated, already-verified location's
--      exact coordinates rather than inventing new ones.
--
-- Every location is resolved-or-created by its stable NAME (public.locations
-- has no natural unique key to upsert on — same pattern already established
-- in 20260824030000). Every quest rebind matches on the real
-- UNIQUE(event_id, slug) constraint — never a qst-*/loc-* TypeScript id,
-- which do not exist in the production schema.

DO $$
DECLARE
  v_event_id UUID;
  v_city_id UUID;
  v_loc_bell UUID;
  v_loc_sign UUID;
  v_loc_draft UUID;
  v_loc_octopus UUID;
  v_loc_palace_stars UUID;
  v_loc_9th_street UUID;
  v_loc_challenge_field UUID;
  v_loc_challenge_tower UUID;
  v_loc_mother_goose UUID;
  v_loc_mckinley UUID;
  v_loc_jfk UUID;
  v_loc_golden_mark UUID;
  v_loc_spring_water UUID;
BEGIN
  SELECT id INTO v_event_id FROM public.events WHERE slug = 'canton-weekend-1';
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event canton-weekend-1 not found in public.events';
  END IF;

  SELECT city_id INTO v_city_id FROM public.events WHERE id = v_event_id;

  -- ==========================================================================
  -- 1. Resolve-or-create each dedicated location, by stable name.
  -- ==========================================================================

  -- Bicentennial Bell (bell-cipher) — UNRESOLVED coordinates. Per
  -- lib/seed-data.ts's loc-bicentennial-bell: no confirmed street address or
  -- GPS anywhere in the repo. Not invented here.
  SELECT id INTO v_loc_bell FROM public.locations WHERE name = 'Bicentennial Bell' LIMIT 1;
  IF v_loc_bell IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'Bicentennial Bell', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards.', false)
    RETURNING id INTO v_loc_bell;
  END IF;

  -- Canton Sign Sculpture (canton-sign-capture) — UNRESOLVED coordinates.
  SELECT id INTO v_loc_sign FROM public.locations WHERE name = 'Canton Sign Sculpture' LIMIT 1;
  IF v_loc_sign IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'Canton Sign Sculpture', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards.', false)
    RETURNING id INTO v_loc_sign;
  END IF;

  -- NFL Draft Plaza / 1936 NFL Draft Statues (draft-lineup) — UNRESOLVED
  -- coordinates. Explicitly the Centennial Plaza statue installation, NOT
  -- the 4th Street mural row.
  SELECT id INTO v_loc_draft FROM public.locations WHERE name = 'NFL Draft Plaza (1936 NFL Draft Statues)' LIMIT 1;
  IF v_loc_draft IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'NFL Draft Plaza (1936 NFL Draft Statues)', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards. Distinct real landmark from the Hall of Fame City Marker — do not conflate.', false)
    RETURNING id INTO v_loc_draft;
  END IF;

  -- Octopus Mural / Kraken Wall (kraken-wall) — address/coordinates now
  -- resolved per this task's brief, reusing the exact, already-migrated
  -- coordinates of the existing "4th Street Arts Corridor Mural" location
  -- (20260814030000) for the same 4th St NW & Court Ave NW corridor — a
  -- distinct mural (the Butterfly Mural) at that address already has its
  -- own row; this is a separate dedicated pin for the Kraken/Octopus wall,
  -- not a merge, since they are different physical artworks.
  SELECT id INTO v_loc_octopus FROM public.locations WHERE name = 'Octopus Mural (Kraken Wall)' LIMIT 1;
  IF v_loc_octopus IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'Octopus Mural (Kraken Wall)', '4th St NW & Court Ave NW, Canton, OH 44702', 40.7995, -81.3755,
      'Address per launch-location reconciliation task brief, reusing the existing 4th St NW & Court Ave NW corridor coordinates already verified for the nearby Butterfly Mural — same street corridor, distinct artwork.', false)
    RETURNING id INTO v_loc_octopus;
  ELSE
    UPDATE public.locations
    SET address = '4th St NW & Court Ave NW, Canton, OH 44702', latitude = 40.7995, longitude = -81.3755
    WHERE id = v_loc_octopus;
  END IF;

  -- Canton Palace Theatre (Star Motif) (palace-stars) — REAL, photo-verified
  -- address/coordinates already exist for this exact building
  -- ("Canton Palace Theatre", 20260814030000) — reused directly rather than
  -- creating a near-duplicate row for the same physical building.
  SELECT id INTO v_loc_palace_stars FROM public.locations WHERE name = 'Canton Palace Theatre' LIMIT 1;
  IF v_loc_palace_stars IS NULL THEN
    -- Defensive fallback only — should already exist from 20260814030000.
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner, radius_meters, access_notes, opening_hours)
    VALUES (v_city_id, 'Canton Palace Theatre', '605 Market Ave N, Canton, OH 44702', 40.8012, -81.3748,
      'Historic theater marquee and architectural gem of Canton. Real bronze Walk-of-Fame-style stars embedded in the public sidewalk on this block, confirmed via real field photography — see docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md.', true, 50,
      'Marquee visible from sidewalk 24/7.', '24/7 Outdoor Access')
    RETURNING id INTO v_loc_palace_stars;
  END IF;

  -- 9th Street Skate Corridor (9th-street-opening) — coordinates already
  -- established in lib/seed-data.ts (no FIELD VERIFICATION disclaimer,
  -- used live for real GPS check-in validation).
  SELECT id INTO v_loc_9th_street FROM public.locations WHERE name = '9th Street Skate Corridor' LIMIT 1;
  IF v_loc_9th_street IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner, radius_meters, access_notes, opening_hours)
    VALUES (v_city_id, '9th Street Skate Corridor', '9th St NW, Canton, OH 44703', 40.8060, -81.3870,
      'Urban skate corridor and open recreation area at the edge of the Challenge district.', false, 60,
      'Public outdoor space. Daylight hours recommended.', 'Dawn - Dusk')
    RETURNING id INTO v_loc_9th_street;
  END IF;

  -- Challenge Field (challenge-open-ground) — coordinates already
  -- established in lib/seed-data.ts, used live for real GPS check-in.
  SELECT id INTO v_loc_challenge_field FROM public.locations WHERE name = 'Challenge Field' LIMIT 1;
  IF v_loc_challenge_field IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner, radius_meters, access_notes, opening_hours)
    VALUES (v_city_id, 'Challenge Field', '9th St NW & Shriver Ave NW, Canton, OH 44703', 40.8058, -81.3866,
      'Large open field location from the Challenge Sector route.', false, 60,
      'Open public park field ground. Daylight hours recommended.', 'Dawn - Dusk')
    RETURNING id INTO v_loc_challenge_field;
  END IF;

  -- The Tower at Mother Goose Land (challenge-the-tower) — coordinates
  -- already established in lib/seed-data.ts.
  SELECT id INTO v_loc_challenge_tower FROM public.locations WHERE name = 'The Tower at Mother Goose Land' LIMIT 1;
  IF v_loc_challenge_tower IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner, radius_meters, access_notes, opening_hours)
    VALUES (v_city_id, 'The Tower at Mother Goose Land', '714 12th St NW, Canton, OH 44703', 40.8056, -81.3864,
      'Historic storybook silo/tower landmark standing over Mother Goose Land.', false, 60,
      'Open public park ground. Daylight hours recommended.', 'Dawn - Dusk')
    RETURNING id INTO v_loc_challenge_tower;
  END IF;

  -- Mother Goose Land (goose-land-cipher, willie-the-whale) — coordinates
  -- already established in lib/seed-data.ts. Shared by both quests, which
  -- are two distinct real features (the mural wall; the Willie sculpture)
  -- at the same park.
  SELECT id INTO v_loc_mother_goose FROM public.locations WHERE name = 'Mother Goose Land' LIMIT 1;
  IF v_loc_mother_goose IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner, radius_meters, access_notes, opening_hours)
    VALUES (v_city_id, 'Mother Goose Land', '714 12th St NW, Canton, OH 44703', 40.8055, -81.3862,
      'Historic Canton park featuring large illustrated mural walls and nostalgic storybook character landmarks.', false, 60,
      'Open public park. Daylight hours recommended. Check current seasonal operating status before visiting.', 'Dawn - Dusk (seasonal)')
    RETURNING id INTO v_loc_mother_goose;
  END IF;

  -- McKinley National Memorial (mckinley-monument-year) — already exists
  -- from 20260814030000 with real, confirmed coordinates. No change.
  SELECT id INTO v_loc_mckinley FROM public.locations WHERE name = 'McKinley National Memorial' LIMIT 1;

  -- John F. Kennedy Memorial Fountain / Eternal Flame (eternal-flame) —
  -- UNRESOLVED coordinates; a real, distinct, evidence-backed location per
  -- docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md (plaque legible, real photo)
  -- — deliberately NOT the generic McKinley Memorial location.
  SELECT id INTO v_loc_jfk FROM public.locations WHERE name = 'John F. Kennedy Memorial Fountain (Eternal Flame)' LIMIT 1;
  IF v_loc_jfk IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'John F. Kennedy Memorial Fountain (Eternal Flame)', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards. Real, distinct memorial location — not the McKinley National Memorial.', false)
    RETURNING id INTO v_loc_jfk;
  END IF;

  -- The Golden Mark / Canton Road (golden-mark-cipher) — UNRESOLVED
  -- coordinates; sole canonical Founder Lock THE MARK source, deliberately
  -- NOT the generic McKinley Memorial location.
  SELECT id INTO v_loc_golden_mark FROM public.locations WHERE name = 'The Golden Mark (Canton Road)' LIMIT 1;
  IF v_loc_golden_mark IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'The Golden Mark (Canton Road)', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards. Real, distinct sculpture/plaque location on Canton Road — not the McKinley National Memorial.', false)
    RETURNING id INTO v_loc_golden_mark;
  END IF;

  -- Spring Water Shelter / Fort Hill Park (spring-water-shelter) —
  -- UNRESOLVED coordinates; deliberately NOT the generic McKinley Memorial
  -- location.
  SELECT id INTO v_loc_spring_water FROM public.locations WHERE name = 'Spring Water Shelter (Fort Hill Park)' LIMIT 1;
  IF v_loc_spring_water IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (v_city_id, 'Spring Water Shelter (Fort Hill Park)', NULL, NULL, NULL,
      'FIELD VERIFICATION REQUIRED: exact street address and GPS coordinates not yet confirmed. Do not invent — confirm via site walk before printing final clue cards. Real, distinct pavilion at Fort Hill Park — not the McKinley National Memorial.', false)
    RETURNING id INTO v_loc_spring_water;
  END IF;

  -- ==========================================================================
  -- 2. Rebind each of the 14 canonical launch quests to its authoritative
  --    location, and strip any hardcoded street address duplicated inside
  --    instructions. Every UPDATE is scoped to (event_id, slug) and safely
  --    no-ops for any quest slug not yet present in production — see the
  --    finding at the top of this file. Only answers/XP/rewards/fragments/
  --    locks/verification types are left untouched; nothing here changes
  --    the columns not explicitly listed.
  -- ==========================================================================

  UPDATE public.quests SET location_id = v_loc_bell
    WHERE event_id = v_event_id AND slug = 'bell-cipher';

  UPDATE public.quests SET location_id = v_loc_sign
    WHERE event_id = v_event_id AND slug = 'canton-sign-capture';

  UPDATE public.quests SET location_id = v_loc_draft
    WHERE event_id = v_event_id AND slug = 'draft-lineup';

  UPDATE public.quests SET location_id = v_loc_octopus
    WHERE event_id = v_event_id AND slug = 'kraken-wall';

  UPDATE public.quests SET location_id = v_loc_palace_stars
    WHERE event_id = v_event_id AND slug = 'palace-stars';

  UPDATE public.quests
    SET location_id = v_loc_9th_street,
        instructions = 'Report to the 9th Street Skate Corridor and check in to activate your Challenge district field log. Tap CHECK IN when you are physically at the location. Your GPS will confirm the signal.'
    WHERE event_id = v_event_id AND slug = '9th-street-opening';

  UPDATE public.quests SET location_id = v_loc_challenge_field
    WHERE event_id = v_event_id AND slug = 'challenge-open-ground';

  UPDATE public.quests SET location_id = v_loc_challenge_tower
    WHERE event_id = v_event_id AND slug = 'challenge-the-tower';

  UPDATE public.quests
    SET location_id = v_loc_mother_goose,
        instructions = 'Go to Mother Goose Land. Find the large illustrated mural wall. One creature on it belongs somewhere much deeper than the rest. Find the one that should be surrounded by water. What is it?'
    WHERE event_id = v_event_id AND slug = 'goose-land-cipher';

  UPDATE public.quests SET location_id = v_loc_mother_goose
    WHERE event_id = v_event_id AND slug = 'willie-the-whale';

  UPDATE public.quests SET location_id = v_loc_mckinley
    WHERE event_id = v_event_id AND slug = 'mckinley-monument-year';

  UPDATE public.quests SET location_id = v_loc_jfk
    WHERE event_id = v_event_id AND slug = 'eternal-flame';

  UPDATE public.quests SET location_id = v_loc_golden_mark
    WHERE event_id = v_event_id AND slug = 'golden-mark-cipher';

  UPDATE public.quests SET location_id = v_loc_spring_water
    WHERE event_id = v_event_id AND slug = 'spring-water-shelter';

END $$;
