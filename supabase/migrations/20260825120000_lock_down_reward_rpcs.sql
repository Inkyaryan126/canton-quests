-- Canton Quests — Lock Down Prize/Reward RPCs + Fix Mutable Search Path
-- Migration: 20260825120000_lock_down_reward_rpcs.sql
--
-- Confirmed Supabase security-advisor finding: claim_quest_placement(uuid)
-- and increment_drawing_entries(...) (both SECURITY DEFINER, added in
-- 20260824020000_reward_config_and_grant_ledger.sql) were created without an
-- explicit REVOKE, so Postgres' default "EXECUTE granted to PUBLIC on
-- function creation" behavior left them callable by the anon and
-- authenticated roles directly over PostgREST/RPC — i.e. any signed-in or
-- anonymous client could invoke a SECURITY DEFINER function that mutates
-- quests.current_claims (race placement) and drawing_entry_ledger (prize
-- entries) directly, bypassing the entire trusted Next.js reward pipeline in
-- lib/supabase-db.ts (awardQuestRewardsDB) that gates them behind quest
-- verification, idempotent reward_grants checks, and drawing-ledger-lock
-- checks.
--
-- Verified call sites: both RPCs are only ever invoked from
-- lib/supabase-db.ts:awardQuestRewardsDB, which requires supabaseAdmin
-- (service-role) and throws if it isn't configured — no anon/authenticated
-- client code path calls either RPC anywhere in the app. It is therefore
-- safe to revoke PUBLIC/anon/authenticated execute rights entirely; only
-- service_role (and the postgres/table-owner role, which retains it
-- implicitly) needs to keep calling them.
--
-- Also locks down public.validate_player_featured_badges' mutable
-- search_path (Supabase advisor: "Function Search Path Mutable") by adding
-- `SET search_path = public`, matching the pattern already used by
-- claim_quest_placement/increment_drawing_entries in the migration above.
-- This is a trigger function with no caller-supplied schema-qualified
-- objects, so pinning search_path is a pure hardening no-op — it changes no
-- observable behavior, it only removes the ability for a session-level
-- search_path override to redirect its unqualified references.

-- 1. claim_quest_placement(uuid) — race-placement claim, mutates quests.current_claims
REVOKE EXECUTE ON FUNCTION public.claim_quest_placement(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_quest_placement(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_quest_placement(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quest_placement(UUID) TO service_role;

-- 2. increment_drawing_entries(...) — mutates drawing_entry_ledger (prize entries)
REVOKE EXECUTE ON FUNCTION public.increment_drawing_entries(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_drawing_entries(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_drawing_entries(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_drawing_entries(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) TO service_role;

-- 3. validate_player_featured_badges() — pin mutable search_path (trigger function only)
ALTER FUNCTION public.validate_player_featured_badges() SET search_path = public;
