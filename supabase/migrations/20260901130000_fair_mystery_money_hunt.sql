-- Canton Quests — Fair QR Hunt: $300 Mystery Money redesign
-- Migration: 20260901130000_fair_mystery_money_hunt.sql
--
-- Replaces the old points/XP/leaderboard Fair mechanic with a $300 Mystery
-- Money Hunt across the 20 core Signals only (fair-core-01..20). Fully
-- additive — no existing table/column is dropped, no existing row is
-- discarded.
--
--   - fair_signal_prizes: the static prize catalog. One row per core
--     Signal, cash_value_cents fixed here permanently — this migration is
--     the ONLY place these 20 values are ever assigned. Re-running this
--     migration is idempotent (ON CONFLICT DO NOTHING keyed on quest_id),
--     so it can never reshuffle an already-seeded value.
--   - fair_signal_claims: the runtime claims ledger. quest_id is the
--     PRIMARY KEY, which is what actually enforces "exactly one global
--     winner per Signal" at the database level — a second INSERT for the
--     same quest_id fails with a primary-key violation (23505), which the
--     application layer (lib/supabase-db.ts claimFairMysterySignalDB)
--     catches and treats as "someone else already found it," never a
--     retryable error. This is a genuine concurrency guarantee, not a
--     check-then-insert race: Postgres serializes concurrent INSERTs
--     against the same primary key, so exactly one of two simultaneous
--     scanners can ever succeed.
--   - Neither table has any RLS policy defined — RLS is enabled with zero
--     policies, so only the service-role key (supabaseAdmin, used
--     server-side only) can read or write either table. The anon/
--     authenticated Supabase roles get nothing. This is the second layer
--     of defense (alongside the application code never selecting
--     cash_value_cents into any response shape a public API route
--     returns) against a hidden Signal's dollar value ever reaching a
--     player's browser before that Signal is found.
--   - Daily bonus Signals (fair-bonus-*) are NOT part of the Mystery Money
--     game — the redesign is explicitly "20 physical QR Signals, $300
--     total." The 2 remaining active bonus Signals (Sept 4, Sept 5) are
--     deactivated here (status='inactive') so scanning one of their
--     physical cards returns the existing, already-tested "SIGNAL
--     OFFLINE" response instead of silently running the old, now-retired
--     300-point award path. Nothing is deleted — an operator can
--     reactivate a bonus Signal later via the existing admin set_status
--     action if the daily-bonus concept returns in a future redesign.
--   - This migration touches ONLY fair-qr-hunt data. It does not alter
--     any Founder's Cipher / Volume 1 quest, table, or column.

CREATE TABLE IF NOT EXISTS public.fair_signal_prizes (
  quest_id UUID PRIMARY KEY REFERENCES public.quests(id),
  cash_value_cents INTEGER NOT NULL CHECK (cash_value_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fair_signal_prizes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fair_signal_claims (
  quest_id UUID PRIMARY KEY REFERENCES public.quests(id),
  player_id UUID NOT NULL REFERENCES public.players(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fair_signal_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fair_signal_claims_player_id ON public.fair_signal_claims(player_id);

DO $$
DECLARE
  v_fair_event_id UUID;
BEGIN
  SELECT id INTO v_fair_event_id FROM public.events WHERE slug = 'fair-qr-hunt' LIMIT 1;
  IF v_fair_event_id IS NULL THEN
    RAISE EXCEPTION 'fair-qr-hunt event not found — run the earlier Fair QR Hunt migrations first.';
  END IF;

  -- The fixed, permanent $300 assignment across the 20 core Signals.
  -- Generated once (Python random.seed(42) shuffle of the approved
  -- distribution: 6x$5, 4x$10, 4x$15, 3x$20, 2x$30, 1x$50 = $300) and
  -- hardcoded here — this is the only place these values are ever chosen.
  INSERT INTO public.fair_signal_prizes (quest_id, cash_value_cents)
  SELECT q.id, v.cents
  FROM (VALUES
    ('fair-core-01', 5000),
    ('fair-core-02', 500),
    ('fair-core-03', 2000),
    ('fair-core-04', 500),
    ('fair-core-05', 1000),
    ('fair-core-06', 1500),
    ('fair-core-07', 2000),
    ('fair-core-08', 3000),
    ('fair-core-09', 1000),
    ('fair-core-10', 1500),
    ('fair-core-11', 3000),
    ('fair-core-12', 1500),
    ('fair-core-13', 500),
    ('fair-core-14', 1500),
    ('fair-core-15', 500),
    ('fair-core-16', 2000),
    ('fair-core-17', 1000),
    ('fair-core-18', 1000),
    ('fair-core-19', 500),
    ('fair-core-20', 500)
  ) AS v(slug, cents)
  JOIN public.quests q ON q.slug = v.slug AND q.event_id = v_fair_event_id
  ON CONFLICT (quest_id) DO NOTHING;

  -- Retire the daily-bonus point mechanic — see header comment.
  UPDATE public.quests
  SET status = 'inactive'
  WHERE event_id = v_fair_event_id
    AND category = 'fair_bonus'
    AND status = 'active';

  -- Zero the legacy point/XP fields on every Fair quest (core and bonus).
  -- The new Mystery Money claim path never reads these — this is
  -- defense-in-depth only, so that even if a future bug ever routed a
  -- Fair Signal through the old generic award path, it could not award
  -- real point/XP value under a game design that no longer exists.
  UPDATE public.quests
  SET point_value = 0, xp_reward = 0
  WHERE event_id = v_fair_event_id
    AND category IN ('fair_core', 'fair_bonus');
END $$;

-- Integrity check: the 20 core Signals' prizes must sum to exactly $300
-- (30000 cents). Fails the migration loudly if the seed above is ever
-- edited inconsistently, rather than silently deploying a wrong total.
DO $$
DECLARE
  v_fair_event_id UUID;
  v_total_cents INTEGER;
  v_row_count INTEGER;
BEGIN
  SELECT id INTO v_fair_event_id FROM public.events WHERE slug = 'fair-qr-hunt' LIMIT 1;

  SELECT COUNT(*), COALESCE(SUM(fsp.cash_value_cents), 0)
  INTO v_row_count, v_total_cents
  FROM public.fair_signal_prizes fsp
  JOIN public.quests q ON q.id = fsp.quest_id
  WHERE q.event_id = v_fair_event_id AND q.category = 'fair_core';

  IF v_row_count <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 fair_signal_prizes rows for fair_core Signals, found %', v_row_count;
  END IF;

  IF v_total_cents <> 30000 THEN
    RAISE EXCEPTION 'Fair Mystery Money prize pool must total exactly $300 (30000 cents), found % cents', v_total_cents;
  END IF;
END $$;
