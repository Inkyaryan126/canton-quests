# Grid Global Event Idempotency Hardening

## Problem

The foundation ledger's unique index is `(season_id, idempotency_key)`. PostgreSQL permits multiple `NULL` values in a traditional unique index, so permanent seasonless events are not protected by that constraint.

Passport city-entry events intentionally use `season_id = NULL` because they survive seasonal resets.

## Fix

Add a second partial unique index on `idempotency_key` only for rows where `season_id IS NULL`. Before index creation, fail with an explicit diagnostic if historical duplicates already exist. Do not delete or rewrite append-only ledger history automatically.

Season-scoped events keep using the original composite unique index; permanent global events receive a separate database-enforced idempotency boundary.
