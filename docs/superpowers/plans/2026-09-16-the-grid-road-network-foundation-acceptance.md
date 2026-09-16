# THE GRID — Canton Road Network Foundation Acceptance

**Date:** 2026-09-16
**Accepted implementation checkpoint:** `3362585` (`GRID Roads 1: normalize real Canton road sources`)
**Status:** ACCEPTED AS ROAD FOUNDATION / NOT YET WORLD-INTEGRATED / NOT PRODUCTION-ACTIVATED

## 1. Accepted scope

Roads 1 establishes the reusable input/normalization boundary for real city street networks without coupling Canton into Grid road core.

The accepted path is:

**Census TIGERweb source snapshot → Canton municipal-boundary clip → city source adapter → city-agnostic normalization → deterministic road segments**

This checkpoint does **not** yet claim that roads are part of territory topology, pathfinding, travel time, mission routing, contests, or the final renderer. It accepts only the trustworthy road-source foundation those later systems can consume.

## 2. Implementation accepted

Commit `3362585` adds:

- `lib/grid/roads/types.ts` — reusable road classes/source/segment contracts;
- `lib/grid/roads/normalize.ts` — deterministic LineString/MultiLineString expansion and stable ordering;
- `lib/grid/cities/canton/roads/source.ts` — Canton-specific adapter for the checked-in processed Census snapshots;
- `tests/grid-road-network.test.ts` — deterministic normalization/count/ID checks.

City-specific filesystem/source knowledge remains under `lib/grid/cities/canton/**`. `lib/grid/roads/**` contains no `Canton`, `Stark County`, or `Ohio` references.

## 3. Source provenance

The road acquisition is recorded under `research/grid/canton/source-data/`.

Accepted source identity:

- Provider: **U.S. Census Bureau**
- Service: **TIGERweb**
- City: Canton, Ohio
- Census place GEOID: `3912000`
- CRS: `EPSG:4326`
- Acquisition timestamp recorded in provenance: `2026-09-14T11:13:11.442967+00:00`
- Human approval remains required before promotion into higher-level gameplay/world semantics.

Raw acquisition counts:

| Layer | Raw features | Raw SHA-256 |
|---|---:|---|
| Canton municipal boundary | 1 | `17fc564f65ce16a74cd4d24f7ee4958d178751b7ac7fb1f435de739a34b0ebf5` |
| Primary roads | 12 | `9c5c793e5cfacc7db5003d5d677119057c3cde51c18b3e4afe75311e4829c2a1` |
| Secondary roads | 81 | `8ce06946eb4f2456116935ac60fb68091c018e450a33454c62bafa020b99f45d` |
| Local roads | 4,123 | `a903edaefeb7257d655f328b3924c6f9778c026cfd4955b4743aa8446caf6af4` |

## 4. Municipal-boundary clipping accepted

The prior clipping pass removes source geometry outside Canton's actual municipal polygon before road normalization.

| Layer | Input | Clipped records | Line parts | Boundary violations |
|---|---:|---:|---:|---:|
| Primary | 12 | 12 | 22 | 0 |
| Secondary | 81 | 67 | 225 | 0 |
| Local | 4,123 | 2,251 | 3,209 | 0 |
| **Total** | **4,216** | **2,330** | **3,456** | **0** |

Processed snapshot hashes verified against `clip-report.json`:

- primary: `365e8825e1dcbe8f02930450f5ed08a3a6b345fcab24674ff83d140ccf553fa6`
- secondary: `1eb15520bd7c0259f837de90b7798e0b80aa2a53bf8eeb76e35a7303cd5e962d`
- local: `db3bf4d4b50b469c465b275a5552b8fba80150bc0ee76ac15a4f3bb91bdbc693`

## 5. Deterministic normalization accepted

`normalizeRoadSourceFeatures` converts each source LineString/MultiLineString part into a `GridRoadSegment` with a stable identity:

`<roadClass>:<sourceOid>:<sourcePartIndex>`

Accepted properties include:

- universal class: `primary | secondary | local`;
- source OID;
- source part index;
- optional road name;
- Census MTFCC;
- route type;
- copied coordinate sequence.

Output ordering is deterministic by road-class priority, source OID, then source part index.

For real Canton source snapshots, normalization produces exactly:

- 22 primary segments;
- 225 secondary segments;
- 3,209 local segments;
- **3,456 total unique stable segment IDs**.

## 6. Independent acceptance verification

A separate clean worktree was created from `3362585`, so ongoing road and contest development were not modified.

Focused Roads 1 verification:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

Full Grid regression verification at the implementation checkpoint:

```text
Test Files  32 passed (32)
Tests       221 passed | 2 skipped (223)
```

TypeScript `tsc --noEmit`: passed.

Reusable road-core city-leak check:

```text
grep -rniE 'canton|stark county|ohio' lib/grid/roads
```

returned zero matches.

## 7. Added provenance-integrity guard

This acceptance branch additionally adds `tests/grid-road-provenance-integrity.test.ts`.

The guard verifies:

1. the recorded Canton GEOID/CRS/provider/service identity;
2. SHA-256 of every raw source file against `provenance.json`;
3. SHA-256 of every processed road snapshot against `clip-report.json`;
4. raw-source SHA references in the clip report;
5. the municipal-boundary hash;
6. zero total containment violations;
7. exact accepted clipped-record and line-part totals.

Focused road + provenance hardening:

```text
Test Files  2 passed (2)
Tests       7 passed (7)
```

This makes accidental replacement/drift of the source snapshots detectable by tests rather than visual inspection.

## 8. Safety boundary

This acceptance does not:

- alter production Supabase;
- deploy road gameplay to production;
- infer private ownership from road data;
- invent missing streets;
- treat every road intersection as a territory edge;
- use road distance as approved travel/contest cost yet;
- expose raw road data as a browser mutation surface;
- claim routing/pathfinding is complete.

The next road phase can safely derive graph nodes/edges/intersections and higher-level traversal semantics from these accepted deterministic segments.

## 9. Next road milestone

The next dependency-ordered road step is to turn normalized segments into a deterministic city-agnostic graph while preserving source lineage:

**segments → snapped endpoints/intersections → graph nodes → graph edges → connectivity validation → later routing/render projection**

Snapping tolerances, intersection rules, class weighting, travel costs, and gameplay meaning must remain explicit configuration/validated derivation rather than guessed Canton-specific constants hidden in Core.
