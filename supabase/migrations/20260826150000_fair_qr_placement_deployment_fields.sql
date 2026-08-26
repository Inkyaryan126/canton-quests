-- Canton Quests — Fair QR physical placement / deployment tracking fields
-- Migration: 20260826150000_fair_qr_placement_deployment_fields.sql
--
-- Additive-only. Supports the admin-only physical deployment workflow for
-- the Fair QR Hunt (and reusable by any future quest that needs it):
--
--   - placement_details JSONB: optional structured admin notes beyond the
--     existing short gm_notes field — { description, setupNotes,
--     retrievalNotes }. A single flexible column (mirroring the existing
--     reward_config JSONB precedent) rather than three new TEXT columns.
--   - placed_at TIMESTAMPTZ: null until a Commander marks a Signal as
--     physically placed at the Fair. This is what actually distinguishes
--     "READY TO PRINT" (placement note filled in) from "PLACED" (someone
--     has put the physical card at that spot) — presence/absence of
--     gm_notes text alone can't express that distinction.
--
-- Both are admin-only fields, never exposed by PublicQuestView (see
-- lib/types.ts, where they're added to the same Omit<> that already
-- strips targetCode/gmNotes from every public API response).
--
-- No existing column, constraint, or row is touched. No non-Fair quest is
-- affected — both columns default to NULL for every existing row.

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS placement_details JSONB,
  ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;
