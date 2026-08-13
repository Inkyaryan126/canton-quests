-- Canton Quests Transparent Prize Drawing System Migration
-- Migration: 20260813000000_transparent_prize_drawing_system.sql

-- 1. Extend drawing_ledger_locks table with snapshot & status metadata
ALTER TABLE public.drawing_ledger_locks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS canonical_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS total_qualified_entries INTEGER,
  ADD COLUMN IF NOT EXISTS total_qualified_players INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.drawing_ledger_locks DROP CONSTRAINT IF EXISTS drawing_ledger_locks_status_check;
ALTER TABLE public.drawing_ledger_locks ADD CONSTRAINT drawing_ledger_locks_status_check
  CHECK (status IN ('open', 'review', 'locked', 'drawn', 'published', 'cancelled'));

-- Restrict raw drawing_ledger_locks SELECT policy to admins only (prevents public leakage of locked_by or internal lock fields)
DROP POLICY IF EXISTS "Drawing ledger locks viewable by everyone" ON public.drawing_ledger_locks;
DROP POLICY IF EXISTS "Admins can view drawing ledger locks" ON public.drawing_ledger_locks;
CREATE POLICY "Admins can view drawing ledger locks" ON public.drawing_ledger_locks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- 2. Event Prizes Table
CREATE TABLE IF NOT EXISTS public.event_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sponsor_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    eligibility_rule TEXT NOT NULL DEFAULT 'all_qualified_players',
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Prize Draw Records Table (Authoritative Draw Records)
CREATE TABLE IF NOT EXISTS public.prize_draw_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    prize_id UUID REFERENCES public.event_prizes(id) ON DELETE SET NULL,
    prize_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'drawn',
    locked_ledger_hash TEXT NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL,
    draw_method TEXT NOT NULL DEFAULT 'internal_test',
    provider_reference TEXT,
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    winning_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    winning_public_player_label TEXT NOT NULL,
    selected_weighted_entry_index INTEGER NOT NULL,
    audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT prize_draw_records_status_check CHECK (status IN ('drawn', 'published', 'cancelled'))
);

-- Indexes & Constraints
CREATE INDEX IF NOT EXISTS idx_prize_draw_records_event ON public.prize_draw_records(event_id);
CREATE INDEX IF NOT EXISTS idx_event_prizes_event ON public.event_prizes(event_id);

-- Prevent duplicate active draw records for same event/prize/hash
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_prize_draw_per_event_prize 
  ON public.prize_draw_records(event_id, prize_title, locked_ledger_hash) 
  WHERE status != 'cancelled';

-- Enable RLS
ALTER TABLE public.event_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_draw_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Prizes viewable by everyone" ON public.event_prizes;
CREATE POLICY "Prizes viewable by everyone" ON public.event_prizes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can view prize draw records" ON public.prize_draw_records;
CREATE POLICY "Admins can view prize draw records" ON public.prize_draw_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- 4. Database Triggers: Lock & Snapshot Immutability

-- 4a. Prevent entry edits once ledger is locked
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT COALESCE(is_locked, false), status INTO v_is_locked, v_status
  FROM public.drawing_ledger_locks
  WHERE event_id = COALESCE(NEW.event_id, OLD.event_id);

  IF v_is_locked OR v_status IN ('locked', 'drawn', 'published', 'cancelled') THEN
    RAISE EXCEPTION 'Drawing entry ledger is locked for event %. Mutations are prohibited.', COALESCE(NEW.event_id, OLD.event_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_drawing_ledger_edits ON public.drawing_entry_ledger;
CREATE TRIGGER trg_prevent_locked_drawing_ledger_edits
  BEFORE INSERT OR UPDATE OR DELETE ON public.drawing_entry_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_locked_drawing_ledger_edits();

-- 4b. Prevent mutation or deletion of frozen drawing_ledger_locks snapshot records
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_locks_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked OR OLD.status IN ('locked', 'drawn', 'published', 'cancelled') THEN
      RAISE EXCEPTION 'Drawing ledger lock record for event % is locked/finalized and cannot be deleted.', OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_locked OR OLD.status IN ('locked', 'drawn', 'published', 'cancelled') THEN
    IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Drawing ledger lock for event % is cancelled. Cancelled ledgers are terminal and cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'locked' AND NEW.status NOT IN ('locked', 'drawn', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: locked ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'drawn' AND NEW.status NOT IN ('drawn', 'published', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: drawn ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'published' AND NEW.status NOT IN ('published', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: published ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.snapshot_hash IS NOT NULL AND NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash THEN
      RAISE EXCEPTION 'Cannot mutate snapshot_hash on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.canonical_snapshot IS NOT NULL AND NEW.canonical_snapshot IS DISTINCT FROM OLD.canonical_snapshot THEN
      RAISE EXCEPTION 'Cannot mutate canonical_snapshot on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.locked_at IS NOT NULL AND NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
      RAISE EXCEPTION 'Cannot mutate locked_at on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.total_qualified_entries IS NOT NULL AND NEW.total_qualified_entries IS DISTINCT FROM OLD.total_qualified_entries THEN
      RAISE EXCEPTION 'Cannot mutate total_qualified_entries on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.total_qualified_players IS NOT NULL AND NEW.total_qualified_players IS DISTINCT FROM OLD.total_qualified_players THEN
      RAISE EXCEPTION 'Cannot mutate total_qualified_players on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.is_locked AND NOT NEW.is_locked AND NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Cannot unlock a locked drawing ledger for event % without explicit cancellation status.', OLD.event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_drawing_ledger_locks_edits ON public.drawing_ledger_locks;
CREATE TRIGGER trg_prevent_locked_drawing_ledger_locks_edits
  BEFORE UPDATE OR DELETE ON public.drawing_ledger_locks
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_locked_drawing_ledger_locks_edits();

-- 4c. Atomic draw/publish transitions. These functions lock the ledger row and fail closed
-- if the current lifecycle state is no longer explicitly allowed.
CREATE OR REPLACE FUNCTION public.execute_prize_draw_if_drawable(
  p_event_id UUID,
  p_allowed_statuses TEXT[],
  p_draw_record JSONB
)
RETURNS SETOF public.prize_draw_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_status TEXT;
  v_inserted public.prize_draw_records;
BEGIN
  SELECT status INTO v_lock_status
  FROM public.drawing_ledger_locks
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_lock_status IS NULL THEN
    RAISE EXCEPTION 'Drawing ledger lock not found for event %.', p_event_id;
  END IF;

  IF v_lock_status = 'cancelled'
    OR NOT (v_lock_status = ANY(p_allowed_statuses))
    OR v_lock_status NOT IN ('locked', 'drawn') THEN
    RAISE EXCEPTION 'Cannot execute prize draw for event %. Ledger status % is not drawable.', p_event_id, v_lock_status;
  END IF;

  INSERT INTO public.prize_draw_records (
    event_id,
    prize_id,
    prize_title,
    status,
    locked_ledger_hash,
    locked_at,
    draw_method,
    provider_reference,
    drawn_at,
    winning_player_id,
    winning_public_player_label,
    selected_weighted_entry_index,
    audit_metadata,
    created_at
  )
  VALUES (
    p_event_id,
    NULLIF(p_draw_record->>'prize_id', '')::UUID,
    p_draw_record->>'prize_title',
    'drawn',
    p_draw_record->>'locked_ledger_hash',
    (p_draw_record->>'locked_at')::TIMESTAMPTZ,
    p_draw_record->>'draw_method',
    p_draw_record->>'provider_reference',
    (p_draw_record->>'drawn_at')::TIMESTAMPTZ,
    (p_draw_record->>'winning_player_id')::UUID,
    p_draw_record->>'winning_public_player_label',
    (p_draw_record->>'selected_weighted_entry_index')::INTEGER,
    COALESCE(p_draw_record->'audit_metadata', '{}'::jsonb),
    (p_draw_record->>'created_at')::TIMESTAMPTZ
  )
  RETURNING * INTO v_inserted;

  UPDATE public.drawing_ledger_locks
  SET status = 'drawn', updated_at = now()
  WHERE event_id = p_event_id
    AND status = v_lock_status
    AND status = ANY(p_allowed_statuses);

  RETURN NEXT v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_prize_draws_if_publishable(
  p_event_id UUID,
  p_allowed_statuses TEXT[],
  p_published_at TIMESTAMPTZ
)
RETURNS SETOF public.prize_draw_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_status TEXT;
BEGIN
  SELECT status INTO v_lock_status
  FROM public.drawing_ledger_locks
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_lock_status IS NULL THEN
    RAISE EXCEPTION 'Drawing ledger lock not found for event %.', p_event_id;
  END IF;

  IF v_lock_status = 'cancelled'
    OR NOT (v_lock_status = ANY(p_allowed_statuses))
    OR v_lock_status != 'drawn' THEN
    RAISE EXCEPTION 'Cannot publish prize draw for event %. Ledger status % is not publishable.', p_event_id, v_lock_status;
  END IF;

  UPDATE public.drawing_ledger_locks
  SET status = 'published', updated_at = now()
  WHERE event_id = p_event_id
    AND status = v_lock_status
    AND status = ANY(p_allowed_statuses);

  RETURN QUERY
  UPDATE public.prize_draw_records
  SET status = 'published', published_at = p_published_at
  WHERE event_id = p_event_id
    AND status = 'drawn'
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_prize_draws_if_publishable(UUID, TEXT[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_prize_draws_if_publishable(UUID, TEXT[], TIMESTAMPTZ) TO service_role;

-- 5. Public Published Drawings Projection View
CREATE OR REPLACE VIEW public.public_published_drawings_projection
WITH (security_barrier = true) AS
SELECT
  pdr.id AS draw_record_id,
  pdr.event_id,
  pdr.prize_id,
  pdr.prize_title,
  pdr.winning_public_player_label AS winner_public_label,
  pdr.draw_method,
  pdr.provider_reference,
  pdr.drawn_at,
  pdr.published_at,
  pdr.locked_ledger_hash,
  COALESCE(pdr.audit_metadata->>'verificationStatus', CASE WHEN pdr.draw_method = 'manual_external' THEN 'manual_unverified' ELSE 'internal_seeded' END) AS verification_status,
  COALESCE((pdr.audit_metadata->>'isSystemVerified')::boolean, false) AS is_system_verified,
  COALESCE((pdr.audit_metadata->>'isIndependent')::boolean, false) AS is_independent,
  pdr.audit_metadata
FROM public.prize_draw_records pdr
WHERE pdr.status = 'published';

-- 6. Privacy & Minor-Safe Public Drawing Ledger Projection View
CREATE OR REPLACE VIEW public.public_drawing_ledger_projection
WITH (security_barrier = true) AS
SELECT
  del.event_id,
  CASE 
    WHEN COALESCE(p.is_minor, false) 
      OR p.display_name IS NULL 
      OR TRIM(p.display_name) = '' 
      OR p.display_name ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
      OR p.display_name ~ '\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}'
    THEN 'Agent #' || RIGHT(REPLACE(p.id::text, '-', ''), 4)
    WHEN TRIM(p.display_name) LIKE 'Agent #%' THEN p.display_name
    ELSE p.display_name
  END AS player_public_label,
  SUM(del.entries_count)::INT AS total_qualified_entries,
  COALESCE(dll.is_locked, false) AS is_locked,
  dll.locked_at
FROM public.drawing_entry_ledger del
JOIN public.players p ON del.player_id = p.id
LEFT JOIN public.drawing_ledger_locks dll ON del.event_id = dll.event_id
GROUP BY del.event_id, p.id, p.display_name, p.is_minor, dll.is_locked, dll.locked_at;

GRANT SELECT ON public.public_published_drawings_projection TO anon, authenticated;
GRANT SELECT ON public.public_drawing_ledger_projection TO anon, authenticated;
