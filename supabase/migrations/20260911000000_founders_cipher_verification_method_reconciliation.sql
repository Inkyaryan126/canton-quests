-- Canton Quests — Founder's Cipher Master Launch Pivot: Production
-- Verification-Method Reconciliation
--
-- Direct production audit (read-only queries against the live
-- hdavnmvlnfhcaqjqwrwo project, 2026-09-10) found that editing
-- lib/seed-data.ts alone never touched the actual live game: production's
-- `quests` rows for 5 of the 14 canonical Founder's Cipher launch quests
-- still carry the pre-pivot GPS check-in configuration
-- (verification_type = 'checkin', require_location_verification = true,
-- radius_meters up to 600) with generic "Tap CHECK IN" instructions —
-- completely independent of anything the local TypeScript seed data says.
-- This migration reconciles those 5 production rows to the intended
-- environmental-observation / photo-evidence methods, matching
-- lib/seed-data.ts. It touches ONLY these 5 rows, matched by
-- (event_id, slug) on the real UNIQUE constraint — never by a TypeScript
-- qst-*/loc-* id, and never any Fair QR Hunt content.
--
-- IMPORTANT — separately confirmed during this same audit: the three
-- quests previously believed "NEEDS FIELD DETAIL" (challenge-the-tower,
-- golden-mark-cipher, spring-water-shelter) are NOT actually blockers.
-- Production already has them `status = 'active'` with a real target_code
-- already set — lib/seed-data.ts was simply stale (still `status: 'draft'`,
-- no hash, from an earlier phase never synced back after someone resolved
-- these directly against production). Their production target_code hashes
-- were independently verified against real, public, non-fabricated facts
-- before touching anything:
--   - golden-mark-cipher: proofDigest("1805") — Canton, Ohio's real,
--     historically documented founding year.
--   - spring-water-shelter: proofDigest("SPRING") — the real natural
--     spring feature the shelter is named for.
--   - challenge-the-tower: proofDigest("1954") — Mother Goose Land's real,
--     independently-verified opening year (multiple public sources:
--     Roadtrippers, Unicorn Hideout, Alexandra Charitan's blog all confirm
--     1954/1956; 1954 is the exact hash match, so that is confirmed correct,
--     not guessed).
-- These 3 rows are NOT modified by this migration — production is already
-- correct. Only lib/seed-data.ts and lib/quest-proof-secrets.ts (this same
-- commit) are updated to catch the local TypeScript source back up to
-- reality, so local dev/tests reflect what production actually plays.
--
-- Also updates the event's basic_instructions (step 3 said "Submit the
-- answer or tap CHECK IN" — Founder's Cipher no longer has any CHECK IN
-- step at all after this reconciliation).

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'canton-weekend-1 event not found — refusing to proceed';
  END IF;

  -- Canton Sign Capture: checkin -> photo (auto-verifies immediately, no
  -- moderation queue — see lib/game-engine.ts / lib/supabase-db.ts
  -- verifyAutomatedProof).
  UPDATE public.quests SET
    verification_type = 'photo',
    require_location_verification = false,
    instructions = 'Find the Canton sign at Centennial Plaza. Take a photo of yourself (or your callsign card) beside the sign, then upload it.',
    proof_requirement = 'Upload a photo of yourself or your callsign card beside the Canton sign at Centennial Plaza.'
  WHERE event_id = v_event_id AND slug = 'canton-sign-capture';

  -- Draft Lineup: checkin -> photo.
  UPDATE public.quests SET
    verification_type = 'photo',
    require_location_verification = false,
    instructions = 'Find the 1936 NFL Draft statues at Centennial Plaza. Take a photo from the line of scrimmage, then upload it.',
    proof_requirement = 'Upload a photo taken from the line-of-scrimmage angle of the 1936 NFL Draft statues.'
  WHERE event_id = v_event_id AND slug = 'draft-lineup';

  -- The 9th Street Signal: checkin -> real environmental-answer passphrase.
  -- The real on-site entrance sign (confirmed directly on the finished
  -- quest card, public/canton-quests/quests/challenge/skate_park.png) reads
  -- "9TH STREET SKATE PARK" — distinct wording from this location's own
  -- displayed name ("9th Street DIY Skate Park" in production), so the
  -- exact phrase can only be read by physically visiting.
  UPDATE public.quests SET
    verification_type = 'passphrase',
    require_location_verification = false,
    target_code = 'sha256:567a4c4fae9b068235d8434d93052e64e2c12a2e86d8a10eac0eb337905cbdf3', -- 9TH STREET SKATE PARK
    accepted_answer_variants = '["sha256:fbf5a269af7a54b2b1ff05d727f998d45cfa2a8e8b642694f8abf714ddacf65b"]'::jsonb, -- SKATE PARK
    instructions = 'Go to 9th Street DIY Skate Park at West Park. Find the entrance sign and read it exactly as painted. Enter the two words that come immediately after "9th Street."',
    proof_requirement = 'Enter the two words painted on the real entrance sign directly after "9th Street."'
  WHERE event_id = v_event_id AND slug = '9th-street-opening';

  -- The Open Ground: checkin -> photo. No real observable/countable
  -- feature has ever been evidenced for this field (see
  -- docs/FOUNDERS-CIPHER-14-QUEST-AUTHORING.md), so no environmental
  -- answer is invented — photo/witness proof removes the GPS dependency
  -- with zero fabricated content.
  UPDATE public.quests SET
    verification_type = 'photo',
    require_location_verification = false,
    instructions = 'Cross into the open field at West Park near 9th Street DIY. Take a photo of yourself (or your callsign card) standing in the field, then upload it.',
    proof_requirement = 'Upload a photo of yourself or your callsign card standing in the West Park open field.'
  WHERE event_id = v_event_id AND slug = 'challenge-open-ground';

  -- Willie the Whale: checkin -> photo (lib/seed-data.ts already had this
  -- as photo; production's row was simply never reconciled to match).
  UPDATE public.quests SET
    verification_type = 'photo',
    require_location_verification = false,
    instructions = 'Find Willie the Whale at Mother Goose Land. Get close enough to photograph the round opening on his side, then upload it.',
    proof_requirement = 'Upload a close-up photo clearly showing the round opening on Willie''s side.'
  WHERE event_id = v_event_id AND slug = 'willie-the-whale';

  -- Founder's Cipher no longer has any CHECK IN step at all — update the
  -- event's own basic_instructions to match (Fair QR Hunt has its own
  -- separate event row and is untouched).
  UPDATE public.events SET
    basic_instructions = '1. Start with the NEXT ASSIGNMENT shown on the Mission page.
2. Go to the listed public location and follow the short DO THIS instruction.
3. Submit your answer or evidence.
4. After completion, follow NEXT QUEST and keep collecting the Founder Locks and district cipher fragments.'
  WHERE slug = 'canton-weekend-1';
END $$;
