# The Grid Passport Core

## Goal

Implement the V1 permanent cross-city record promised by the Grid design without letting local city wealth cross city boundaries.

## Boundary

The Passport is a city-agnostic Core projection. It consumes authoritative career events and produces a deterministic JSON-safe record suitable for the existing grid_players.passport cache plus global_reputation.

It does not award Credits, Influence, Command Points, property, territory, or any other local-economy asset.

## V1 records

The projection supports cities entered, Home City, current and peak city rank, championships, lifetime territory control, landmark achievements, alliance championships, seasonal trophies, rare cosmetics, and national reputation.

## Determinism and auditability

Events are validated, deduplicated by immutable event id, sorted by timestamp plus id, and replayed into the same projection regardless of query order. Conflicting reuse of an event id fails closed.

One-time awards also use semantic keys so replay/import duplication cannot multiply trophies, achievements, cosmetics, or lifetime territory counts.

## Reputation rule

Core does not invent reputation weights. Reputation moves only through explicit authoritative reputation-earned events whose positive amount was decided by a season/city rule outside this projector.

## Follow-on

A later persistence lane can translate immutable Grid game/career events into Passport events, atomically cache the projection on grid_players, expose a private Passport read API, and add City #002 acceptance proving that no Core changes are required.
