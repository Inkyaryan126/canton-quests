-- ============================================================================
-- CANTON QUESTS — FOUNDER'S CIPHER PHASE 2 ENGINE RECONCILIATION MIGRATION
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'canton-weekend-1';

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event canton-weekend-1 not found in public.events';
  END IF;

  -- 1. Ensure decoded_sentence column exists on player_district_cipher_progress
  ALTER TABLE public.player_district_cipher_progress
    ADD COLUMN IF NOT EXISTS decoded_sentence TEXT;

  -- 2. Ensure status CHECK constraint supports ready_to_decode
  BEGIN
    ALTER TABLE public.player_district_cipher_progress
      DROP CONSTRAINT IF EXISTS player_district_cipher_progress_status_check;
    
    ALTER TABLE public.player_district_cipher_progress
      ADD CONSTRAINT player_district_cipher_progress_status_check
      CHECK (status IN ('locked', 'in_progress', 'ready_to_decode', 'token_unlocked'));
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

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
    (v_event_id, 'arts', 'arts-founder-signal', 'A NAME', 'Arts District Fragment I', '[A NAME] — First piece of the Arts District phrase.', 1, true),
    (v_event_id, 'arts', 'arts-painted-witness', 'OUTLIVES', 'Arts District Fragment II', '[OUTLIVES] — Second piece of the Arts District phrase.', 2, true),
    (v_event_id, 'arts', 'arts-palace-lantern', 'THE MAN', 'Arts District Fragment III', '[THE MAN] — Third piece of the Arts District phrase.', 3, true),

    -- Challenge District: [THE WORLD] [GAVE A MONSTER] [HIS NAME]
    (v_event_id, 'challenge', 'challenge-brass-key', 'THE WORLD', 'Challenge District Fragment I', '[THE WORLD] — First piece of the Challenge District phrase.', 1, true),
    (v_event_id, 'challenge', 'challenge-helmet-emblem', 'GAVE A MONSTER', 'Challenge District Fragment II', '[GAVE A MONSTER] — Second piece of the Challenge District phrase.', 2, true),
    (v_event_id, 'challenge', 'challenge-neon-loop', 'HIS NAME', 'Challenge District Fragment III', '[HIS NAME] — Third piece of the Challenge District phrase.', 3, true),

    -- Secret District: [THE DEAD] [KEEP IT] [AT WEST LAWN]
    (v_event_id, 'secret', 'secret-stone-stair', 'THE DEAD', 'Secret District Fragment I', '[THE DEAD] — First piece of the Secret District phrase.', 1, true),
    (v_event_id, 'secret', 'secret-quiet-signal', 'KEEP IT', 'Secret District Fragment II', '[KEEP IT] — Second piece of the Secret District phrase.', 2, true),
    (v_event_id, 'secret', 'secret-silent-court', 'AT WEST LAWN', 'Secret District Fragment III', '[AT WEST LAWN] — Third piece of the Secret District phrase.', 3, true)
  ON CONFLICT (event_id, fragment_key) DO UPDATE SET
    district_key = EXCLUDED.district_key,
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
    v_event_id,
    3,
    false,
    ARRAY[
      'Arts Sigil: A NAME OUTLIVES THE MAN.',
      'Challenge Sigil: THE WORLD GAVE A MONSTER HIS NAME.',
      'Secret Sigil: THE DEAD KEEP IT AT WEST LAWN.',
      'Founder Locks: THE MARK · THE CODE · THE WORD'
    ],
    -- SHA-256 hash of "FRANKENSTEIN"
    'sha256:cb230b66b39057eab0e681e01c457544fce740e98d172cc7fd41e51803c9ea47',
    'Convergence Complete. The Founder’s Cipher has been solved. Location Resolved: West Lawn Cemetery — Frankenstein Family Monument.',
    false,
    null,
    null
  )
  ON CONFLICT (event_id) DO UPDATE SET
    required_sigil_count = 3,
    requires_watcher_eligibility = false,
    master_cipher_clue_pieces = EXCLUDED.master_cipher_clue_pieces,
    final_answer_hash = EXCLUDED.final_answer_hash,
    final_destination_reveal = EXCLUDED.final_destination_reveal;

  -- 5. Support event-scoped collectibles provenance
  ALTER TABLE public.player_collectibles
    ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_player_collectibles_event ON public.player_collectibles(player_id, event_id);

END $$;

