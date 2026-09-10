-- Canton Quests — Founder's Cipher Master Launch Pivot: Private, Immutable
-- Quest Evidence Storage
--
-- The `quest-proofs` Storage bucket was created public, with an RLS policy
-- granting public SELECT (anyone could list/read every player's uploaded
-- evidence) and a blanket authenticated INSERT policy (any authenticated
-- player could upload — or, since no path restriction existed, overwrite —
-- an object anywhere in the bucket). Neither the public-read column nor
-- either policy was ever exercised in production (the bucket was empty at
-- the time of this migration — no existing evidence to migrate/preserve).
--
-- New model: evidence is private and immutable. The only two ways anything
-- ever touches this bucket now:
--   1. A player uploads through a short-lived, server-issued signed upload
--      URL (see POST /api/game/quest-proofs/authorize-upload) — the server
--      only issues one after verifying the authenticated player, quest, and
--      event, and always at a fresh, unique, unpredictable object path
--      (eventId/playerId/questId/evidenceId.ext). The signed token itself
--      is the authorization; no blanket authenticated-role INSERT policy is
--      needed or wanted.
--   2. The service role (admin API, e.g. a future Winner Audit screen)
--      creates a short-lived signed READ URL for one specific object when a
--      player becomes a drawn prize candidate. Ordinary players and the
--      public can never read or list this bucket directly.
--
-- The bucket's public flag was already flipped to false via the Storage
-- Management API as part of this same change; this migration is the
-- reproducible record of that change plus the RLS policy cleanup.

UPDATE storage.buckets SET public = false WHERE id = 'quest-proofs';

DROP POLICY IF EXISTS "Quest proofs public read access" ON storage.objects;
DROP POLICY IF EXISTS "Quest proofs authenticated upload" ON storage.objects;

-- No replacement SELECT/INSERT policy is added for anon/authenticated
-- roles — every real access path uses the service role key (which bypasses
-- RLS entirely), either to mint a signed upload URL or a signed read URL.
