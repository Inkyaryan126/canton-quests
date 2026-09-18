# THE GRID — City Compiler + Canton Geography

**Status:** Proposed architecture, pending self-review below
**Date:** 2026-09-12
**Depends on:** `docs/superpowers/plans/2026-09-11-the-grid-foundation.md` (GRID 1–8, ACCEPTED — see `2026-09-12-the-grid-foundation-acceptance.md`)
**Design authority:** `docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md` §26–27 (City Compiler, City Validation) and the Foundation plan's follow-on roadmap item 1, "City Compiler + Canton Geography."
**Next phase after this one:** Season Economy + Ownership + Property Development (roadmap item 2) — see §14.

**Architecture:** Build a reusable, deterministic geography-ingestion pipeline (`lib/grid/geo/**`, `lib/grid/compiler/**`) that turns approved raw geography plus provenance metadata into a validated, versioned `GridCityPackage`. Canton is the pipeline's first consumer (`lib/grid/cities/canton/**`), not a special case hardcoded into the compiler. The pipeline never writes to any database directly; a separate, explicit import boundary (`lib/grid/compiler/city-import-port.ts` + a Supabase adapter, mirroring the existing `GridEventLedgerPort` pattern) does that, and only against local Supabase in this phase.

---

## 1. Non-negotiable boundaries carried forward from Foundation

- **Core stays universal.** Nothing under `lib/grid/core/**`, `lib/grid/server/**`, or `lib/grid/sim/**` (excluding the new `lib/grid/sim/synthetic-geography.ts`, which is itself city-agnostic) may reference Canton, Ohio, Stark County, or any real coordinate/name. Enforced by the existing scan pattern: `grep -rniE "canton|stark county|ohio" lib/grid/core lib/grid/server lib/grid/sim` must return zero matches, re-run at the end of every task in this plan.
- **Compiler code is also city-agnostic.** `lib/grid/geo/**` and `lib/grid/compiler/**` (excluding files physically under `lib/grid/cities/canton/`) must pass the same scan. The compiler operates on `GridRawGeography` input; it has no knowledge that Canton exists.
- **No production writes.** Every database action in this phase targets local Supabase only (`127.0.0.1`/`localhost`). No task in this plan may run `supabase db push`, `supabase migration up --linked`, or anything that writes to the linked project (`canton-quests`, ref `hdavnmvlnfhcaqjqwrwo`). Automated tests that touch a database use `lib/supabase-test-safety.ts#assertSafeTestSupabaseMutationTarget`, which already hard-fails on that ref (see `tests/supabase-test-safety.test.ts`) — every new DB-integration test in this phase must call it before any mutation.
- **`GRID_FOUNDATION_ENABLED` stays default-off.** Nothing in this phase changes the flag default or adds a new code path that bypasses it.
- **No gameplay scope.** Nothing in this phase touches Credits, Influence, Command Points, ownership, auctions, contests, or the 2.5D renderer. Those are the *next* phase (§14) and are explicitly out of scope here — see §13.

---

## 2. Bounded contexts (exact file layout)

```
lib/grid/
  geo/                          # pure geometry math -- no city knowledge, no DB, no I/O
    geometry.ts
    ids.ts
    adjacency.ts
  compiler/                     # the reusable pipeline -- no city knowledge, no direct DB writes
    types.ts
    normalize.ts
    map-to-city-package.ts
    validate-package.ts
    pipeline.ts
    city-import-port.ts
    supabase-city-importer.ts
  sim/
    synthetic-geography.ts       # NEW -- procedural test geography, reuses rng.ts
  cities/
    canton/
      sources/                   # raw, checked-in geography snapshots + provenance
        canton-boundary.geojson
        canton-downtown-districts.geojson
        canton-downtown-territories.geojson
        canton-downtown-properties.geojson
        canton-downtown-landmarks.geojson
        provenance.json
        README.md
      geography/
        raw-geography.ts          # assembles the sources/ files into a GridRawGeography
        canton-draft-package.ts   # runs the compiler once, exports the compiled fields
      founding-season.ts          # EDITED -- consumes canton-draft-package.ts instead of []
scripts/
  grid-compile-city.ts            # NEW
  grid-inspect-city.ts            # NEW
  grid-validate-city.ts           # EDITED -- upgraded to the severity-graded engine
tests/
  grid-compiler-types.test.ts
  grid-geo-geometry.test.ts
  grid-geo-ids.test.ts
  grid-geo-adjacency.test.ts
  grid-sim-synthetic-geography.test.ts
  grid-compiler-validate.test.ts
  grid-compiler-pipeline.test.ts
  grid-canton-source-provenance.test.ts
  grid-canton-geography.test.ts
  grid-city-importer.test.ts
  grid-compiler-acceptance.test.ts
  fixtures/
    grid-compiler/
      tiny-city-raw.json          # small synthetic fixture city for pipeline/determinism tests
```

No new top-level directories beyond `lib/grid/geo`, `lib/grid/compiler`, and `lib/grid/cities/canton/{sources,geography}`. This mirrors the existing `lib/grid/{core,server,sim,cities}` layout from the Foundation plan exactly — nothing invented beyond what the design spec's pipeline diagram requires.

---

## 3. Dependency: geometry math library

The compiler needs real polygon math (validity checks, centroid, bbox, intersection/touching, overlap area) that would be error-prone to hand-roll and get subtly wrong on real geometry. Add granular **`@turf/*`** packages (not a bundled `@turf/turf`) as production `dependencies`:

- `@turf/helpers`
- `@turf/boolean-valid`
- `@turf/centroid`
- `@turf/bbox`
- `@turf/boolean-point-in-polygon`
- `@turf/boolean-intersects`
- `@turf/area`
- `@turf/intersect`

**This is not a map/3D dependency and does not violate the "no new heavyweight map/3D dependency" or "no map library creep" rules.** Turf ships no rendering, no tiles, no viewport, and is never imported from any file under `app/**` or any client component — it is a server/build-time computational-geometry toolkit used exclusively by `lib/grid/geo/**`, `lib/grid/compiler/**`, and `scripts/grid-*.ts`. It does not touch the client bundle (verified in Task 2's acceptance criteria via `npm run build` output — no new client chunk should appear) and has no relationship to Leaflet/react-leaflet, which remain the only map-rendering libraries in this codebase. Only **Task 2** (§5.2) may edit `package.json`/`package-lock.json` to add these; no later task in this plan adds a new npm dependency.

---

## 4. Type contracts (Task 1 output, reproduced here so every later task can be written against a fixed contract)

All additions are backward-compatible with the existing `lib/grid/core/types.ts` (GRID 2) — every new field is optional, and no existing field is renamed, removed, or narrowed. `validateGridCityPackage` (existing, GRID 2) and its 4 existing tests in `tests/grid-city-package.test.ts` keep their exact current behavior; nothing in this plan may change what they return for the existing draft Canton package.

### 4.1 `lib/grid/core/types.ts` — additive edits

```ts
export type GridConfidenceLevel = 'confirmed' | 'approximate' | 'unknown';

// GridProvenanceRecord lives here, not in lib/grid/compiler/types.ts, purely
// because GridCityPackage.provenance (below) needs to reference it and
// core/types.ts must never import from compiler/types.ts (only the reverse) --
// putting it in compiler/types.ts would create a circular import between the
// two files. lib/grid/compiler/types.ts re-exports/imports this type from
// here like every other core type it depends on.
export interface GridProvenanceRecord {
  id: string;                 // referenced by sourceRefs on individual assets
  sourceName: string;
  sourceUrl: string;
  license: string;
  retrievedAt: string;        // ISO 8601 date
  transformation: string;     // plain-language description of what was done to the raw data
  attribution: string;        // exact attribution text required by the license
  confidence: GridConfidenceLevel;
}

export interface GridHistoricalMetadata {
  era?: string;
  activationYear?: number;
  builtYear?: number;
  openedYear?: number;
  retiredYear?: number;
  demolishedYear?: number;
  predecessorSlug?: string;
  successorSlug?: string;
  sourceRefs?: string[];       // GridProvenanceRecord ids, see below
  confidence?: GridConfidenceLevel;
}

export type GridPrivacyClass =
  | 'PUBLIC_CIVIC'
  | 'COMMERCIAL'
  | 'CULTURAL'
  | 'PARK'
  | 'INFRASTRUCTURE'
  | 'RESIDENTIAL_BACKGROUND'
  | 'PRIVATE_EXCLUDED'
  | 'UNKNOWN_REVIEW_REQUIRED';

// --- existing interfaces gain optional fields ---

export interface GridDistrictDefinition {
  slug: string;
  name: string;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
  sourceRefs?: string[];
}

export interface GridTerritoryDefinition {
  slug: string;
  name: string;
  districtSlug: string;
  baseValue: number;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
}

export interface GridTerritoryEdgeDefinition {
  a: string;
  b: string;
  edgeType?: 'border' | 'corridor';
  historical?: Pick<GridHistoricalMetadata, 'openedYear' | 'retiredYear' | 'confidence' | 'sourceRefs'>;
}

export interface GridPropertyDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  baseValue: number;
  publicNameSafe: boolean;
  geometry?: GeoJSON.MultiPolygon;
  point?: GridLatLng;
  config?: Record<string, unknown>;
  privacyClass?: GridPrivacyClass;   // absent = treated as UNKNOWN_REVIEW_REQUIRED by the validator
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
}

export interface GridLandmarkDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  config?: Record<string, unknown>;
  privacyClass?: GridPrivacyClass;
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
}

export interface GridCityPackage {
  schemaVersion: 1;
  packageVersion: number;
  status: GridCityPackageStatus;
  city: { /* unchanged */ };
  seasonTemplate: { /* unchanged */ };
  districts: GridDistrictDefinition[];
  territories: GridTerritoryDefinition[];
  edges: GridTerritoryEdgeDefinition[];
  properties: GridPropertyDefinition[];
  landmarks: GridLandmarkDefinition[];

  // NEW -- all optional so an untouched hand-authored package (e.g. a future
  // city stub) remains valid without these fields.
  compilerVersion?: string;
  sourceSnapshotVersion?: string;
  generatedAt?: string;      // ISO 8601
  approvedAt?: string;       // ISO 8601, set only by a human review action
  approvedBy?: string;
  checksum?: string;         // sha256 of the normalized pre-metadata payload
  provenance?: GridProvenanceRecord[];
}
```

### 4.2 `lib/grid/compiler/types.ts` — new file

```ts
import type {
  GridLatLng,
  GridCityPackage,
  GridDistrictDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
  GridPropertyDefinition,
  GridLandmarkDefinition,
  GridHistoricalMetadata,
  GridPrivacyClass,
  GridConfidenceLevel,
  GridProvenanceRecord,     // defined in core/types.ts -- see the note there; re-exported here for convenience
} from '../core/types';

export type { GridProvenanceRecord };

export type GridValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface GridValidationIssue {
  severity: GridValidationSeverity;
  code: string;                // stable machine-readable code, e.g. 'GEOMETRY_INVALID'
  message: string;
  assetType?: 'city' | 'district' | 'territory' | 'edge' | 'property' | 'landmark';
  assetSlug?: string;
}

export interface GridValidationReport {
  ok: boolean;                 // true iff zero ERROR-severity issues
  issues: GridValidationIssue[];
}

// --- raw compiler input --------------------------------------------------

export interface GridRawDistrict {
  slug: string;
  name: string;
  geometry: GeoJSON.MultiPolygon;
  sourceRefs: string[];
}

export interface GridRawTerritory {
  slug: string;
  name: string;
  districtSlug: string;
  geometry: GeoJSON.MultiPolygon;
  baseValue?: number;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawProperty {
  slug: string;
  name: string;
  territorySlug: string;
  geometry?: GeoJSON.MultiPolygon;
  point?: GridLatLng;
  privacyClass: GridPrivacyClass;
  publicNameSafe: boolean;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawLandmark {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  privacyClass: GridPrivacyClass;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawGeography {
  citySlug: string;
  cityBoundary: GeoJSON.MultiPolygon;
  districts: GridRawDistrict[];
  territories: GridRawTerritory[];
  edges?: GridTerritoryEdgeDefinition[];   // explicit, source-validated adjacency; optional
  properties: GridRawProperty[];
  landmarks: GridRawLandmark[];
  provenance: GridProvenanceRecord[];
}

export interface GridCompilerOptions {
  compilerVersion: string;          // semver, bumped when normalization/mapping logic changes meaningfully
  sourceSnapshotVersion: string;    // identifies the raw-data snapshot, e.g. 'canton-downtown-slice-v1'
  adjacencyToleranceMeters?: number;  // default 5
  overlapToleranceMeters?: number;    // default 1
  generatedAt?: string;             // injectable for deterministic tests; defaults to new Date().toISOString()
}

export interface GridCompiledPackageResult {
  package: GridCityPackage;         // status: 'draft'
  validation: GridValidationReport;
}
```

**Task 1 write scope:** `lib/grid/core/types.ts`, `lib/grid/compiler/types.ts` (new), `tests/grid-compiler-types.test.ts` (new — asserts the new fields are optional/backward-compatible by constructing a minimal legacy-shaped `GridCityPackage` and a fully-populated one, both type-checking and both passing the *existing* `validateGridCityPackage`). No logic beyond types; no runtime behavior change. **Primary: CLAUDE. Fallback1: AGY. Fallback2: none (no Astra).**

---

## 5. PHASE_2_CORE_EXPERIENCE_SYSTEM — the compiler engine

### 5.1 Pipeline shape (implemented across Tasks 2–5)

```
RAW GEOGRAPHY (GridRawGeography)
        │  lib/grid/compiler/normalize.ts
        ▼
NORMALIZED GEOGRAPHY  (invalid features dropped + recorded as ERROR issues,
                        never silently repaired; deterministic slugs/ids assigned)
        │  lib/grid/compiler/map-to-city-package.ts
        ▼
DRAFT GridCityPackage  (status: 'draft', districts/territories/edges/
                        properties/landmarks assigned, adjacency computed
                        or cross-checked against explicit input edges)
        │  lib/grid/compiler/validate-package.ts
        ▼
GridValidationReport  (ERROR/WARNING/INFO issues)
        │
        ▼
GridCompiledPackageResult { package, validation }   ◄── lib/grid/compiler/pipeline.ts orchestrates all of the above
        │
        ▼  (human review via `npm run grid:inspect-city`)
        │
        ▼  (manual: set status: 'ready', approvedAt, approvedBy once issues.filter(ERROR).length === 0)
READY GridCityPackage
        │  lib/grid/compiler/city-import-port.ts + supabase-city-importer.ts
        ▼
Local Supabase grid_* tables
```

`compileCityPackage(raw, options)` in `pipeline.ts` never mutates a database and never marks a package `ready` — that transition is a deliberate, separate, human-reviewed step (a small CLI flag in Task 9, §8.3), matching "Human review is mandatory before launch" (design spec §26) and "A package cannot move to `ready` with ERRORs" (this plan's validation contract).

### 5.2 Task 2 — Geometry normalization utilities

**Files:** `lib/grid/geo/geometry.ts`, `lib/grid/geo/ids.ts`, `tests/grid-geo-geometry.test.ts`, `tests/grid-geo-ids.test.ts`, `package.json`, `package-lock.json`.

```ts
// lib/grid/geo/geometry.ts
export function isValidPolygonGeometry(geom: GeoJSON.MultiPolygon | GeoJSON.Polygon): boolean;
export function computeCentroid(geom: GeoJSON.MultiPolygon): GridLatLng;
export function computeBBox(geom: GeoJSON.MultiPolygon): [number, number, number, number];
export function isWithinBounds(geom: GeoJSON.MultiPolygon, bounds: GeoJSON.MultiPolygon): boolean;
export function polygonsIntersect(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): boolean;
export function overlapAreaRatio(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): number; // 0..1 of the smaller polygon's area

// lib/grid/geo/ids.ts
export function deterministicSlug(input: string): string;  // lowercase, ascii, hyphenated, stable
export function findDuplicateSlugs(slugs: string[]): string[];
```

- **Coordinate order:** GeoJSON `[longitude, latitude]` throughout every raw/compiled structure in this plan — documented at the top of `lib/grid/geo/geometry.ts` in one line, enforced by every fixture and test using `[lng, lat]` order. `GridLatLng` (existing type, `{lat, lng}`) is only used for point-like fields (map centers, landmark points) at the package boundary, converted via a single named helper (`toLngLatTuple`/`fromLngLatTuple`) rather than ad hoc `[x.lng, x.lat]` scattered across files.
- **No silent repair:** `isValidPolygonGeometry` returns a plain boolean (backed by `@turf/boolean-valid`). Nothing in `lib/grid/geo` ever calls a "buffer(0)"-style auto-fix or otherwise mutates a geometry to make it valid — an invalid geometry is reported and excluded by `normalize.ts`, never patched.
- **Determinism:** `deterministicSlug` is a pure string function (no randomness, no timestamps). `computeCentroid`/`computeBBox` are pure functions of the input geometry.

**Tests:** fixture polygons (self-intersecting bowtie → invalid; open-ring vs closed-ring; a valid square) for `isValidPolygonGeometry`; known centroid/bbox for a fixed square; `isWithinBounds` true/false cases; `polygonsIntersect` true (touching edge) / false (disjoint) cases; `deterministicSlug` idempotence and collision behavior (`findDuplicateSlugs`).

**Primary: CLAUDE** (geospatial/database integrity is explicitly Claude's lane per `boardroom/ROLES.md`). **Fallback1: AGY.**

### 5.3 Task 3 — Adjacency computation + synthetic scale geography

**Files:** `lib/grid/geo/adjacency.ts`, `lib/grid/sim/synthetic-geography.ts`, `tests/grid-geo-adjacency.test.ts`, `tests/grid-sim-synthetic-geography.test.ts`.

```ts
// lib/grid/geo/adjacency.ts
export interface AdjacencyInput { slug: string; geometry: GeoJSON.MultiPolygon }
export function computeAdjacency(
  territories: AdjacencyInput[],
  toleranceMeters?: number
): GridTerritoryEdgeDefinition[];
```

Algorithm: sort/bucket by bounding box (a simple grid-cell hash keyed on rounded bbox coordinates is sufficient — no new spatial-index dependency needed at this scale) to produce only *candidate* pairs whose bboxes overlap or lie within `toleranceMeters`, then run `polygonsIntersect` (§5.2) only on those candidates. This turns the naive O(n²) precise-geometry comparison into O(n²) cheap bbox comparisons plus O(k) precise comparisons where k is the number of bbox-adjacent pairs — a real complexity improvement, not a premature micro-optimization, and it is exactly what the synthetic scale harness below exists to measure.

```ts
// lib/grid/sim/synthetic-geography.ts
export interface SyntheticGeography {
  districts: GridRawDistrict[];
  territories: GridRawTerritory[];
}
export function generateSyntheticGeography(count: number, seed: number): SyntheticGeography;
```

Uses the **existing** `createSeededRng` from `lib/grid/sim/rng.ts` (do not add a second RNG) to lay out `count` roughly-square, non-overlapping, edge-adjacent polygons on a synthetic grid, grouped into a small fixed number of synthetic districts. City-agnostic — no Canton references, lives in `lib/grid/sim` alongside the existing simulation harness deliberately, since it is simulation/test infrastructure, not compiler logic.

**Tests:** `grid-geo-adjacency.test.ts` — a small hand-built 5-territory fixture with known adjacency pairs, verifying: correct pairs found, no self-adjacency, no duplicate pairs (order-independent), disjoint territories excluded. `grid-sim-synthetic-geography.test.ts` — generates 10/100/500 territories, asserts determinism (same seed ⇒ identical output), asserts `computeAdjacency` completes and returns a plausible edge count (each territory has ≥1 neighbor) for each size, and records (via `console.info`, not a hard assertion) the wall-clock time for 500 territories as an early-warning signal — per the user's brief, no hard performance assertion/threshold is added without evidence that one is needed.

**Primary: CLAUDE. Fallback1: AGY.**

### 5.4 Task 4 — Validation engine (severity-graded)

**Files:** `lib/grid/compiler/validate-package.ts`, `tests/grid-compiler-validate.test.ts`.

```ts
export function runCityValidation(
  pkg: GridCityPackage,
  raw?: GridRawGeography   // optional: enables cross-city-adjacency and out-of-bounds checks that need the source city boundary
): GridValidationReport;
```

This is a **new, separate function** — it does not replace or alter `validateGridCityPackage` (GRID 2, `lib/grid/core/city-package.ts`), which keeps its existing simple `{ok, errors}` contract and its 4 existing passing tests untouched. `runCityValidation` supersedes it for anything compiler-produced; `pipeline.ts` (Task 5) and the CLI (Task 9) call `runCityValidation`, not the legacy function. `scripts/grid-validate-city.ts` (Task 9) is upgraded to try `runCityValidation` first and only fall back to the legacy check for a package with `compilerVersion` unset (i.e., the current hand-authored empty-arrays Canton stub) — see §8.3.

Required checks (each with a stable `code` and severity):

| Code | Severity | Check |
|---|---|---|
| `GEOMETRY_INVALID` | ERROR | Any asset geometry fails `isValidPolygonGeometry` |
| `DUPLICATE_ID` / `DUPLICATE_SLUG` | ERROR | Any duplicate slug within districts/territories/properties/landmarks (reuses `findDuplicateSlugs`) |
| `TERRITORY_OUT_OF_BOUNDS` | ERROR | A territory's geometry is not `isWithinBounds` the city boundary (requires `raw.cityBoundary`) |
| `TERRITORY_ISLAND` | WARNING | A territory has zero adjacency edges (disconnected from the rest of the city graph) |
| `SELF_ADJACENCY` | ERROR | An edge's `a === b` (defense in depth; `computeAdjacency` never produces this, but hand-edited/explicit edges might) |
| `CROSS_CITY_ADJACENCY` | ERROR | An edge's two territories resolve to different `citySlug` (only reachable if a raw package is assembled incorrectly — mirrors the DB-level GRID 8 hardening one layer up, in the compiler, before it ever reaches the database) |
| `MISSING_DISTRICT_REF` | ERROR | A territory references an unknown `districtSlug` (already covered by legacy validator; re-implemented here with a `code`) |
| `OVERLAP_TOLERANCE_EXCEEDED` | WARNING | Two territories' `overlapAreaRatio` exceeds `overlapToleranceMeters`-derived threshold |
| `PROPERTY_MISSING_TERRITORY` / `LANDMARK_MISSING_TERRITORY` | ERROR | A property/landmark's `territorySlug` does not resolve |
| `MISSING_PROVENANCE` | WARNING (draft) / ERROR (ready) | An asset has no non-empty `sourceRefs` resolving to a `GridProvenanceRecord` |
| `PRIVACY_UNCLASSIFIED` | WARNING (draft) / ERROR (ready) | A property/landmark has no `privacyClass`, or it is `UNKNOWN_REVIEW_REQUIRED` |
| `RESIDENTIAL_EXPOSURE` | ERROR | A property/landmark is `privacyClass: 'RESIDENTIAL_BACKGROUND'` or `'PRIVATE_EXCLUDED'` but `publicNameSafe: true` (residential/private assets must never be named conquest targets) |
| `FAKE_PLACEHOLDER_GEOGRAPHY` | ERROR (ready only) | `status === 'ready'` and any territory/property/landmark's `sourceRefs` is empty (a `ready` package must be fully sourced, never placeholder) |
| `EMPTY_READY_PACKAGE` | ERROR (ready only) | `status === 'ready'` and `territories.length === 0` |
| `HISTORICAL_CHRONOLOGY_INVALID` | ERROR | `retiredYear`/`demolishedYear` earlier than `builtYear`/`openedYear`/`activationYear` on the same asset, when both are known (never inferred if either is `undefined`) |
| `HISTORICAL_REFERENCE_LOOP` | ERROR | `predecessorSlug`/`successorSlug` chain contains a cycle (detected via graph traversal with a visited-set, across all territories/properties/landmarks combined) |
| `HISTORICAL_REFERENCE_DANGLING` | ERROR | `predecessorSlug`/`successorSlug` points at a slug that does not exist anywhere in the package |

Every check appends zero or more `GridValidationIssue` entries; `ok` is `issues.every(i => i.severity !== 'ERROR')`. Draft-vs-ready severity differences (`MISSING_PROVENANCE`, `PRIVACY_UNCLASSIFIED`) are computed by passing `pkg.status` into the same check function, not by branching the whole validator — one function, one source of truth, status-aware per rule.

**Tests:** one fixture-driven test per code above (a minimal package that triggers exactly that issue and nothing else), plus a "clean package produces zero issues" baseline test, plus one true-positive/true-negative pair for `HISTORICAL_REFERENCE_LOOP` (a 2-cycle and a valid linear predecessor→successor chain).

**Primary: CLAUDE. Fallback1: AGY.**

### 5.5 Task 5 — Compiler pipeline orchestration + City Mapper

**Files:** `lib/grid/compiler/normalize.ts`, `lib/grid/compiler/map-to-city-package.ts`, `lib/grid/compiler/pipeline.ts`, `tests/grid-compiler-pipeline.test.ts`, `tests/fixtures/grid-compiler/tiny-city-raw.json`.

```ts
// normalize.ts
export interface NormalizedGeography extends GridRawGeography {
  droppedFeatures: GridValidationIssue[]; // ERROR-severity GEOMETRY_INVALID entries for anything excluded
}
export function normalizeRawGeography(raw: GridRawGeography): NormalizedGeography;

// map-to-city-package.ts
export function mapToCityPackage(
  normalized: NormalizedGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions
): GridCityPackage; // status: 'draft' always

// pipeline.ts
export function compileCityPackage(
  raw: GridRawGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions
): GridCompiledPackageResult;
```

`normalizeRawGeography`: validates every geometry (`isValidPolygonGeometry`), assigns nothing new to already-slugged input (slugs are supplied by the source, not invented by the compiler — see §6, provenance rules require a human-legible, source-traceable slug), and **drops** (excludes from the returned arrays) any feature that fails geometry validation, recording it in `droppedFeatures` instead of throwing. A completely malformed raw input (e.g., missing `citySlug`) still throws — that is a structural authoring error, not a data-quality issue.

`mapToCityPackage`: assigns districts/territories/edges/properties/landmarks into the `GridCityPackage` shape; computes adjacency via `computeAdjacency` (§5.3) when `normalized.edges` is absent, and when `normalized.edges` **is** present (source-validated adjacency, e.g. topology already known from the geography source), cross-checks it against computed adjacency and keeps the explicit list, adding any check-only mismatches as `INFO`-severity notes surfaced later by `runCityValidation` rather than silently overriding the source's own claim. Stamps `compilerVersion`, `sourceSnapshotVersion`, `generatedAt` (from `options`, defaulting to `new Date().toISOString()` only when not supplied — tests always supply a fixed value), and `checksum` (sha256, Node's built-in `crypto.createHash`, over a stable-key-order JSON serialization of everything except `generatedAt`/`checksum` themselves).

`compileCityPackage`: `normalize → map → runCityValidation`, returns `{ package, validation }`. Never sets `status: 'ready'`.

**Determinism test (the acceptance-critical one):** run `compileCityPackage` twice over the same fixture with the same `options` (including a fixed `generatedAt`), `JSON.stringify` both `.package` results, assert byte-identical. Run a third time with `sourceSnapshotVersion` bumped, assert `checksum` changes (proves the checksum is sensitive to real content, not a constant).

**Primary: CLAUDE** (architecture-critical — the pipeline shape is the single most important contract in this plan). **Fallback1: none (holds for Claude; if genuinely unavailable, AGY may attempt only after re-reading this section verbatim, per the two-failed-attempt pivot rule in AGENTS.md).**

---

## 6. PHASE_3_FLAGSHIP_MOMENTS — real Canton geography

### 6.1 Task 6 — Canton source acquisition + provenance

**Files:** `lib/grid/cities/canton/sources/*.geojson` (new), `lib/grid/cities/canton/sources/provenance.json` (new), `lib/grid/cities/canton/sources/README.md` (new), `tests/grid-canton-source-provenance.test.ts` (new).

**Scope of the first slice** (per the user's brief — prove the pipeline, not the whole municipality): downtown Canton, Ohio, bounded roughly by a small walkable core sufficient to yield:
- 1 city boundary (municipal boundary, for `isWithinBounds` checks — Canton's full municipal boundary is fine to use as the *bounds*, even though only a slice of *territories* is populated inside it)
- 1–3 districts
- roughly 8–20 territories with real, adjacent geometry
- a small set (roughly 5–15) of real, verifiably public commercial/civic property candidates
- a small set (roughly 4–8) of real, well-known public landmarks

**Required, licensable sources only** (this task must record which of these it actually used — do not assume all are needed):
- City of Canton / Stark County GIS open-data portals, if a usable open boundary/parcel layer is published (check for an ArcGIS Open Data or Stark County Auditor GIS endpoint before assuming one doesn't exist)
- US Census Bureau TIGER/Line boundary files (public domain) for the municipal boundary as a fallback/cross-check
- OpenStreetMap via the Overpass API, under **ODbL** — requires the exact ODbL attribution ("© OpenStreetMap contributors") and a note that no OSM data may be redistributed without that attribution string being carried alongside it in `provenance.json`

**Explicitly forbidden:** Google Maps/Places geometry or place data in any form (scraped or API), any other commercial map provider's geometry, and any parcel/ownership data source that exposes named private individuals.

**Provenance record shape** (`provenance.json`, an array of `GridProvenanceRecord` per §4.1, one entry per distinct source used — not one per feature):

```json
[
  {
    "id": "osm-overpass-2026-09-12",
    "sourceName": "OpenStreetMap (via Overpass API)",
    "sourceUrl": "https://overpass-api.de/api/interpreter",
    "license": "ODbL 1.0",
    "retrievedAt": "2026-09-12",
    "transformation": "Queried ways/relations tagged amenity|shop|leisure=park|historic within the downtown Canton bounding box; converted to GeoJSON; no geometry simplification applied.",
    "attribution": "© OpenStreetMap contributors",
    "confidence": "confirmed"
  }
]
```

Every feature in every `*.geojson` file must carry a `properties.sourceRefs: string[]` pointing at one or more `provenance.json` entry `id`s — this is what `MISSING_PROVENANCE` (§5.4) checks. **This task must not fabricate any date, demolished building, boundary, ownership fact, road-opening date, or landmark history.** Where a real historical fact is not confirmable from a cited source within this task's scope, the corresponding `GridHistoricalMetadata` field is simply omitted (`undefined`), never guessed — omission is the correct, required behavior per the design brief ("unknown historical values should remain null/unknown"), not a gap to fill in later within this task.

**Failure mode:** if the executing agent/CLI has no outbound network access in its run environment, this task cannot fabricate geography to compensate. It must checkpoint as `BLOCKED` with a blocker string naming the missing capability (e.g., `"no outbound network access available to reach Overpass API / GIS portals"`) rather than inventing placeholder polygons — a `BLOCKED` task here should stall only Task 7 (which consumes its output), not the rest of this plan; Tasks 2–5, 8, and 9's non-Canton-dependent portions can still proceed and be reviewed.

**Test:** `grid-canton-source-provenance.test.ts` is a static, network-free contract test: reads every `*.geojson` file under `sources/`, asserts every feature has a non-empty `properties.sourceRefs`, and that every referenced id exists in `provenance.json`, and that every `provenance.json` entry has all required `GridProvenanceRecord` fields non-empty. This is the only automated gate on Task 6 — it cannot verify real-world accuracy, only structural completeness, which is why human review (Task 9's inspect CLI) matters for this task's output.

**Primary: AGY** (source adapters / fixtures — routine ingestion work once the compiler contracts exist). **Fallback1: CLAUDE** (if the geometry needs real geospatial judgment calls Agy should not make alone, e.g. resolving a genuinely ambiguous licensing question).

### 6.2 Task 7 — Canton City Package assembly

**Files:** `lib/grid/cities/canton/geography/raw-geography.ts` (new), `lib/grid/cities/canton/geography/canton-draft-package.ts` (new), `lib/grid/cities/canton/founding-season.ts` (edited), `tests/grid-canton-geography.test.ts` (new).

`raw-geography.ts` reads the checked-in `sources/*.geojson` + `provenance.json` (via `fs.readFileSync`/static `import ... assert { type: 'json' }`/Next.js JSON import — whichever this repo's existing convention favors; check how other `lib/` modules already import static JSON before choosing, do not introduce a second convention) and assembles a `GridRawGeography` object — pure, synchronous, no network calls at runtime (the network call happened once, by hand, in Task 6, producing the checked-in files).

`canton-draft-package.ts` calls `compileCityPackage(rawGeography, seasonTemplate, cityMeta, { compilerVersion: '1.0.0', sourceSnapshotVersion: 'canton-downtown-slice-v1' })` once at module load and exports the resulting `districts`/`territories`/`edges`/`properties`/`landmarks`/`compilerVersion`/`sourceSnapshotVersion`/`generatedAt`/`checksum` fields plus the `GridValidationReport` (exported separately, e.g. as `cantonDraftValidation`, so tests and the CLI can inspect it without recompiling).

`founding-season.ts` is edited to spread these compiled fields in place of the current empty arrays:

```ts
import { cantonDraftPackageFields } from './geography/canton-draft-package';

export const cantonFoundingSeasonPackage: GridCityPackage = {
  schemaVersion: 1,
  packageVersion: 1,
  status: 'draft',
  city: { /* unchanged */ },
  seasonTemplate: { /* unchanged */ },
  ...cantonDraftPackageFields,
};
```

This keeps `founding-season.ts` declarative (matching its existing style) while the actual geography now comes from the compiler rather than being hand-typed.

**Tests:** `grid-canton-geography.test.ts` asserts: `getGridCityPackage('canton-oh')` (existing registry function, GRID 3) now returns a package with `territories.length > 0`; `validateGridCityPackage` (legacy, still must pass since `status` stays `'draft'`) returns `ok: true`; `runCityValidation` on the same package has **zero ERROR-severity issues** (WARNINGs for `PRIVACY_UNCLASSIFIED`/`MISSING_PROVENANCE` are acceptable at `draft` status only if any assets are genuinely still under review — the acceptance criterion for *this task* is zero ERRORs, not zero WARNINGs); re-running `getGridCityPackage('canton-oh')` twice in the same process yields byte-identical `districts`/`territories` arrays (module-load-time compile is deterministic and cached, not recomputed per call — confirms no accidental per-call `Date.now()`/`Math.random()` leaked in).

**Primary: CLAUDE** (wiring the compiler into the real package is architecturally sensitive — a mistake here would leak Canton specifics into how the compiler is invoked from a city package, undermining the whole point of the exercise).

---

## 7. PHASE_4_SECONDARY_POLISH — Task 8: local DB importer

**Files:** `lib/grid/compiler/city-import-port.ts` (new), `lib/grid/compiler/supabase-city-importer.ts` (new), `tests/grid-city-importer.test.ts` (new).

```ts
// city-import-port.ts
export interface GridCityImportResult {
  citySlug: string;
  districtsUpserted: number;
  territoriesUpserted: number;
  edgesUpserted: number;
  propertiesUpserted: number;
  landmarksUpserted: number;
}

export interface GridCityImportPort {
  importCityPackage(pkg: GridCityPackage): Promise<GridCityImportResult>;
}
```

`supabase-city-importer.ts` implements this against a `SupabaseClient` **exactly** like `createSupabaseGridEventLedgerPort` (existing GRID 5 pattern in `lib/grid/server/supabase-event-ledger.ts`): accepts an injected client (defaulting to the existing `supabaseAdmin`), maps camelCase package fields to the snake_case `grid_*` columns from the GRID 4/8 migrations, and upserts in FK-safe order: `grid_cities` → `grid_districts` → `grid_territories` → `grid_territory_edges` → `grid_properties` → `grid_landmarks`, keyed on each table's existing `(city_id, slug)` unique constraint (`upsert(..., { onConflict: 'city_id,slug' })`), except `grid_territory_edges` which has no natural slug and upserts on the existing `grid_territory_edges_pair_uq` index (`city_id, least(a,b), greatest(a,b)`) — resolve each edge's territory slugs to their DB ids first (a `select id, slug from grid_territories where city_id = $1` lookup), then upsert.

**This importer only ever runs against local Supabase.** It refuses to run (throws before issuing any query) unless `assertSafeTestSupabaseMutationTarget(client's configured URL)` (existing `lib/supabase-test-safety.ts`, §1) passes — this check is not test-only scaffolding bolted on around the importer, it is a runtime guard inside `supabase-city-importer.ts` itself, so a stray script invocation can never accidentally target production even outside the test suite.

Importing does not automatically flip a package to `'ready'`; a caller must pass an already-`'ready'`, already-`runCityValidation`-clean package. The importer itself calls `runCityValidation` one more time defensively and refuses to import (throws, no partial writes attempted) if any ERROR-severity issue exists — belt-and-suspenders against a caller skipping validation.

**Tests:** `grid-city-importer.test.ts` follows the repo's established integration-test convention (`test-env/README.md`, §1): guarded by `describe.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL)`, calls `assertSafeTestSupabaseMutationTarget` up front, runs against a real local Supabase instance (started via `npx supabase start` beforehand, same as Foundation acceptance), imports the tiny synthetic fixture package from Task 5's fixture (not the real Canton package, to keep this test fast and independent of Task 6/7 completing first), asserts row counts match, asserts re-running `importCityPackage` with the same package is idempotent (upsert, not insert — no duplicate-key errors, same row counts after two imports), and asserts an unvalidated/`ERROR`-carrying package is rejected before any row is written (query the table afterward, assert zero rows for that city).

**Primary: CLAUDE** (backend/database is Claude's lane; this task touches production-schema-shaped writes and needs the same care as GRID 5).

---

## 8. PHASE_5_PERFORMANCE_ACCESSIBILITY — Task 9: CLI tooling + acceptance gate

### 8.1 `npm run grid:compile-city -- canton-oh`

**File:** `scripts/grid-compile-city.ts` (new). For `canton-oh`, prints the `GridCompiledPackageResult` summary (not the full GeoJSON — human-readable counts + validation issue list) and, with an explicit `--write` flag only, writes the compiled package JSON to a local-only, gitignored scratch path (never overwrites `founding-season.ts` or any committed source file — the committed Canton package is produced by `canton-draft-package.ts` at import time, this script is for inspection/debugging, not for regenerating checked-in files).

### 8.2 `npm run grid:inspect-city -- canton-oh`

**File:** `scripts/grid-inspect-city.ts` (new). Produces the required human-review artifact without opening raw GeoJSON:
- summary counts (districts/territories/edges/properties/landmarks)
- validation issues grouped by severity, each with code/message/asset
- unclassified assets (`PRIVACY_UNCLASSIFIED` issues, listed by slug)
- disconnected zones (`TERRITORY_ISLAND` issues, listed by slug)
- historical unknowns (assets with no `historical` field at all vs. assets with a partially-populated one — both are legitimate, this is informational, not an issue)
- provenance summary (one line per `GridProvenanceRecord`: source name, license, retrieved date, how many assets cite it)

### 8.3 `npm run grid:validate-city -- canton-oh` (upgraded, not replaced)

**File:** `scripts/grid-validate-city.ts` (edited). New behavior: if the resolved package has `compilerVersion` set, run `runCityValidation` and print the full `GridValidationReport` (exit code 1 if `!ok`, matching existing script's exit-code convention). If `compilerVersion` is unset (a legacy/hand-authored package, i.e. today's empty-arrays Canton stub before Task 7 lands, or any future city package authored without the compiler), fall back to the **existing** `validateGridCityPackage` call, byte-for-byte as today — this is the only way to guarantee this script's current documented usage and output shape (already cited as Foundation acceptance evidence) keeps working unmodified for any package that hasn't opted into the compiler.

### 8.4 Final City Compiler acceptance gate

**File:** `tests/grid-compiler-acceptance.test.ts` (new). Ties together the cross-cutting acceptance criteria that no single task above fully covers on its own:
- Architecture boundary scan as a test, not just a manual grep: reads every `.ts` file under `lib/grid/geo`, `lib/grid/compiler` (excluding `lib/grid/cities/**`), asserts none contain `/canton|stark county|ohio/i`.
- Re-run of the Task 5 determinism test against the **real Canton raw geography** (not just the tiny synthetic fixture) — compiling Canton's real sources twice yields an identical package.
- `runCityValidation` against the real compiled Canton package has zero ERRORs (duplicate of the Task 7 assertion, intentionally — this is the single gate a reviewer should be able to point at as "the compiler works end to end," independent of which task happened to introduce the check).
- Synthetic-scale smoke test at n=500 (§5.3) completes within the test's default timeout with no hard perf assertion beyond "completes and produces a valid, fully-adjacent-checked package."

**Primary: AGY** (CLI/script wiring and the report-formatting parts of this task are routine implementation). **Fallback1: CLAUDE** (the acceptance-gate test file itself is reviewed/authored by Claude if Agy is unavailable, since it is the phase's final gate).

---

## 9. Task ordering & dependency graph

```
Task 1 (contracts)
   │
   ├──► Task 2 (geometry) ──┐
   ├──► Task 3 (adjacency + synthetic) ──┤
   │        (2 and 3 both depend only on Task 1's types; may run in parallel)
   │                                     ▼
   └──────────────────────────────► Task 4 (validation engine)
                                          │
                                          ▼
                                    Task 5 (pipeline)
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                    │
                  Task 6 (Canton sources)                    │
                        │                                    │
                        ▼                                    │
                  Task 7 (Canton assembly) ◄──────────────────
                        │
                        ▼
                  Task 8 (DB importer)   -- only needs Task 5's fixture package, not Task 7; may start once Task 5 is DONE
                        │
                        ▼
                  Task 9 (CLI + acceptance gate) -- needs Tasks 5, 7, 8 all DONE
```

Only Task 5 and Task 7 touch `lib/grid/compiler/pipeline.ts`-adjacent shared understanding without touching the same files, so no two QUEUED tasks in the same phase are ever racing on one file: Tasks 2/3 touch disjoint new files; Task 4 and Task 5 are strictly sequential (Task 5 imports Task 4's `runCityValidation`); Task 8 does not touch anything Task 6/7 touch (import boundary is independent of *which* city's package it imports).

---

## 10. Historical metadata design (recap, already specified above — collected here per the required outline)

- `GridHistoricalMetadata` (§4.1) is attached optionally to territories, properties, landmarks, and edges (a restricted `Pick` for edges — only opened/retired years, no built/demolished, since an edge is a corridor relationship, not a structure).
- Every field is optional and independently nullable — a territory can have `activationYear` set with everything else `undefined`.
- `predecessorSlug`/`successorSlug` reference another asset's slug **within the same package** (any asset type — a demolished landmark's successor could be a property, for instance) and are validated for existence and acyclicity by `HISTORICAL_REFERENCE_DANGLING`/`HISTORICAL_REFERENCE_LOOP` (§5.4).
- `confidence: GridConfidenceLevel` (`'confirmed' | 'approximate' | 'unknown'`) lets Task 6 record uncertainty explicitly rather than omitting a field it is only partially sure of — but a genuinely unknown *value* (no date at all) is still `undefined`, not `confidence: 'unknown'` attached to a guessed number. `confidence` describes certainty about a value that *is* present.
- **SUPERSEDED BY ADR-057:** this plan does not build era-gating, release schedules, or gameplay-visible historical sequencing, and the earlier idea of "PAST → PRESENT → PLAYER-CREATED FUTURE" as a core unlocking timeline is no longer planned. The canonical playable board is the present-day city package. Historical metadata remains optional, source-backed context for lore, quests, overlays, vanished-place references, and isolated historical Echo events; it must not control normal economy/ownership availability. No fixed Canton era enum is introduced.

---

## 11. Geography source & provenance rules (recap, collected here per the required outline)

Fully specified in §6.1. Summary of the invariants enforced by tooling (not just documentation):
- Every geometry feature must resolve `sourceRefs` to a `provenance.json` entry (`MISSING_PROVENANCE`, enforced by both `runCityValidation` and the static `grid-canton-source-provenance.test.ts`).
- `provenance.json` entries are per-source, not per-feature, and carry license + attribution + retrieval date + transformation description — enough for a human (or a future licensing audit) to reconstruct exactly what was pulled from where and what was done to it.
- Google/commercial map data is forbidden outright; OSM data requires ODbL attribution to be present verbatim.
- No historical fact may be fabricated; omission (`undefined`) is correct when a source doesn't confirm something.

---

## 12. Privacy rules (recap, collected here per the required outline)

- `GridPrivacyClass` (§4.1) is required conceptually on every property/landmark; its *absence* in the type system defaults to `UNKNOWN_REVIEW_REQUIRED` treatment inside `runCityValidation` (§5.4) rather than defaulting to something permissive like `PUBLIC_CIVIC` — an unclassified asset is always treated as needing review, never silently assumed safe.
- `RESIDENTIAL_EXPOSURE` (ERROR, always, draft or ready) is the hard backstop: a `RESIDENTIAL_BACKGROUND` or `PRIVATE_EXCLUDED` asset can never be `publicNameSafe: true`. This is checked at the compiler layer (before anything reaches a database) and is independent of, and in addition to, the existing `public_name_safe` column on `grid_properties` (GRID 4) — the compiler is the first line of defense, the DB column is the second.
- Task 6 is instructed (§6.1) to select only public/commercial/civic/cultural/park real assets as named properties/landmarks in the first place; residential parcels, if used at all, inform only territory-boundary geometry (never become a named `GridPropertyDefinition`/`GridLandmarkDefinition`).

---

## 13. Explicitly out of scope for this phase

Everything the user's brief listed as "what not to build yet" is out of scope, unchanged: player economy, Credits, Influence, Command Points, ownership/claiming gameplay, auctions, territory claiming, Signal Dice, contests, offline defense, buildings/upgrades, the 2.5D final renderer, realtime gameplay, alliances, market/trading, NPC faction AI, Surge, City Power scoring, sponsor dashboard, a second city, and national Passport gameplay. Nothing in this plan's file list or type contracts introduces a stub, TODO, or placeholder field for any of these — where the design spec's economy/ownership concepts might eventually need a hook (e.g., `baseValue` on territories/properties), that hook **already exists** from GRID 2/4 and this plan only ever reads/preserves it, never extends it toward gameplay.

---

## 14. What the player-visible map gains in the NEXT phase

This phase produces zero player-visible change — `/grid` stays behind `GRID_FOUNDATION_ENABLED` and the compiled Canton package is not surfaced in any UI. The very next phase, **Season Economy + Ownership + Property Development** (Foundation plan roadmap item 2), is what turns this phase's output into something a player sees: joining the Founding Season, Credits/Influence/Command Point regeneration, neutral-claim mechanics over the real compiled Canton territories, a territory-control projection surfaced on the map, actual property acquisition against the real property candidates this phase sourced, and branching Commerce/Influence/Fortress/Intel/Prestige development with Skyline bonuses — plus a deterministic economy simulation exercising all of it. In short: this phase builds the map; the next phase lets a player stand on it and start claiming it.

---

## 15. Testing expectations summary

TDD throughout — every task above lists its test file(s) alongside its implementation files, and no task is DONE without its tests passing. No test in this plan makes a live network call (Task 6's network use is a one-time, by-hand authoring step producing checked-in fixtures; its *test* is purely static). `grid-city-importer.test.ts` is the only test that touches a database, and it is explicitly guarded/skippable per the repo's existing integration-test convention. Every new test file is added to the same focused Grid test run used for Foundation acceptance (`tests/grid-*.test.ts`), so the phase's final gate is:

```
npx vitest run tests/grid-*.test.ts
```

---

## 16. Command-line tools summary

| Command | Status |
|---|---|
| `npm run grid:validate-city -- canton-oh` | existing, upgraded in Task 9 |
| `npm run grid:compile-city -- canton-oh` | new, Task 9 |
| `npm run grid:inspect-city -- canton-oh` | new, Task 9 |

---

## 17. Local-only migration rules / no-production safeguards (recap)

No migration is strictly required by this plan — Tasks 1–7 and 9 are pure TypeScript/data; only Task 8 touches a database, and it does so through the existing GRID 4/8 schema (no new tables, no new columns) via the standard Supabase client, guarded by `assertSafeTestSupabaseMutationTarget`. If a reviewing agent determines during implementation that a schema change genuinely is needed (e.g., an index the importer needs for performance), it must be added as a new, additive, local-only migration file following the exact GRID 8 precedent (§ADR-056) — never by editing `20260912052232_grid_foundation.sql` or `20260912054500_grid_foundation_hardening.sql` — and must be called out as a decision in `DECISIONS.md`, same as ADR-056. No task in this plan may run any Supabase CLI command with `--linked`, `db push`, or any remote target.

---

## 18. Failure modes

- **Task 6 has no network access** → checkpoint `BLOCKED` with an explicit blocker string (§6.1); does not block Tasks 2–5/8/9.
- **A licensable geography source doesn't exist for some sub-slice** (e.g., no open parcel data for a specific block) → that sub-slice is simply omitted from the downtown slice rather than backfilled with invented geometry; the slice can be smaller than the "roughly 8–20 territories" target if that's what real, licensed sources support. Under-delivering on scope with real data beats over-delivering with fake data.
- **`runCityValidation` finds ERRORs in the real Canton compile that Task 7 can't resolve by fixing the raw source data** (e.g., a genuine self-intersecting polygon in an upstream OSM way) → Task 7 checkpoints with the specific `GridValidationIssue` codes still failing, rather than loosening the validator to make them pass. The validator's rules do not get weakened to accommodate one city's messy input; the input gets fixed or excluded.
- **A Boardroom task attempts the same approach twice and fails twice** → per `AGENTS.md` rule 12, stop and pivot strategy rather than retrying a third time; record the two failed `attempts` on the task (existing Boardroom mechanism) so the next attempt (possibly a different agent) doesn't repeat the same dead end.
- **Turf's `@turf/boolean-valid` or `@turf/intersect` behaves unexpectedly on a real-world OSM ring** (a known class of issue with real GIS data) → prefer excluding the problematic feature and recording `GEOMETRY_INVALID` over adding ad hoc coordinate-rounding/repair logic that could silently change the geometry's meaning (§5.2's "no silent repair" rule applies here too).

---

## 19. Final acceptance gate for this phase

City Compiler + Canton Geography is ACCEPTED when, on the Grid branch:

1. `npx vitest run tests/grid-*.test.ts` — all pass, including every new test file listed in §2.
2. `npm run grid:validate-city -- canton-oh` exits 0 and reports zero ERROR-severity issues against the real compiled Canton package.
3. `npm run grid:inspect-city -- canton-oh` produces a human-readable report (manually reviewed by a human before this phase is called done — this is the explicit "human review is mandatory before launch" gate from the design spec).
4. The Task 9 acceptance-gate test (`grid-compiler-acceptance.test.ts`) passes, including the architecture-boundary-as-a-test check.
5. `npm run lint` and `npm run build` both pass.
6. `grep -rniE "canton|stark county|ohio" lib/grid/geo lib/grid/compiler` (excluding `lib/grid/cities/canton`) returns zero matches.
7. `git status --short` is clean except for the intended commits.
8. No production migration, push, or deploy occurred at any point (same confirmation pattern as the Foundation acceptance record, §Production Safety).
9. A new `docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography-acceptance.md` acceptance record exists, following the exact structure of the Foundation one.

---

## 20. Self-review

**Canton leaking into Core:** checked explicitly in §1, §9 (test), and §19 (final gate). `lib/grid/geo` and `lib/grid/compiler` (outside `cities/canton`) are grepped for Canton/Ohio/Stark County references as an automated test, not just a manual habit.

**Fake geography:** Task 6 is explicitly forbidden from fabricating geometry or history (§6.1, §18); the validation engine's `FAKE_PLACEHOLDER_GEOGRAPHY` check specifically blocks an unsourced asset from ever reaching `ready`.

**Accidental gameplay scope creep:** §13 enumerates exactly what stays out; no type in §4 carries a Credits/Influence/ownership-shaped field beyond the `baseValue` hook that already existed before this plan.

**Map library creep:** §3 explicitly distinguishes Turf (server-side computational geometry) from a map-rendering library, and requires the build output to show no new client-side chunk from it — Leaflet/react-leaflet remain the only map-rendering dependency, untouched by this plan.

**Production migration risk:** §1, §7, §17 all restate the local-only rule at the exact points where a migration or DB write could plausibly happen (Task 8), and the importer enforces it at runtime, not just in test setup.

**Unlicensed geography:** §6.1's source list is restricted to public-domain/Census, official city/county open data, and ODbL-attributed OSM; Google Maps and other commercial providers are explicitly forbidden with a named check (`grid-canton-source-provenance.test.ts` cannot verify licensing itself, but §6.1's instructions plus human review in §19 item 3 are the actual gate here — flagged as a real limitation, not glossed over).

**Private residential exposure:** §12's `RESIDENTIAL_EXPOSURE` check is an ERROR-severity, always-on (not draft-only) rule, and Task 6 is instructed to select only public/commercial/civic assets as named properties/landmarks in the first place (defense in depth: don't create the problem, then also catch it if it happens anyway).

**Nondeterministic compiler behavior:** §5.5's determinism test is the single most load-bearing test in this plan — it's re-run in §19's final gate against real Canton data, not just the synthetic fixture, specifically because synthetic fixtures are more likely to be accidentally deterministic than real data pulled through a real normalization path.

**Nullable/inconsistent IDs:** §5.2 requires `deterministicSlug` to be a pure function of source-provided identifying strings, not a random UUID — the compiler never invents an identity for something the source didn't already name; §5.4's `DUPLICATE_SLUG` check is the backstop.

**Impossible historical transitions:** §5.4's `HISTORICAL_CHRONOLOGY_INVALID`, `HISTORICAL_REFERENCE_LOOP`, and `HISTORICAL_REFERENCE_DANGLING` checks cover exactly the three failure shapes named in the brief (retired-before-built, cyclic predecessor/successor, dangling reference).

**Weak database constraints:** Task 8's importer defensively re-validates before writing anything (§7) and only ever upserts through the existing GRID 4/8 schema's unique constraints — no new table is introduced in this phase that could carry an under-constrained design; if a future task's implementation reveals a genuine gap, §17 requires it be fixed via a new additive migration and an ADR, exactly like GRID 8.

One residual honesty note, matching this codebase's own honesty conventions (`boardroom/BOARDROOM.md`'s honesty rules): §6.1/§19's licensing and real-world-accuracy gates are **process** gates (cite sources, human review) rather than something a test can mechanically prove — a test can confirm every feature *has* a `sourceRefs` entry, not that the underlying real-world claim is *correct*. That limitation is disclosed here rather than papered over with a false "automated licensing/accuracy verification" claim.
