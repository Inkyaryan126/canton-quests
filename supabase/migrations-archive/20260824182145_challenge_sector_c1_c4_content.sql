-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260824182145
-- Original recorded name:    challenge_sector_c1_c4_content

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS accepted_answer_variants JSONB,
  ADD COLUMN IF NOT EXISTS remote_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commander_transmission JSONB,
  ADD COLUMN IF NOT EXISTS sector_intro_transmission JSONB;

ALTER TABLE public.quest_steps
  ADD COLUMN IF NOT EXISTS accepted_answer_variants JSONB;

DO $$
DECLARE
  v_location_id UUID;
BEGIN
  SELECT id INTO v_location_id
  FROM public.locations
  WHERE name = 'Mother Goose Land / 9th Street Area'
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.locations (city_id, name, address, latitude, longitude, location_notes, is_partner)
    VALUES (
      (SELECT id FROM public.cities WHERE slug = 'canton-oh' LIMIT 1),
      'Mother Goose Land / 9th Street Area',
      NULL,
      NULL,
      NULL,
      'Challenge-sector Storybook chain (C1-C4). Public park, currently weathered/run-down compared with its original condition. Coordinates pending owner field verification — do not invent.',
      false
    );
  END IF;
END $$;

INSERT INTO public.quests (
  event_id, location_id, title, slug, description, instructions,
  point_value, xp_reward, drawing_entry_reward, difficulty, category,
  starting_path, verification_type, target_code, accepted_answer_variants,
  proof_requirement, is_flash, status, sort_order, radius_meters,
  remote_capable, reward_config, commander_transmission, sector_intro_transmission,
  safety_notes, gm_notes
)
VALUES (
  (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1),
  (SELECT id FROM public.locations WHERE name = 'Mother Goose Land / 9th Street Area' LIMIT 1),
  'The Blue Signal',
  'challenge-blue-signal',
  'Forgotten doesn''t mean finished. One painted whale survived long enough for you to notice it.',
  'The Mother Goose Land mural wall still carries a large blue creature from the old storybook scenes. What large blue creature appears on the mural? Answer from memory or from the field — this one can be solved remotely.',
  150, 150, 1, 'easy', 'observation',
  'challenge', 'passphrase', 'sha256:c1e524f5325e090e0c4b6d2025b3b73eb6ea4608bd1f42c55d580db5480eaeac',
  '["sha256:22c71fc75f2ccec3be35306272851ffc48e0587cabced42e87880a9fdcb3c0be", "sha256:6a688edef29d0df679ceee752d6b4741b653a45520feaabe9dbbe7b50f26a49c"]'::jsonb,
  'Enter the large blue creature that appears on the mural (e.g. "whale").',
  false, 'draft', 18, 60,
  true,
  '{"baseXp": 150, "fieldCheckInBonusXp": 75, "photoVideoBonusXp": 50}'::jsonb,
  '{"type": "PHOTO_MESSAGE", "message": "Good. Start with what refuses to disappear. One painted whale survived long enough for you to notice it.", "mediaKey": "commander/challenge-c1-blue-signal.jpg"}'::jsonb,
  '{"type": "VIDEO", "message": "Challenge operative, this sector isn''t polished and it isn''t pristine. It was built for wonder, and pieces of that story are still standing. Your job isn''t to judge what''s faded. Your job is to recover what remains.", "mediaKey": "commander/challenge-sector-intro.mp4", "fallbackType": "PHOTO_MESSAGE"}'::jsonb,
  'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
  'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Completion headline: SIGNAL IDENTIFIED. Completion message: "The story is faded. The signal isn''t." Unlocks C2 on completion.'
)
ON CONFLICT (event_id, slug) DO UPDATE SET
  location_id = EXCLUDED.location_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  point_value = EXCLUDED.point_value,
  xp_reward = EXCLUDED.xp_reward,
  drawing_entry_reward = EXCLUDED.drawing_entry_reward,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  starting_path = EXCLUDED.starting_path,
  verification_type = EXCLUDED.verification_type,
  target_code = EXCLUDED.target_code,
  accepted_answer_variants = EXCLUDED.accepted_answer_variants,
  proof_requirement = EXCLUDED.proof_requirement,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  radius_meters = EXCLUDED.radius_meters,
  remote_capable = EXCLUDED.remote_capable,
  reward_config = EXCLUDED.reward_config,
  commander_transmission = EXCLUDED.commander_transmission,
  sector_intro_transmission = EXCLUDED.sector_intro_transmission,
  safety_notes = EXCLUDED.safety_notes,
  gm_notes = EXCLUDED.gm_notes;

INSERT INTO public.quests (
  event_id, location_id, title, slug, description, instructions,
  point_value, xp_reward, drawing_entry_reward, difficulty, category,
  starting_path, verification_type, proof_requirement, is_flash, status,
  sort_order, radius_meters, remote_capable, prerequisite_quest_id,
  unlock_condition_type, reward_config, commander_transmission,
  safety_notes, gm_notes
)
VALUES (
  (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1),
  (SELECT id FROM public.locations WHERE name = 'Mother Goose Land / 9th Street Area' LIMIT 1),
  'Storybook Witness',
  'challenge-storybook-witness',
  'Three fragments recovered from a wall most people pass without seeing.',
  'Return to the Mother Goose Land mural wall. Three separate storybook details are waiting to be named, in sequence. Each can be answered remotely or from the field.',
  200, 200, 1, 'medium', 'observation',
  'challenge', 'multi_step', 'Answer all three observation prompts, in sequence.',
  false, 'draft', 19, 60, true,
  (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-blue-signal'),
  'prerequisite',
  '{"baseXp": 200, "fieldCheckInBonusXp": 100}'::jsonb,
  '{"type": "PHOTO_MESSAGE", "message": "That''s the difference between passing a place and seeing it. The wall still has stories left.", "mediaKey": "commander/challenge-c2-storybook-witness.jpg"}'::jsonb,
  'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
  'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Completion headline: WITNESSES CONFIRMED. Completion message: "Three fragments recovered from a wall most people pass without seeing." Prerequisite: C1. Unlocks C3 on completion.'
)
ON CONFLICT (event_id, slug) DO UPDATE SET
  location_id = EXCLUDED.location_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  point_value = EXCLUDED.point_value,
  xp_reward = EXCLUDED.xp_reward,
  drawing_entry_reward = EXCLUDED.drawing_entry_reward,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  starting_path = EXCLUDED.starting_path,
  verification_type = EXCLUDED.verification_type,
  proof_requirement = EXCLUDED.proof_requirement,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  radius_meters = EXCLUDED.radius_meters,
  remote_capable = EXCLUDED.remote_capable,
  prerequisite_quest_id = EXCLUDED.prerequisite_quest_id,
  unlock_condition_type = EXCLUDED.unlock_condition_type,
  reward_config = EXCLUDED.reward_config,
  commander_transmission = EXCLUDED.commander_transmission,
  safety_notes = EXCLUDED.safety_notes,
  gm_notes = EXCLUDED.gm_notes;

INSERT INTO public.quest_steps (quest_id, step_order, title, instructions, verification_type, target_code, accepted_answer_variants)
VALUES
  (
    (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-storybook-witness'),
    1, 'The Investigator', 'Which character is dressed like an investigator?', 'passphrase',
    'sha256:15b89a569474240a616f9a94dd045b2711d445dde955b62bf4b8f2a2afaf0f6b',
    '["sha256:af77342b0797f13a314ea730bb27471c14e327cd77f7280453850f2eae695763", "sha256:4dbfbad0e12ac681b3f858e39abb96f0df3165cd0c4ee8479179d0fa34b36786"]'::jsonb
  ),
  (
    (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-storybook-witness'),
    2, 'The Sweet Character', 'What sweet storybook character appears near the pumpkins?', 'passphrase',
    'sha256:afb6d23fcb0a3ab17ba8ad4968a2f5b9e4ef32b936afe66491ccd8f41ffbd293',
    '["sha256:f2923498f1758f7be933884f67205c806a56bc03ae8c61dc4328f699ad703cea", "sha256:2f06ab7e9e52d0829b54c63946e271948658e192c6a4d4ecf5ad8aea5976c86e"]'::jsonb
  ),
  (
    (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-storybook-witness'),
    3, 'The Hunter', 'What animal appears to be chasing one of the pigs?', 'passphrase',
    'sha256:7b8f72c65b9fbbf971301567da244175a694378f89f2bb33a7313ce752e9e8bd',
    '["sha256:5553573c3a34e91b53c7106d5bad7cd1f39ca129743ab4fdf46e1367213a70c8"]'::jsonb
  )
ON CONFLICT (quest_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  instructions = EXCLUDED.instructions,
  verification_type = EXCLUDED.verification_type,
  target_code = EXCLUDED.target_code,
  accepted_answer_variants = EXCLUDED.accepted_answer_variants;

INSERT INTO public.quests (
  event_id, location_id, title, slug, description, instructions,
  point_value, xp_reward, drawing_entry_reward, difficulty, category,
  starting_path, verification_type, target_code, proof_requirement,
  is_flash, status, sort_order, radius_meters, remote_capable,
  prerequisite_quest_id, unlock_condition_type, reward_config,
  commander_transmission, safety_notes, gm_notes
)
VALUES (
  (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1),
  (SELECT id FROM public.locations WHERE name = 'Mother Goose Land / 9th Street Area' LIMIT 1),
  'What Survived',
  'challenge-what-survived',
  'You didn''t restore the wall. You did something that comes first: you noticed it.',
  'Which of these characters is clearly visible on the surviving mural — Blue whale, Dragon, Spaceship, or Race car? Answer remotely, or visit in person to also log a field check-in and a preservation photo.',
  175, 175, 1, 'medium', 'observation',
  'challenge', 'passphrase', 'sha256:22c71fc75f2ccec3be35306272851ffc48e0587cabced42e87880a9fdcb3c0be',
  'Enter the correct character (choices: Blue whale, Dragon, Spaceship, Race car).',
  false, 'draft', 20, 60, true,
  (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-storybook-witness'),
  'prerequisite',
  '{"baseXp": 175, "fieldCheckInBonusXp": 125, "photoVideoBonusXp": 75, "nfcBonusXp": 50}'::jsonb,
  '{"type": "PHOTO_MESSAGE", "message": "A place does not have to be perfect to matter. Somebody has to see what is worth keeping before anybody decides it is worth saving.", "mediaKey": "commander/challenge-c3-what-survived.jpg"}'::jsonb,
  'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic. Field photo must be taken during the event.',
  'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. NFC bonus (+50 XP) references logical cache key C-CACHE-01 ("Storybook Cache") — no NFC scan-tag architecture exists in this codebase yet, and no cache table was created (see report); this bonus is configured but not claimable until that infrastructure and physical placement both exist. Completion headline: ARCHIVE UPDATED. Prerequisite: C2. Unlocks C4 on completion.'
)
ON CONFLICT (event_id, slug) DO UPDATE SET
  location_id = EXCLUDED.location_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  point_value = EXCLUDED.point_value,
  xp_reward = EXCLUDED.xp_reward,
  drawing_entry_reward = EXCLUDED.drawing_entry_reward,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  starting_path = EXCLUDED.starting_path,
  verification_type = EXCLUDED.verification_type,
  target_code = EXCLUDED.target_code,
  proof_requirement = EXCLUDED.proof_requirement,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  radius_meters = EXCLUDED.radius_meters,
  remote_capable = EXCLUDED.remote_capable,
  prerequisite_quest_id = EXCLUDED.prerequisite_quest_id,
  unlock_condition_type = EXCLUDED.unlock_condition_type,
  reward_config = EXCLUDED.reward_config,
  commander_transmission = EXCLUDED.commander_transmission,
  safety_notes = EXCLUDED.safety_notes,
  gm_notes = EXCLUDED.gm_notes;

INSERT INTO public.quests (
  event_id, location_id, title, slug, description, instructions,
  point_value, xp_reward, drawing_entry_reward, difficulty, category,
  starting_path, verification_type, target_code, proof_requirement,
  is_flash, status, sort_order, radius_meters, remote_capable,
  prerequisite_quest_id, unlock_condition_type, reward_config,
  commander_transmission, safety_notes, gm_notes
)
VALUES (
  (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1),
  (SELECT id FROM public.locations WHERE name = 'Mother Goose Land / 9th Street Area' LIMIT 1),
  'The Lost Page',
  'challenge-the-lost-page',
  'The forgotten story produced something the Founder needed.',
  'Find the largest creature swimming through the story. Find the investigator watching the wall. Find the character made to be eaten. Find the hunter chasing the frightened story. Enter all four, in order, separated by hyphens: WHALE-CAT-GINGERBREAD-WOLF.',
  300, 300, 1, 'hard', 'puzzle',
  'challenge', 'passphrase', 'sha256:557e111d453d6b864d4aeb1c3f801b1f440f711a8d0ebd1cd5f6e373161a056c',
  'Enter the full normalized sequence, e.g. "WHALE-CAT-GINGERBREAD-WOLF".',
  false, 'draft', 21, 60, true,
  (SELECT id FROM public.quests WHERE event_id = (SELECT id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1) AND slug = 'challenge-what-survived'),
  'prerequisite',
  '{"baseXp": 300, "fieldCheckInBonusXp": 150, "collectibleUnlockIds": ["col-founder-code"], "threeLocksFragment": {"lock": "code", "collectibleId": "col-founder-code"}, "countsTowardFinale": true}'::jsonb,
  '{"type": "VIDEO", "message": "That''s not just another answer. You recovered CODE. One of three locks is now in your hands.", "mediaKey": "commander/challenge-code-recovered.mp4", "fallbackType": "PHOTO_MESSAGE"}'::jsonb,
  'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
  'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Badge STORYBOOK_SURVIVOR requested but does not exist in the achievements catalog — reported as missing rather than invented; add it to public.achievements first if it should be granted, then set reward_config.badgeUnlockSlugs accordingly. Completion headline: LOCK FRAGMENT RECOVERED. Prerequisites: C1, C2, C3 (enforced transitively via C3''s own prerequisite chain — no multi-prerequisite schema exists or is needed). Grants THREE LOCKS FRAGMENT: CODE via the existing col-founder-code catalog collectible (not a new one).'
)
ON CONFLICT (event_id, slug) DO UPDATE SET
  location_id = EXCLUDED.location_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  point_value = EXCLUDED.point_value,
  xp_reward = EXCLUDED.xp_reward,
  drawing_entry_reward = EXCLUDED.drawing_entry_reward,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  starting_path = EXCLUDED.starting_path,
  verification_type = EXCLUDED.verification_type,
  target_code = EXCLUDED.target_code,
  proof_requirement = EXCLUDED.proof_requirement,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  radius_meters = EXCLUDED.radius_meters,
  remote_capable = EXCLUDED.remote_capable,
  prerequisite_quest_id = EXCLUDED.prerequisite_quest_id,
  unlock_condition_type = EXCLUDED.unlock_condition_type,
  reward_config = EXCLUDED.reward_config,
  commander_transmission = EXCLUDED.commander_transmission,
  safety_notes = EXCLUDED.safety_notes,
  gm_notes = EXCLUDED.gm_notes;
