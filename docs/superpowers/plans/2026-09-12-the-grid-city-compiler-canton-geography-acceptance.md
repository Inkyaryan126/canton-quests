# THE GRID — City Compiler + Canton Geography Acceptance Record

**Date:** 2026-09-14  
**Branch:** `boardroom/astra-overnight-20260913-015618-c5cc`  
**Status:** ACCEPTED — compiler phase complete

This record closes out `docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography.md` through GRID Compiler 9. The phase converts the Grid foundation from a hand-authored empty Canton stub into a deterministic, provenance-backed city compiler with a real Canton City #001 package and a local-only database import boundary.

## Commits accepted

| Commit | Task |
|---|---|
| `368d403` | GRID Compiler 1: contracts, provenance, historical and privacy types |
| `38dfa70` | GRID Compiler 2: geometry normalization utilities |
| `ad89534` | GRID Compiler 3: adjacency and synthetic geography |
| `7a0db70` | Refactor: shared city-agnostic geometry helpers |
| `51e5a5c` | GRID Compiler 4: severity-graded validation engine |
| `4a4eca3` | GRID Compiler 5: deterministic city compiler pipeline |
| `6c7d649` | GRID Compiler 6: real Canton downtown geography sources |
| `d0b15e4` | GRID Compiler 6: validate official Canton boundary topology |
| `7a92efa` | GRID Compiler 7: assemble real Canton city package |
| `1d8c27c` | GRID Compiler 8: add local city import boundary |
| `893595b` | GRID Compiler 9: CLI tooling and acceptance gate |

## Real Canton package accepted

`npm run grid:compile-city -- canton-oh` and `npm run grid:inspect-city -- canton-oh` both resolved the same deterministic package:

```text
city: Canton (canton-oh)
compiler: 1.0.0
source snapshot: canton-downtown-slice-v1
districts: 1
territories: 20
edges: 48
properties: 11
landmarks: 6
checksum: a72cd0f064f11ffc51231477c5f788ed7c577da08791c88f0f5886d3f37ad8f4
```

Validation review:

```text
ERROR: 0
WARNING: 0
INFO: 0
unclassified assets: none
disconnected zones: none
```

The package remains `draft`; this acceptance does not mark a city package `ready`, enable claiming/economy gameplay, or import it into production.

## Geography and provenance review

The checked-in Canton compiler source snapshot uses real licensed/public data rather than fabricated geography:

- **U.S. Census Bureau TIGER/Line 2025 — Ohio Places:** Canton incorporated-place boundary, GEOID `3912000`; public-domain U.S. Government work.
- **U.S. Census Bureau TIGERweb — Census Block Groups:** real downtown district source geometry; public-domain U.S. Government work.
- **U.S. Census Bureau TIGERweb — 2020 Census Blocks:** 20 connected real downtown Canton blocks used as Grid territories; public-domain U.S. Government work.
- **OpenStreetMap via Overpass:** 11 selected public/commercial/civic/cultural property candidates and 6 public/civic/cultural/park landmarks; ODbL 1.0 with `© OpenStreetMap contributors` attribution retained.

Every checked-in geography feature resolves `sourceRefs` to `provenance.json`. Google Maps/Places and other commercial-provider geometry were not used.

A separate research-only Census Transportation acquisition was also performed on 2026-09-14 and is intentionally not part of the accepted compiler snapshot yet. It fetched 12 primary, 81 secondary, and 4,123 local-road source features by Canton's municipal bounding box, then clipped them against the real municipal polygon to 12 primary, 67 secondary, and 2,251 local road features with **0 containment violations**. Those files remain under local `research/grid/canton/source-data/` for the next road-network/world-map phase and were not silently promoted into territories or committed as accepted city-package inputs.

## Human inspection findings

`npm run grid:inspect-city -- canton-oh` produced the required human-readable review artifact.

- Validation: zero ERROR/WARNING/INFO issues.
- Privacy: no `PRIVACY_UNCLASSIFIED` assets.
- Connectivity: no `TERRITORY_ISLAND` assets.
- Historical metadata: 37 territory/property/landmark assets currently have no historical metadata. This is intentional omission, not fabricated history; partially-populated historical records: 0.
- Provenance citations: Census block-group source cited by 1 asset; Census block source cited by 20 assets; OSM source cited by 17 named assets. The municipal boundary source is package-level boundary provenance and therefore reports zero district/property/landmark asset citations in the inspector's asset citation count.

## Final acceptance tests

**Focused Grid suite:**

```text
Test Files  17 passed (17)
Tests       143 passed | 2 skipped (145)
Duration    42.25s
```

The two skipped tests are the guarded local-Supabase integration cases in `grid-city-importer.test.ts`; the non-DB importer contract test passed. No remote database was used to force those integration tests on.

The final acceptance test includes:

- compiler/core architecture-boundary scan,
- deterministic double compile against real Canton geography,
- zero ERROR-severity validation issues for real Canton,
- a 500-territory synthetic scale smoke test with full adjacency checking.

The 500-territory acceptance case completed successfully; the standalone synthetic adjacency test reported `computeAdjacency(500 territories) took 35.27ms` on this Mac.

## CLI acceptance

`npm run grid:validate-city -- canton-oh`:

```json
{
  "ok": true,
  "issues": []
}
```

`npm run grid:compile-city -- canton-oh` prints the human-readable counts/checksum above and exits 0.

`npm run grid:compile-city -- canton-oh --write` writes only to the gitignored local scratch path `.grid-output/canton-oh.compiled.json`; it does not rewrite committed city sources or packages.

`npm run grid:inspect-city -- canton-oh` prints summary counts, validation by severity, unclassified assets, disconnected zones, historical unknowns, and provenance summary as required.

The upgraded `grid:validate-city` keeps the legacy `validateGridCityPackage` path for packages without `compilerVersion`, while compiler-produced packages use `runCityValidation`.

## Architecture boundary

The final manual gate:

```text
grep -rniE "canton|stark county|ohio" lib/grid/geo lib/grid/compiler
```

returned zero matches (`ARCHITECTURE_GREP_OK`). The same invariant is enforced automatically by `tests/grid-compiler-acceptance.test.ts`.

Canton-specific source data and assembly remain under `lib/grid/cities/canton/`; the reusable geometry/compiler layers contain no Canton, Stark County, or Ohio names.

## Lint and production build

- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — completed successfully on Next.js 14.2.35.
- The build completed all 77 static-page generation steps and emitted the expected application route table.

Existing Next.js `DYNAMIC_SERVER_USAGE` diagnostic logging from request-dependent API routes appeared during static generation, as on prior successful builds; it did not fail the build.

## Database/import safety

Compiler 8 added a **local import boundary**, not a production import action. During this acceptance pass:

- no `supabase db push` was run,
- no `supabase migration up --linked` was run,
- no remote Supabase mutation/import command was run,
- no compiled Canton package was imported into production,
- no city was marked `ready`,
- no production Grid economy/ownership/gameplay system was enabled.

The importer remains guarded by the repo's safe-test Supabase mutation checks and the database integration tests remain explicitly opt-in.

## Separate public website deployment — documented exception

The original plan's production-safety wording says no deploy should occur during compiler acceptance. On 2026-09-14, at the owner's explicit request that the website reflect current Grid work immediately, a **separate isolated worktree based on production `main`** was used to build and deploy an informational public Grid status experience.

That deployment is commit `82c70c5` (`Add public Grid build status experience`) and contains only:

- `app/grid/page.tsx`
- a homepage link/status card in `app/page.tsx`
- `/grid` in `app/sitemap.ts`

It does **not** contain any of the City Compiler branch commits, database importer code, Grid migrations, geography source packages, or runtime gameplay changes. The UI-only worktree passed lint and a full production build before push. This exception is recorded here rather than incorrectly claiming that no deploy of any kind occurred during the broader session.

The safety invariant that matters for this phase remains satisfied: **no compiler code, compiled city package, database migration, or Grid gameplay state was deployed or written to production.**

## Acceptance conclusion

City Compiler + Canton Geography (Compiler 1–9) is **ACCEPTED**.

The Grid now has a deterministic, city-agnostic compiler pipeline and a real, provenance-backed Canton City #001 downtown package with zero validation errors and a guarded local import boundary. The next implementation phase may build player-visible world/economy/ownership systems on top of this accepted map foundation without inventing Canton geography or coupling Canton-specific data into Grid Core.
