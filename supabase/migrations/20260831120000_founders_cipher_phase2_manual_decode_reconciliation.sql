-- ============================================================================
-- CANTON QUESTS — FOUNDER'S CIPHER PHASE 2 ENGINE RECONCILIATION MIGRATION
-- Status: PREPARED ONLY (DO NOT APPLY REMOTELY WITHOUT EXPLICIT MISSION APPROVAL)
-- ============================================================================

-- 1. Ensure decoded_sentence column exists on player_district_cipher_progress
ALTER TABLE public.player_district_cipher_progress
  ADD COLUMN IF NOT EXISTS decoded_sentence TEXT;

-- 2. Ensure status CHECK constraint supports ready_to_decode
DO $$
BEGIN
  ALTER TABLE public.player_district_cipher_progress
    DROP CONSTRAINT IF EXISTS player_district_cipher_progress_status_check;
  
  ALTER TABLE public.player_district_cipher_progress
    ADD CONSTRAINT player_district_cipher_progress_status_check
    CHECK (status IN ('locked', 'in_progress', 'ready_to_decode', 'token_unlocked'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Upsert canonical 9 fragment definitions for Canton Launch Weekend Event
INSERT INTO public.cipher_fragments (
  event_id,
  district_key,
  fragment_key,
  display_name,
  obscured_label,
  reveal_copy,
  sort_order,
  is_required
)
VALUES
  -- Arts District: [A NAME] [OUTLIVES] [THE MAN]
  ('e0000000-0000-4000-8000-000000000001', 'arts', 'arts-founder-signal', 'A NAME', 'Arts District Fragment I', '[A NAME] — First piece of the Arts District phrase.', 1, true),
  ('e0000000-0000-4000-8000-000000000001', 'arts', 'arts-painted-witness', 'OUTLIVES', 'Arts District Fragment II', '[OUTLIVES] — Second piece of the Arts District phrase.', 2, true),
  ('e0000000-0000-4000-8000-000000000001', 'arts', 'arts-palace-lantern', 'THE MAN', 'Arts District Fragment III', '[THE MAN] — Third piece of the Arts District phrase.', 3, true),

  -- Challenge District: [THE WORLD] [GAVE A MONSTER] [HIS NAME]
  ('e0000000-0000-4000-8000-000000000001', 'challenge', 'challenge-brass-key', 'THE WORLD', 'Challenge District Fragment I', '[THE WORLD] — First piece of the Challenge District phrase.', 1, true),
  ('e0000000-0000-4000-8000-000000000001', 'challenge', 'challenge-helmet-emblem', 'GAVE A MONSTER', 'Challenge District Fragment II', '[GAVE A MONSTER] — Second piece of the Challenge District phrase.', 2, true),
  ('e0000000-0000-4000-8000-000000000001', 'challenge', 'challenge-neon-loop', 'HIS NAME', 'Challenge District Fragment III', '[HIS NAME] — Third piece of the Challenge District phrase.', 3, true),

  -- Secret District: [THE DEAD] [KEEP IT] [AT WEST LAWN]
  ('e0000000-0000-4000-8000-000000000001', 'secret', 'secret-stone-stair', 'THE DEAD', 'Secret District Fragment I', '[THE DEAD] — First piece of the Secret District phrase.', 1, true),
  ('e0000000-0000-4000-8000-000000000001', 'secret', 'secret-quiet-signal', 'KEEP IT', 'Secret District Fragment II', '[KEEP IT] — Second piece of the Secret District phrase.', 2, true),
  ('e0000000-0000-4000-8000-000000000001', 'secret', 'secret-silent-court', 'AT WEST LAWN', 'Secret District Fragment III', '[AT WEST LAWN] — Third piece of the Secret District phrase.', 3, true)
ON CONFLICT (event_id, fragment_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  obscured_label = EXCLUDED.obscured_label,
  reveal_copy = EXCLUDED.reveal_copy,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required;

-- 4. Ensure Finale Config for Canton Launch Weekend Event is set with SHA-256(FRANKENSTEIN)
INSERT INTO public.finale_config (
  event_id,
  required_sigil_count,
  requires_watcher_eligibility,
  master_cipher_clue_pieces,
  final_answer_hash,
  final_destination_reveal,
  false_finale_enabled,
  false_finale_answer_hash,
  false_finale_reveal_text
)
VALUES (
  'e0000000-0000-4000-8000-000000000001',
  3,
  false,
  ARRAY[
    'Arts Sigil: A NAME OUTLIVES THE MAN.',
    'Challenge Sigil: THE WORLD GAVE A MONSTER HIS NAME.',
    'Secret Sigil: THE DEAD KEEP IT AT WEST LAWN.',
    'Founder Locks: THE MARK · THE CODE · THE WORD'
  ],
  -- SHA-256 hash of "FRANKENSTEIN"
  'sha256:02ca322303c73708e0da832f91dfeb8ebfe47f4fc39a04a3ad820b9dc0745582',
  'Convergence Complete. The Founder’s Cipher has been solved. Location Resolved: West Lawn Cemetery — Frankenstein Family Monument.',
  false,
  null,
  null
)
ON CONFLICT (event_id) DO UPDATE SET
  required_sigil_count = 3,
  master_cipher_clue_pieces = EXCLUDED.master_cipher_clue_pieces,
  final_answer_hash = EXCLUDED.final_answer_hash,
  final_destination_reveal = EXCLUDED.final_destination_reveal;

-- 5. Support event-scoped collectibles provenance
ALTER TABLE public.player_collectibles
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_player_collectibles_event ON public.player_collectibles(player_id, event_id);

-- End of migration
