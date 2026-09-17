# The Grid — Trade Integrity Core

**Date:** 2026-09-16
**Lane:** `trade-integrity-core`
**Branch:** `grid-trade-integrity-20260916`
**Worktree:** `/private/tmp/grid-trade-integrity`

## Goal

Implement the anti-collusion analysis hook required by the Grid Market & Trading design without pretending that one unusual trade proves misconduct.

This system produces deterministic review signals. It does not ban, punish, reverse, or block players.

## Signals

The first pair-level analyzer can flag:

- repeated transactions between the same two players;
- rapid repeated transactions;
- concentrated pair transaction volume;
- materially one-way estimated value flow;
- high-value asset transfers with zero Credit flow.

Each signal has a configured weight. Triggered weights add into an explainable risk score.

## Inputs

Transactions carry city, timestamp, participants, Credits received by each participant, estimated asset value received by each participant, transfer count, and tax paid.

Asset value is explicitly an estimate supplied by the calling system. The integrity engine does not invent property prices.

## Guardrails

- Analysis is city-scoped.
- Analysis is time-window-scoped.
- Requested player pairs must be distinct.
- Transaction ids must be unique.
- Future-dated transaction rows fail validation.
- All aggregate value math is checked for safe-integer overflow.
- Configured signal weights must total exactly 10,000 basis points.
- A risk score crossing the configured threshold means **review recommended**, not guilt established.

## Why review instead of automatic punishment

Legitimate players can repeatedly trade with friends, swap assets without Credits, consolidate property, or make intentionally uneven deals.

Those patterns can also appear in abusive behavior. The correct first response is therefore a transparent review signal backed by measurable facts, not an automatic enforcement action.

## Integration path

A later persistence/integration lane can:

1. Convert completed auctions, fixed-price purchases, and direct deals into normalized integrity transaction facts.
2. Run pair analysis after settlement or on a scheduled review pass.
3. Store the signal breakdown and score with the audit record.
4. Surface high-score cases in an admin review queue.
5. Add network-level analysis for circular transfers, multi-account rings, repeated below-market transfers, or suspicious alliance patterns.
6. Keep enforcement decisions outside this pure scoring core.

This keeps the trading systems fast and deterministic while still giving The Grid a path to protect competitive integrity at scale.
