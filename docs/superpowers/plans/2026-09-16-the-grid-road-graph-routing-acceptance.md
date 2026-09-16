# THE GRID — Road Graph + Routing Acceptance

**Date:** 2026-09-16
**Accepted implementation checkpoint:** `0192f89` (`GRID Roads 2: build deterministic road graph and routing`)
**Status:** ACCEPTED AS DETERMINISTIC ROAD GRAPH FOUNDATION / NOT YET GAMEPLAY TRAVEL SEMANTICS

## 1. Accepted scope

Roads 2 turns the normalized, provenance-backed street segments from Roads 1 into a deterministic graph that can support later city traversal systems.

Accepted pipeline:

**real road segments → rounded endpoint/vertex nodes → weighted graph edges → connected components → validation → deterministic shortest route**

This phase accepts graph structure and distance routing. It does not yet assign mission travel time, player movement speed, one-way driving rules, access restrictions, contest range, or final map rendering semantics.

## 2. Implementation accepted

Commit `0192f89` adds:

- `lib/grid/roads/graph.ts` — stable node/edge construction, Haversine-derived integer millimeter lengths, component calculation;
- `lib/grid/roads/routing.ts` — deterministic shortest-path routing over accepted graph weights;
- `lib/grid/roads/validate.ts` — duplicate/missing endpoint/invalid length/orphan-node validation;
- expanded reusable road graph/route types;
- `tests/grid-road-graph.test.ts` — synthetic and real Canton graph/routing verification.

Reusable `lib/grid/roads/**` remains city-agnostic; Canton source loading stays under `lib/grid/cities/canton/**`.

## 3. Node and edge identity

The graph uses deterministic coordinate-based node IDs. Default coordinate precision is 7 decimal places.

Each road source segment is expanded between consecutive vertices into graph edges with stable source lineage:

- source segment ID;
- source vertex index;
- road class;
- name;
- Census MTFCC;
- route type.

Edge lengths are calculated from rounded graph-node coordinates with the Haversine formula and stored as positive integer millimeters. The integer representation avoids floating-point accumulation as persistent route weight state.

## 4. Real Canton measured topology

At the accepted default precision, the real clipped Canton road sources produce:

```text
road segments:        3,456
road graph nodes:    17,786
road graph edges:    22,580
components:              80
largest component:   16,732 nodes
```

Edge count by source road class:

```text
primary:      1,412
secondary:    1,465
local:       19,703
total:       22,580
```

`validateRoadGraph` reports no duplicate nodes, duplicate edges, missing endpoints, invalid lengths, or orphan nodes for the accepted real Canton graph.

## 5. Connected components accepted

Components are deterministic and sorted largest-first, with stable tie-breaking.

The largest component contains 16,732 of 17,786 nodes (about 94% of accepted graph nodes). Roads 2 intentionally preserves disconnected source components rather than inventing links merely to make the graph look continuous.

A route between different disconnected components correctly returns `null`.

## 6. Routing accepted

`shortestRoadRoute` uses positive integer edge lengths and deterministic queue/edge ordering.

Accepted behavior:

- same graph/from/to returns identical route output;
- source and destination must exist;
- same-node routes return a zero-length route;
- disconnected routes return `null`;
- connected routes return ordered node IDs, edge IDs, and exact total length;
- route total reconciles exactly to the sum of constituent accepted edge lengths.

## 7. Independent integrity hardening

This acceptance branch adds `tests/grid-road-graph-integrity.test.ts` without modifying the Roads 2 implementation files.

The additional guard verifies:

1. graph output is independent of source-segment input ordering;
2. components partition every graph node exactly once;
3. components partition every graph edge exactly once;
4. every real Canton graph edge resolves back to a valid source segment/source vertex pair;
5. road-class/name/MTFCC/route-type lineage does not drift during graph construction;
6. route total equals the exact sum of route edge weights;
7. route node/edge cardinality remains structurally consistent.

Focused Roads 2 + integrity verification passed.

## 8. Full Grid regression acceptance

A clean isolated worktree was created from implementation checkpoint `0192f89`; the active road and contest worktrees were not modified.

Full suite with the added graph-integrity guard:

```text
Test Files  34 passed (34)
Tests       229 passed | 2 skipped (231)
```

TypeScript `tsc --noEmit`: passed.

Reusable road architecture check:

```text
grep -rniE 'canton|stark county|ohio' lib/grid/roads
```

returned zero matches.

The implementation checkpoint was fast-forward backed up to remote branch `grid-road-network-20260915` before later road phases continued.

## 9. Explicit limitations / non-claims

Roads 2 does **not** yet claim:

- road one-way directionality;
- turn restrictions;
- pedestrian vs vehicle accessibility;
- speed limits/travel-time weighting;
- traffic or live conditions;
- bridge/tunnel/elevation semantics;
- intersection synthesis where source linework does not share a snapped vertex;
- route-to-territory association;
- contest attack range;
- mission routing;
- production navigation guidance.

For now graph edges are traversable in both directions for abstract distance connectivity. That is an intentional foundation behavior, not a claim that the graph is a street-legal driving router.

## 10. Next road dependency

The next road layer can safely add spatial/world semantics on top of this graph:

**road graph → territory association → nearest-road/spatial lookup → route projection → explicit gameplay/travel weighting**

Any snapping tolerance, road-class weighting, route mode, or gameplay cost must remain explicit/configured and tested instead of becoming a hidden Canton-specific constant in reusable Core.
