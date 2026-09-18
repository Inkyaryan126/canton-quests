# The Grid Remote-First Location Enhancement Core

## Goal

Implement the V1 rule that The Grid is fully viable remotely while physical presence can add optional advantages.

## Non-negotiable boundary

Essential activities must always include a remote completion mode. Location-only activities are permitted only when they are explicitly optional.

Location enhancement is never a completion requirement. It resolves an optional benefit after a trusted server-side presence verifier has already produced a privacy-safe attestation.

## Privacy

Core accepts only a verification id, coarse game zone id, and verification timestamp. Raw latitude, longitude, coordinates, or accuracy are rejected at the Core boundary.

This keeps geolocation collection and proof mechanics outside universal game logic and prevents City Packages from normalizing storage of precise player movement.

## Optional benefit vocabulary

The first Core vocabulary supports scouting intel, local resource caches, temporary modifiers, limited cost reductions, optional event access, and Canton Quests crossover rewards.

The Core validates structure but does not invent city or season reward values.

## Security and determinism

Eligibility fails closed for wrong zones, stale or future attestations, inactive time windows, and exhausted player claim limits. Evaluation is a pure function of the rule, privacy-safe attestation, server time, and authoritative prior-claim count.

The resolver returns an eligibility decision only. A later server service must make the actual reward grant idempotent and append the result to the immutable Grid event ledger.

## Follow-on

Persist location-enhancement claim ids and grants server-side, wire a trusted presence-verification adapter, and add one Canton package example only after the universal policy is accepted.
