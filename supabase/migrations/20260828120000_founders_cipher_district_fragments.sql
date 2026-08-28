-- Founder's Cipher district-fragment system
--
-- Adds private, event-scoped cipher state for the connected multi-district
-- puzzle layer. XP, drawing entries, visible collectibles, leaderboard
-- scores, and quest submissions remain in their existing tables.

CREATE TABLE IF NOT EXISTS public.cipher_fragments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    district_key TEXT NOT NULL CHECK (district_key IN ('arts', 'challenge', 'secret')),
    fragment_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    obscured_label TEXT NOT NULL,
    reveal_copy TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, fragment_key),
    UNIQUE(id, event_id)
);

CREATE TABLE IF NOT EXISTS public.player_cipher_fragments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    fragment_id UUID NOT NULL,
    quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES public.quest_submissions(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id, fragment_id),
    FOREIGN KEY (fragment_id, event_id)
      REFERENCES public.cipher_fragments(id, event_id)
      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.player_district_cipher_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    district_key TEXT NOT NULL CHECK (district_key IN ('arts', 'challenge', 'secret')),
    status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'in_progress', 'ready_to_decode', 'token_unlocked')),
    collected_count INTEGER NOT NULL DEFAULT 0,
    required_count INTEGER NOT NULL DEFAULT 0,
    token_key TEXT,
    token_label TEXT,
    sigil_symbol TEXT,
    token_unlocked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id, district_key)
);

CREATE INDEX IF NOT EXISTS idx_cipher_fragments_event_district
  ON public.cipher_fragments(event_id, district_key, sort_order);

CREATE INDEX IF NOT EXISTS idx_player_cipher_fragments_player_event
  ON public.player_cipher_fragments(player_id, event_id);

CREATE INDEX IF NOT EXISTS idx_player_district_cipher_progress_player_event
  ON public.player_district_cipher_progress(player_id, event_id);

ALTER TABLE public.cipher_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cipher_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_district_cipher_progress ENABLE ROW LEVEL SECURITY;

-- Fragment definitions remain private.
-- Player-facing projections are produced server-side after authentication.
DROP POLICY IF EXISTS "Cipher fragments readable for event projection" ON public.cipher_fragments;

DROP POLICY IF EXISTS "Players read own cipher fragment grants" ON public.player_cipher_fragments;
CREATE POLICY "Players read own cipher fragment grants"
  ON public.player_cipher_fragments
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Players read own district cipher progress" ON public.player_district_cipher_progress;
CREATE POLICY "Players read own district cipher progress"
  ON public.player_district_cipher_progress
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid())
    )
  );

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'canton-weekend-1';

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.cipher_fragments (
    event_id, district_key, fragment_key, display_name, obscured_label, reveal_copy, sort_order
  )
  VALUES
    (v_event_id, 'arts', 'arts-founder-signal', 'Founder Signal Trace', 'Arts Fragment 01', 'A plaza-origin trace recovered from the opening signal.', 10),
    (v_event_id, 'arts', 'arts-painted-witness', 'Painted Witness Trace', 'Arts Fragment 02', 'A visual trace recovered from the Arts District wall.', 20),
    (v_event_id, 'arts', 'arts-palace-lantern', 'Palace Lantern Trace', 'Arts Fragment 03', 'A date-lit trace recovered from the theatre front.', 30),
    (v_event_id, 'challenge', 'challenge-brass-key', 'Brass Door Trace', 'Challenge Fragment 01', 'A word trace recovered from the downtown doorway.', 10),
    (v_event_id, 'challenge', 'challenge-helmet-emblem', 'Helmet Trail Trace', 'Challenge Fragment 02', 'A signal trace recovered from the long-route emblem.', 20),
    (v_event_id, 'challenge', 'challenge-neon-loop', 'Neon Victory Trace', 'Challenge Fragment 03', 'A motion trace recovered from the partner challenge lane.', 30),
    (v_event_id, 'secret', 'secret-stone-stair', 'Stone Stair Trace', 'Secret Fragment 01', 'A numeric trace recovered from the memorial stairs.', 10),
    (v_event_id, 'secret', 'secret-quiet-signal', 'Quiet Signal Trace', 'Secret Fragment 02', 'A proof trace recovered from the West Lawn archive.', 20),
    (v_event_id, 'secret', 'secret-silent-court', 'Silent Court Trace', 'Secret Fragment 03', 'A final archive trace recovered from the Watchers chain.', 30)
  ON CONFLICT (event_id, fragment_key) DO UPDATE SET
    district_key = EXCLUDED.district_key,
    display_name = EXCLUDED.display_name,
    obscured_label = EXCLUDED.obscured_label,
    reveal_copy = EXCLUDED.reveal_copy,
    sort_order = EXCLUDED.sort_order,
    is_required = EXCLUDED.is_required;

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["arts-founder-signal"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'centennial-beacon';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["arts-painted-witness"]}'::jsonb
  WHERE event_id = v_event_id AND slug = '4th-st-mural-pose';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["arts-palace-lantern"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'palace-theatre-lore';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["challenge-brass-key"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'onesto-brass-motto';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["challenge-helmet-emblem"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'hof-trail-emblem';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["challenge-neon-loop"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'arcade-champion-video';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["secret-stone-stair"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'mckinley-monument-year';

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["secret-quiet-signal"]}'::jsonb
  WHERE event_id = v_event_id AND slug IN ('frankenstein-west-lawn', 'frankenstein-quiet-signal');

  UPDATE public.quests
  SET reward_config = COALESCE(reward_config, '{}'::jsonb) || '{"cipherFragmentKeys":["secret-silent-court"]}'::jsonb
  WHERE event_id = v_event_id AND slug = 'watchers-silent-court';
END $$;
