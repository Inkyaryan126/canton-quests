# THE GRID Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish THE GRID as an isolated, multi-city, server-authoritative subsystem inside Canton Quests without changing the live Founder’s Cipher flow.

**Architecture:** Create a `lib/grid` bounded context with reusable city-package contracts, a draft Canton City #001 package, an append-only game-event ledger, multi-city PostGIS-ready runtime tables, a deterministic simulation harness, and a feature-flagged `/grid` foundation screen. All gameplay writes remain server-authoritative; all new `public` tables use RLS and deny browser mutation by default.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5.x, Supabase/PostgreSQL, PostGIS, Vitest 2, existing Canton Quests custom `.cq-*` CSS system.

**Spec:** `docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md`

## Global Constraints

- Canton is City #001, but `lib/grid/core/**` must contain zero Canton-specific names, coordinates, IDs, or rules.
- Adding City #002 must be data/package work, not a Grid Core rewrite.
- Keep Founder’s Cipher, Fair QR Hunt, current XP, drawing ledger, quest tables, and existing player flows untouched.
- Reuse `players.id` as the player identity foreign key; do not create a second authentication/account system.
- All new tables in `public` must have Row Level Security enabled.
- Browser clients must not directly mutate Grid economy, control, season state, or event-ledger rows.
- Do not add `SECURITY DEFINER` functions to `public`.
- Event history is append-only; corrections are compensating events, never UPDATE/DELETE of history.
- PostGIS is geographic infrastructure only; Core game rules operate on normalized IDs and adjacency.
- `GRID_FOUNDATION_ENABLED` defaults to off so unfinished Grid UI cannot accidentally become public.
- No Tailwind utility classes for new UI. Add explicit `.cq-grid-*` classes in `app/globals.css`.
- No new map/3D library in this phase. The existing Leaflet dependency is left untouched; 2.5D rendering is a later plan.
- Every task follows TDD: failing focused test → minimal implementation → focused pass → broader verification → commit.
- Boardroom autonomous runs may edit/test/commit an overnight branch but must not push protected branches, apply production migrations, or deploy.
- Run `npm run lint`, `npm test`, and `npm run build` before declaring the phase complete.
- Do not modify unrelated pre-existing baseline failures to make this phase look green.

---

## Planned File Structure

```text
docs/superpowers/specs/
  2026-09-11-the-grid-multicity-engine-design.md

docs/superpowers/plans/
  2026-09-11-the-grid-foundation.md

lib/grid/
  core/
    types.ts                  # universal Grid contracts only
    city-package.ts           # pure city-package validation
  cities/
    canton/
      founding-season.ts      # City #001 draft package; data only
    registry.ts               # package lookup by city slug
  server/
    feature-flags.ts          # server-only launch gating
    event-ledger.ts           # authoritative append/idempotency logic
    event-ledger-port.ts      # tiny persistence interface for tests/adapters
    supabase-event-ledger.ts  # Supabase adapter
  sim/
    rng.ts                    # deterministic seeded random source
    runner.ts                 # generic deterministic simulation loop

scripts/
  grid-validate-city.ts       # validates a package without mutating DB

app/grid/
  page.tsx                    # feature-flagged foundation status screen

tests/
  grid-city-package.test.ts
  grid-city-registry.test.ts
  grid-feature-flags.test.ts
  grid-event-ledger.test.ts
  grid-simulation.test.ts
  grid-schema-contract.test.ts

supabase/migrations/
  <CLI-created timestamp>_grid_foundation.sql
```

The migration filename is the exact path produced by `npx supabase migration new grid_foundation`; do **not** hand-invent its timestamp.

---

### Task 1: Put the approved Grid design and phase boundary into the repo

**Files:**
- Create: `docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md`
- Create: `docs/superpowers/plans/2026-09-11-the-grid-foundation.md`
- Modify: `DECISIONS.md`
- Modify: `.env.example`
- Test: `tests/grid-feature-flags.test.ts`
- Create: `lib/grid/server/feature-flags.ts`

**Interfaces:**
- Produces: `isGridFoundationEnabled(env?: NodeJS.ProcessEnv): boolean`
- Consumes: no Grid code

- [ ] **Step 1: Copy the approved design and this plan into the canonical repo paths**

Use the exact approved design document from the planning session as:

```text
docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md
```

Save this plan as:

```text
docs/superpowers/plans/2026-09-11-the-grid-foundation.md
```

Do not rewrite or summarize the approved spec during this step.

- [ ] **Step 2: Write the failing feature-flag test**

Create `tests/grid-feature-flags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isGridFoundationEnabled } from '../lib/grid/server/feature-flags';

describe('Grid foundation feature flag', () => {
  it('defaults off', () => {
    expect(isGridFoundationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('only enables for the explicit value 1', () => {
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
npx vitest run tests/grid-feature-flags.test.ts
```

Expected: FAIL because `lib/grid/server/feature-flags.ts` does not exist.

- [ ] **Step 4: Implement the minimal server-only flag helper**

Create `lib/grid/server/feature-flags.ts`:

```ts
export function isGridFoundationEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.GRID_FOUNDATION_ENABLED === '1';
}
```

- [ ] **Step 5: Add the environment flag with a safe default**

Append to `.env.example`:

```dotenv
# THE GRID remains hidden until an explicitly approved launch step.
GRID_FOUNDATION_ENABLED=0
```

- [ ] **Step 6: Record the architecture decision**

Append a dated entry to `DECISIONS.md` with these facts:

```markdown
## 2026-09-11 — THE GRID multi-city engine

- THE GRID launches inside Canton Quests but is an independently bounded multi-city game engine.
- Canton is City #001 and must exist as a city package; Canton-specific data is forbidden inside Grid Core.
- Grid economy, territory control, and leaderboards are separate from Founder’s Cipher XP/drawing entries.
- The first launch is Canton Founding Season; unfinished Grid UI is gated by `GRID_FOUNDATION_ENABLED=0`.
- Important Grid actions use an append-only event ledger.
- Competitive power is earned; real-money monetization cannot buy competitive power.
- Approved design: `docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md`.
```

- [ ] **Step 7: Re-run focused test**

Run:

```bash
npx vitest run tests/grid-feature-flags.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add \
  docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md \
  docs/superpowers/plans/2026-09-11-the-grid-foundation.md \
  DECISIONS.md \
  .env.example \
  lib/grid/server/feature-flags.ts \
  tests/grid-feature-flags.test.ts
git commit -m "docs: lock Grid multi-city foundation"
```

---

### Task 2: Create universal City Package contracts and validation

**Files:**
- Create: `lib/grid/core/types.ts`
- Create: `lib/grid/core/city-package.ts`
- Test: `tests/grid-city-package.test.ts`

**Interfaces:**
- Produces:
  - `GridCityPackage`
  - `GridCityPackageStatus`
  - `GridBalanceConfig`
  - `GridPackageValidation`
  - `validateGridCityPackage(pkg: GridCityPackage): GridPackageValidation`
- Consumes: nothing city-specific

- [ ] **Step 1: Write the failing contract/validation tests**

Create `tests/grid-city-package.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

function basePackage(): GridCityPackage {
  return {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: {
      slug: 'test-city',
      name: 'Test City',
      regionCode: 'OH',
      countryCode: 'US',
      timezone: 'America/New_York',
      mapCenter: { lat: 40.8, lng: -81.37 },
    },
    seasonTemplate: {
      slug: 'founding-season',
      name: 'Founding Season',
      durationDays: 30,
      surgeHours: 72,
      balance: {
        startingCredits: 5000,
        startingInfluence: 100,
        maxCommandPoints: 10,
        commandPointRegenMinutes: 60,
      },
    },
    districts: [],
    territories: [],
    edges: [],
    properties: [],
    landmarks: [],
  };
}

describe('validateGridCityPackage', () => {
  it('allows an intentionally incomplete draft package', () => {
    expect(validateGridCityPackage(basePackage())).toEqual({ ok: true, errors: [] });
  });

  it('requires playable geography before a package may be ready', () => {
    const pkg = basePackage();
    pkg.status = 'ready';

    const result = validateGridCityPackage(pkg);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('ready package requires at least one district');
    expect(result.errors).toContain('ready package requires at least one territory');
  });

  it('rejects duplicate slugs and broken references', () => {
    const pkg = basePackage();
    pkg.districts = [
      { slug: 'downtown', name: 'Downtown' },
      { slug: 'downtown', name: 'Duplicate Downtown' },
    ];
    pkg.territories = [
      {
        slug: 't-1',
        name: 'T1',
        districtSlug: 'missing-district',
        baseValue: 100,
      },
      {
        slug: 't-1',
        name: 'Duplicate T1',
        districtSlug: 'downtown',
        baseValue: 100,
      },
    ];

    const result = validateGridCityPackage(pkg);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate district slug: downtown');
    expect(result.errors).toContain('duplicate territory slug: t-1');
    expect(result.errors).toContain('territory t-1 references unknown district missing-district');
  });

  it('rejects self-edges and edges that reference unknown territory', () => {
    const pkg = basePackage();
    pkg.districts = [{ slug: 'd-1', name: 'District' }];
    pkg.territories = [
      { slug: 'a', name: 'A', districtSlug: 'd-1', baseValue: 100 },
    ];
    pkg.edges = [
      { a: 'a', b: 'a' },
      { a: 'a', b: 'missing' },
    ];

    const result = validateGridCityPackage(pkg);

    expect(result.errors).toContain('territory edge cannot connect a to itself');
    expect(result.errors).toContain('territory edge a -> missing references unknown territory');
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run tests/grid-city-package.test.ts
```

Expected: FAIL because Grid types/validator do not exist.

- [ ] **Step 3: Create the universal types**

Create `lib/grid/core/types.ts`:

```ts
export type GridCityPackageStatus = 'draft' | 'ready';

export interface GridLatLng {
  lat: number;
  lng: number;
}

export interface GridBalanceConfig {
  startingCredits: number;
  startingInfluence: number;
  maxCommandPoints: number;
  commandPointRegenMinutes: number;
}

export interface GridDistrictDefinition {
  slug: string;
  name: string;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
}

export interface GridTerritoryDefinition {
  slug: string;
  name: string;
  districtSlug: string;
  baseValue: number;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
}

export interface GridTerritoryEdgeDefinition {
  a: string;
  b: string;
  edgeType?: 'border' | 'corridor';
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
}

export interface GridLandmarkDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  config?: Record<string, unknown>;
}

export interface GridCityPackage {
  schemaVersion: 1;
  packageVersion: number;
  status: GridCityPackageStatus;
  city: {
    slug: string;
    name: string;
    regionCode: string;
    countryCode: string;
    timezone: string;
    mapCenter: GridLatLng;
  };
  seasonTemplate: {
    slug: string;
    name: string;
    durationDays: number;
    surgeHours: number;
    balance: GridBalanceConfig;
  };
  districts: GridDistrictDefinition[];
  territories: GridTerritoryDefinition[];
  edges: GridTerritoryEdgeDefinition[];
  properties: GridPropertyDefinition[];
  landmarks: GridLandmarkDefinition[];
}

export interface GridPackageValidation {
  ok: boolean;
  errors: string[];
}
```

Do **not** install `@types/geojson` in this task. TypeScript already receives GeoJSON namespace types transitively in the current mapping stack; if the compiler proves otherwise, replace the two `GeoJSON.MultiPolygon` references with a small local `GridMultiPolygon` interface in this same file rather than adding a dependency.

- [ ] **Step 4: Implement pure validation**

Create `lib/grid/core/city-package.ts`:

```ts
import type {
  GridCityPackage,
  GridPackageValidation,
} from './types';

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }

  return [...dupes].sort();
}

export function validateGridCityPackage(
  pkg: GridCityPackage
): GridPackageValidation {
  const errors: string[] = [];

  for (const slug of duplicates(pkg.districts.map((row) => row.slug))) {
    errors.push(`duplicate district slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.territories.map((row) => row.slug))) {
    errors.push(`duplicate territory slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.properties.map((row) => row.slug))) {
    errors.push(`duplicate property slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.landmarks.map((row) => row.slug))) {
    errors.push(`duplicate landmark slug: ${slug}`);
  }

  const districtSlugs = new Set(pkg.districts.map((row) => row.slug));
  const territorySlugs = new Set(pkg.territories.map((row) => row.slug));

  for (const territory of pkg.territories) {
    if (!districtSlugs.has(territory.districtSlug)) {
      errors.push(
        `territory ${territory.slug} references unknown district ${territory.districtSlug}`
      );
    }
    if (!Number.isFinite(territory.baseValue) || territory.baseValue < 0) {
      errors.push(`territory ${territory.slug} has invalid baseValue`);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of pkg.edges) {
    if (edge.a === edge.b) {
      errors.push(`territory edge cannot connect ${edge.a} to itself`);
      continue;
    }

    if (!territorySlugs.has(edge.a) || !territorySlugs.has(edge.b)) {
      errors.push(
        `territory edge ${edge.a} -> ${edge.b} references unknown territory`
      );
      continue;
    }

    const key = [edge.a, edge.b].sort().join('::');
    if (edgeKeys.has(key)) {
      errors.push(`duplicate territory edge: ${key}`);
    }
    edgeKeys.add(key);
  }

  for (const property of pkg.properties) {
    if (!territorySlugs.has(property.territorySlug)) {
      errors.push(
        `property ${property.slug} references unknown territory ${property.territorySlug}`
      );
    }
  }

  for (const landmark of pkg.landmarks) {
    if (!territorySlugs.has(landmark.territorySlug)) {
      errors.push(
        `landmark ${landmark.slug} references unknown territory ${landmark.territorySlug}`
      );
    }
  }

  if (pkg.status === 'ready' && pkg.districts.length === 0) {
    errors.push('ready package requires at least one district');
  }

  if (pkg.status === 'ready' && pkg.territories.length === 0) {
    errors.push('ready package requires at least one territory');
  }

  const balance = pkg.seasonTemplate.balance;
  if (balance.startingCredits < 0) errors.push('startingCredits must be >= 0');
  if (balance.startingInfluence < 0) errors.push('startingInfluence must be >= 0');
  if (balance.maxCommandPoints <= 0) errors.push('maxCommandPoints must be > 0');
  if (balance.commandPointRegenMinutes <= 0) {
    errors.push('commandPointRegenMinutes must be > 0');
  }

  if (
    pkg.seasonTemplate.surgeHours <= 0 ||
    pkg.seasonTemplate.surgeHours >= pkg.seasonTemplate.durationDays * 24
  ) {
    errors.push('surgeHours must fit inside the season duration');
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 5: Run the focused tests**

```bash
npx vitest run tests/grid-city-package.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run type/lint verification for the new files**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/grid/core/types.ts lib/grid/core/city-package.ts tests/grid-city-package.test.ts
git commit -m "feat: add Grid city package contracts"
```

---

### Task 3: Create Canton City #001 as a draft package and add validation CLI

**Files:**
- Create: `lib/grid/cities/canton/founding-season.ts`
- Create: `lib/grid/cities/registry.ts`
- Create: `scripts/grid-validate-city.ts`
- Modify: `package.json`
- Test: `tests/grid-city-registry.test.ts`

**Interfaces:**
- Consumes:
  - `GridCityPackage`
  - `validateGridCityPackage`
- Produces:
  - `cantonFoundingSeasonPackage`
  - `getGridCityPackage(citySlug: string): GridCityPackage | undefined`
  - CLI: `npm run grid:validate-city -- canton-oh`

- [ ] **Step 1: Write the failing registry test**

Create `tests/grid-city-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { getGridCityPackage } from '../lib/grid/cities/registry';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

describe('Grid city package registry', () => {
  it('registers Canton as City #001 without putting Canton in Grid Core', () => {
    const pkg = getGridCityPackage('canton-oh');

    expect(pkg).toBe(cantonFoundingSeasonPackage);
    expect(pkg?.city.name).toBe('Canton');
    expect(pkg?.status).toBe('draft');
    expect(validateGridCityPackage(pkg!)).toEqual({ ok: true, errors: [] });
  });

  it('returns undefined for an unknown city', () => {
    expect(getGridCityPackage('cleveland-oh')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/grid-city-registry.test.ts
```

Expected: FAIL because the package/registry do not exist.

- [ ] **Step 3: Create the draft Canton package**

Create `lib/grid/cities/canton/founding-season.ts`:

```ts
import type { GridCityPackage } from '../../core/types';

export const cantonFoundingSeasonPackage: GridCityPackage = {
  schemaVersion: 1,
  packageVersion: 1,
  status: 'draft',
  city: {
    slug: 'canton-oh',
    name: 'Canton',
    regionCode: 'OH',
    countryCode: 'US',
    timezone: 'America/New_York',
    // Existing Canton Quests central gathering point; this is only the
    // initial map camera anchor, not gameplay geography.
    mapCenter: { lat: 40.7989, lng: -81.3748 },
  },
  seasonTemplate: {
    slug: 'founding-season',
    name: 'Founding Season',
    durationDays: 30,
    surgeHours: 72,
    balance: {
      startingCredits: 5000,
      startingInfluence: 100,
      maxCommandPoints: 10,
      commandPointRegenMinutes: 60,
    },
  },
  // Real districts/territories/properties/landmarks arrive through the
  // City Compiler plan. Empty arrays are intentional while status=draft.
  districts: [],
  territories: [],
  edges: [],
  properties: [],
  landmarks: [],
};
```

Do not add fake geometry just to make the package look fuller.

- [ ] **Step 4: Create the registry**

Create `lib/grid/cities/registry.ts`:

```ts
import type { GridCityPackage } from '../core/types';
import { cantonFoundingSeasonPackage } from './canton/founding-season';

const packages = new Map<string, GridCityPackage>([
  [cantonFoundingSeasonPackage.city.slug, cantonFoundingSeasonPackage],
]);

export function getGridCityPackage(
  citySlug: string
): GridCityPackage | undefined {
  return packages.get(citySlug);
}

export function listGridCityPackages(): GridCityPackage[] {
  return [...packages.values()];
}
```

- [ ] **Step 5: Create a non-mutating city validation CLI**

Create `scripts/grid-validate-city.ts`:

```ts
import { getGridCityPackage } from '../lib/grid/cities/registry';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

const citySlug = process.argv[2];

if (!citySlug) {
  console.error('Usage: npm run grid:validate-city -- <city-slug>');
  process.exit(2);
}

const pkg = getGridCityPackage(citySlug);
if (!pkg) {
  console.error(`Unknown Grid city package: ${citySlug}`);
  process.exit(2);
}

const result = validateGridCityPackage(pkg);
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      city: pkg.city.slug,
      packageVersion: pkg.packageVersion,
      status: pkg.status,
      districts: pkg.districts.length,
      territories: pkg.territories.length,
      properties: pkg.properties.length,
      landmarks: pkg.landmarks.length,
    },
    null,
    2
  )
);
```

- [ ] **Step 6: Add the package script**

Add to `package.json` scripts:

```json
"grid:validate-city": "node ./node_modules/vite-node/vite-node.mjs scripts/grid-validate-city.ts"
```

- [ ] **Step 7: Run tests and CLI**

```bash
npx vitest run tests/grid-city-package.test.ts tests/grid-city-registry.test.ts
npm run grid:validate-city -- canton-oh
```

Expected CLI output includes:

```json
{
  "ok": true,
  "city": "canton-oh",
  "packageVersion": 1,
  "status": "draft",
  "districts": 0,
  "territories": 0,
  "properties": 0,
  "landmarks": 0
}
```

- [ ] **Step 8: Commit**

```bash
git add \
  lib/grid/cities/canton/founding-season.ts \
  lib/grid/cities/registry.ts \
  scripts/grid-validate-city.ts \
  package.json \
  tests/grid-city-registry.test.ts
git commit -m "feat: register Canton Grid city package"
```

---

### Task 4: Add the PostGIS-ready multi-city runtime schema with RLS and immutable history

**Files:**
- Create via CLI: output of `npx supabase migration new grid_foundation`
- Test: `tests/grid-schema-contract.test.ts`

**Interfaces:**
- Produces database tables:
  - `grid_cities`
  - `grid_seasons`
  - `grid_districts`
  - `grid_territories`
  - `grid_territory_edges`
  - `grid_properties`
  - `grid_landmarks`
  - `grid_player_profiles`
  - `grid_player_season_state`
  - `grid_game_events`
- Consumes existing `players(id)`

- [ ] **Step 1: Discover the current CLI and create the migration with the CLI**

Run:

```bash
npx supabase --version
npx supabase migration --help
npx supabase migration new grid_foundation
```

Use the exact migration path printed by the final command. Do not manually name a timestamp.

- [ ] **Step 2: Write the schema contract test before filling the migration**

Create `tests/grid-schema-contract.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationText(): string {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const file = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('_grid_foundation.sql'))
    .sort()
    .at(-1);

  if (!file) throw new Error('grid_foundation migration not found');
  return fs.readFileSync(path.join(dir, file), 'utf8').toLowerCase();
}

describe('Grid foundation migration contract', () => {
  it('creates the required isolated Grid tables', () => {
    const sql = migrationText();

    for (const table of [
      'grid_cities',
      'grid_seasons',
      'grid_districts',
      'grid_territories',
      'grid_territory_edges',
      'grid_properties',
      'grid_landmarks',
      'grid_player_profiles',
      'grid_player_season_state',
      'grid_game_events',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('uses PostGIS and makes event history immutable', () => {
    const sql = migrationText();

    expect(sql).toContain('create extension if not exists postgis');
    expect(sql).toContain('using gist');
    expect(sql).toContain('grid_reject_game_event_mutation');
    expect(sql).toContain('before update or delete on public.grid_game_events');
  });

  it('never creates a security-definer public function', () => {
    const sql = migrationText();

    expect(sql).not.toContain('security definer');
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npx vitest run tests/grid-schema-contract.test.ts
```

Expected: FAIL because the migration is still empty.

- [ ] **Step 4: Put the foundation schema into the CLI-created migration**

Use this SQL in the migration file:

```sql
create extension if not exists postgis with schema extensions;

create table public.grid_cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region_code text not null,
  country_code text not null default 'US',
  timezone text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'retired')),
  map_center extensions.geography(Point, 4326),
  boundary extensions.geometry(MultiPolygon, 4326),
  package_version integer not null default 1 check (package_version > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grid_seasons (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  slug text not null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'surge', 'complete', 'archived')),
  starts_at timestamptz,
  surge_starts_at timestamptz,
  ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug),
  check (
    starts_at is null
    or ends_at is null
    or starts_at < ends_at
  ),
  check (
    surge_starts_at is null
    or starts_at is null
    or ends_at is null
    or (starts_at < surge_starts_at and surge_starts_at < ends_at)
  )
);

create table public.grid_districts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  slug text not null,
  name text not null,
  boundary extensions.geometry(MultiPolygon, 4326),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_territories (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  district_id uuid not null references public.grid_districts(id) on delete restrict,
  slug text not null,
  name text not null,
  boundary extensions.geometry(MultiPolygon, 4326),
  centroid extensions.geography(Point, 4326),
  base_value bigint not null default 0 check (base_value >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_territory_edges (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_a_id uuid not null references public.grid_territories(id) on delete cascade,
  territory_b_id uuid not null references public.grid_territories(id) on delete cascade,
  edge_type text not null default 'border'
    check (edge_type in ('border', 'corridor')),
  created_at timestamptz not null default now(),
  check (territory_a_id <> territory_b_id)
);

create unique index grid_territory_edges_pair_uq
  on public.grid_territory_edges (
    city_id,
    least(territory_a_id, territory_b_id),
    greatest(territory_a_id, territory_b_id)
  );

create table public.grid_properties (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_id uuid not null references public.grid_territories(id) on delete restrict,
  slug text not null,
  display_name text not null,
  external_ref text,
  public_name_safe boolean not null default false,
  boundary extensions.geometry(MultiPolygon, 4326),
  point extensions.geography(Point, 4326),
  base_value bigint not null default 0 check (base_value >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_landmarks (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  territory_id uuid references public.grid_territories(id) on delete set null,
  slug text not null,
  name text not null,
  point extensions.geography(Point, 4326),
  boundary extensions.geometry(MultiPolygon, 4326),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.grid_player_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  home_city_id uuid references public.grid_cities(id) on delete set null,
  global_reputation bigint not null default 0 check (global_reputation >= 0),
  passport jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grid_player_season_state (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  credits bigint not null default 0 check (credits >= 0),
  influence integer not null default 0 check (influence >= 0),
  command_points integer not null default 0 check (command_points >= 0),
  command_points_updated_at timestamptz not null default now(),
  city_power bigint not null default 0 check (city_power >= 0),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, player_id)
);

create table public.grid_game_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete restrict,
  season_id uuid references public.grid_seasons(id) on delete restrict,
  actor_player_id uuid references public.players(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  correlation_id uuid,
  causation_id uuid references public.grid_game_events(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index grid_game_events_idempotency_uq
  on public.grid_game_events (season_id, idempotency_key)
  where idempotency_key is not null;

create index grid_cities_boundary_gix
  on public.grid_cities using gist (boundary);
create index grid_cities_center_gix
  on public.grid_cities using gist (map_center);
create index grid_districts_boundary_gix
  on public.grid_districts using gist (boundary);
create index grid_territories_boundary_gix
  on public.grid_territories using gist (boundary);
create index grid_territories_centroid_gix
  on public.grid_territories using gist (centroid);
create index grid_properties_boundary_gix
  on public.grid_properties using gist (boundary);
create index grid_properties_point_gix
  on public.grid_properties using gist (point);
create index grid_landmarks_point_gix
  on public.grid_landmarks using gist (point);
create index grid_game_events_season_created_idx
  on public.grid_game_events (season_id, created_at desc);
create index grid_game_events_actor_created_idx
  on public.grid_game_events (actor_player_id, created_at desc);

create or replace function public.grid_reject_game_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'grid_game_events is append-only; write a compensating event instead';
end;
$$;

create trigger grid_game_events_immutable
before update or delete on public.grid_game_events
for each row execute function public.grid_reject_game_event_mutation();

alter table public.grid_cities enable row level security;
alter table public.grid_seasons enable row level security;
alter table public.grid_districts enable row level security;
alter table public.grid_territories enable row level security;
alter table public.grid_territory_edges enable row level security;
alter table public.grid_properties enable row level security;
alter table public.grid_landmarks enable row level security;
alter table public.grid_player_profiles enable row level security;
alter table public.grid_player_season_state enable row level security;
alter table public.grid_game_events enable row level security;

revoke insert, update, delete on public.grid_cities from anon, authenticated;
revoke insert, update, delete on public.grid_seasons from anon, authenticated;
revoke insert, update, delete on public.grid_districts from anon, authenticated;
revoke insert, update, delete on public.grid_territories from anon, authenticated;
revoke insert, update, delete on public.grid_territory_edges from anon, authenticated;
revoke insert, update, delete on public.grid_properties from anon, authenticated;
revoke insert, update, delete on public.grid_landmarks from anon, authenticated;
revoke insert, update, delete on public.grid_player_profiles from anon, authenticated;
revoke insert, update, delete on public.grid_player_season_state from anon, authenticated;
revoke insert, update, delete on public.grid_game_events from anon, authenticated;
```

Do not add permissive SELECT policies yet. Phase 1 reads use server-side code. Public map projections are designed in the map/API plan instead of exposing raw geometry/state tables casually.

- [ ] **Step 5: Run the schema contract test**

```bash
npx vitest run tests/grid-schema-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Apply the migration locally only**

First inspect supported commands:

```bash
npx supabase db --help
```

Then start/reset the local stack using the repo’s supported CLI flow:

```bash
npx supabase start
npx supabase db reset
```

Expected: all migrations apply successfully through the new Grid foundation migration.

Do **not** apply this migration to production in this task.

- [ ] **Step 7: Verify RLS and tables locally**

Use the current CLI’s supported SQL/query mechanism discovered via `--help`, or local `psql` if already installed, to run:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'grid_%'
order by tablename;
```

Expected: all ten Grid tables exist and `rowsecurity = true`.

Then verify PostGIS:

```sql
select extname from pg_extension where extname = 'postgis';
```

Expected: one row.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/*_grid_foundation.sql tests/grid-schema-contract.test.ts
git commit -m "feat: add Grid multi-city database foundation"
```

---

### Task 5: Implement an idempotent, append-only Grid event-ledger service

**Files:**
- Create: `lib/grid/server/event-ledger-port.ts`
- Create: `lib/grid/server/event-ledger.ts`
- Create: `lib/grid/server/supabase-event-ledger.ts`
- Test: `tests/grid-event-ledger.test.ts`

**Interfaces:**
- Produces:
  - `GridEventInput`
  - `GridGameEvent`
  - `GridEventLedgerPort`
  - `appendGridEvent(port, input): Promise<GridGameEvent>`
  - `createSupabaseGridEventLedgerPort()`
- Consumes: `supabaseAdmin` from `lib/supabase.ts`

- [ ] **Step 1: Write the failing event-ledger behavior tests**

Create `tests/grid-event-ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  appendGridEvent,
  type GridEventInput,
  type GridGameEvent,
} from '../lib/grid/server/event-ledger';
import type { GridEventLedgerPort } from '../lib/grid/server/event-ledger-port';

function input(): GridEventInput {
  return {
    cityId: '00000000-0000-4000-8000-000000000001',
    seasonId: '00000000-0000-4000-8000-000000000002',
    actorPlayerId: '00000000-0000-4000-8000-000000000003',
    eventType: 'PLAYER_SEASON_JOINED',
    entityType: 'player',
    entityId: '00000000-0000-4000-8000-000000000003',
    payload: { source: 'test' },
    idempotencyKey: 'join:player-3',
  };
}

describe('appendGridEvent', () => {
  it('returns the inserted event', async () => {
    const expected: GridGameEvent = {
      id: '00000000-0000-4000-8000-000000000004',
      ...input(),
      correlationId: null,
      causationId: null,
      createdAt: '2026-09-11T00:00:00.000Z',
    };

    const port: GridEventLedgerPort = {
      insert: async () => ({ event: expected, duplicate: false }),
      getByIdempotencyKey: async () => null,
    };

    await expect(appendGridEvent(port, input())).resolves.toEqual(expected);
  });

  it('returns the existing event on an idempotency collision', async () => {
    const expected: GridGameEvent = {
      id: '00000000-0000-4000-8000-000000000004',
      ...input(),
      correlationId: null,
      causationId: null,
      createdAt: '2026-09-11T00:00:00.000Z',
    };

    const port: GridEventLedgerPort = {
      insert: async () => ({ event: null, duplicate: true }),
      getByIdempotencyKey: async () => expected,
    };

    await expect(appendGridEvent(port, input())).resolves.toEqual(expected);
  });

  it('throws when a duplicate is reported but the existing event cannot be found', async () => {
    const port: GridEventLedgerPort = {
      insert: async () => ({ event: null, duplicate: true }),
      getByIdempotencyKey: async () => null,
    };

    await expect(appendGridEvent(port, input())).rejects.toThrow(
      'Grid idempotency collision could not be reconciled'
    );
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/grid-event-ledger.test.ts
```

Expected: FAIL because the ledger modules do not exist.

- [ ] **Step 3: Define the persistence port**

Create `lib/grid/server/event-ledger-port.ts`:

```ts
import type {
  GridEventInput,
  GridGameEvent,
} from './event-ledger';

export interface GridEventLedgerInsertResult {
  event: GridGameEvent | null;
  duplicate: boolean;
}

export interface GridEventLedgerPort {
  insert(input: GridEventInput): Promise<GridEventLedgerInsertResult>;
  getByIdempotencyKey(
    seasonId: string | null,
    idempotencyKey: string
  ): Promise<GridGameEvent | null>;
}
```

- [ ] **Step 4: Implement the domain service**

Create `lib/grid/server/event-ledger.ts`:

```ts
import type { GridEventLedgerPort } from './event-ledger-port';

export type GridJson =
  | null
  | boolean
  | number
  | string
  | GridJson[]
  | { [key: string]: GridJson };

export interface GridEventInput {
  cityId: string;
  seasonId: string | null;
  actorPlayerId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: { [key: string]: GridJson };
  idempotencyKey?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
}

export interface GridGameEvent extends GridEventInput {
  id: string;
  actorPlayerId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: { [key: string]: GridJson };
  idempotencyKey: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: string;
}

export async function appendGridEvent(
  port: GridEventLedgerPort,
  input: GridEventInput
): Promise<GridGameEvent> {
  const result = await port.insert(input);

  if (result.event) return result.event;

  if (result.duplicate && input.idempotencyKey) {
    const existing = await port.getByIdempotencyKey(
      input.seasonId,
      input.idempotencyKey
    );

    if (existing) return existing;
    throw new Error('Grid idempotency collision could not be reconciled');
  }

  throw new Error('Grid event insert failed without a persisted event');
}
```

- [ ] **Step 5: Implement the Supabase adapter**

Create `lib/grid/server/supabase-event-ledger.ts`:

```ts
import { supabaseAdmin } from '../../supabase';
import type {
  GridEventInput,
  GridGameEvent,
} from './event-ledger';
import type {
  GridEventLedgerPort,
  GridEventLedgerInsertResult,
} from './event-ledger-port';

function mapEvent(row: any): GridGameEvent {
  return {
    id: row.id,
    cityId: row.city_id,
    seasonId: row.season_id,
    actorPlayerId: row.actor_player_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload || {},
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: row.created_at,
  };
}

export function createSupabaseGridEventLedgerPort(): GridEventLedgerPort {
  if (!supabaseAdmin) {
    throw new Error('Grid event ledger requires Supabase service-role configuration');
  }

  return {
    async insert(input: GridEventInput): Promise<GridEventLedgerInsertResult> {
      const { data, error } = await supabaseAdmin
        .from('grid_game_events')
        .insert({
          city_id: input.cityId,
          season_id: input.seasonId,
          actor_player_id: input.actorPlayerId ?? null,
          event_type: input.eventType,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          payload: input.payload ?? {},
          idempotency_key: input.idempotencyKey ?? null,
          correlation_id: input.correlationId ?? null,
          causation_id: input.causationId ?? null,
        })
        .select()
        .single();

      if (error?.code === '23505') {
        return { event: null, duplicate: true };
      }

      if (error || !data) {
        throw new Error(`Failed to append Grid event: ${error?.message || 'unknown error'}`);
      }

      return { event: mapEvent(data), duplicate: false };
    },

    async getByIdempotencyKey(
      seasonId: string | null,
      idempotencyKey: string
    ): Promise<GridGameEvent | null> {
      let query = supabaseAdmin
        .from('grid_game_events')
        .select('*')
        .eq('idempotency_key', idempotencyKey);

      query =
        seasonId === null
          ? query.is('season_id', null)
          : query.eq('season_id', seasonId);

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(`Failed to reconcile Grid event: ${error.message}`);
      }

      return data ? mapEvent(data) : null;
    },
  };
}
```

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run tests/grid-event-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add \
  lib/grid/server/event-ledger-port.ts \
  lib/grid/server/event-ledger.ts \
  lib/grid/server/supabase-event-ledger.ts \
  tests/grid-event-ledger.test.ts
git commit -m "feat: add immutable Grid event ledger service"
```

---

### Task 6: Add a deterministic simulation foundation before adding gameplay math

**Files:**
- Create: `lib/grid/sim/rng.ts`
- Create: `lib/grid/sim/runner.ts`
- Test: `tests/grid-simulation.test.ts`

**Interfaces:**
- Produces:
  - `createSeededRng(seed: number): () => number`
  - `runGridSimulation<T>(params): T[]`
- Consumes: no DB and no city package

- [ ] **Step 1: Write failing deterministic-simulation tests**

Create `tests/grid-simulation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../lib/grid/sim/rng';
import { runGridSimulation } from '../lib/grid/sim/runner';

describe('Grid simulation foundation', () => {
  it('produces identical random streams for the same seed', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('replays a scenario deterministically', () => {
    const run = () =>
      runGridSimulation({
        seed: 42,
        steps: 5,
        initialState: 0,
        advance: (state, rng) => state + (rng() > 0.5 ? 2 : 1),
      });

    expect(run()).toEqual(run());
    expect(run()).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Verify the test fails**

```bash
npx vitest run tests/grid-simulation.test.ts
```

Expected: FAIL because simulation modules do not exist.

- [ ] **Step 3: Implement seeded RNG**

Create `lib/grid/sim/rng.ts`:

```ts
export function createSeededRng(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Implement the generic runner**

Create `lib/grid/sim/runner.ts`:

```ts
import { createSeededRng } from './rng';

export interface GridSimulationParams<T> {
  seed: number;
  steps: number;
  initialState: T;
  advance: (state: T, rng: () => number, step: number) => T;
}

export function runGridSimulation<T>(
  params: GridSimulationParams<T>
): T[] {
  if (!Number.isInteger(params.steps) || params.steps < 0) {
    throw new Error('Grid simulation steps must be a non-negative integer');
  }

  const rng = createSeededRng(params.seed);
  const states: T[] = [params.initialState];
  let current = params.initialState;

  for (let step = 0; step < params.steps; step += 1) {
    current = params.advance(current, rng, step);
    states.push(current);
  }

  return states;
}
```

- [ ] **Step 5: Run the focused test**

```bash
npx vitest run tests/grid-simulation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/grid/sim/rng.ts lib/grid/sim/runner.ts tests/grid-simulation.test.ts
git commit -m "test: add deterministic Grid simulation harness"
```

---

### Task 7: Add a hidden `/grid` foundation screen without exposing unfinished gameplay

**Files:**
- Create: `app/grid/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/grid-feature-flags.test.ts`

**Interfaces:**
- Consumes:
  - `isGridFoundationEnabled`
  - `cantonFoundingSeasonPackage`
  - `validateGridCityPackage`
- Produces: feature-gated `/grid` route

- [ ] **Step 1: Extend the feature-flag test with the route-facing rule**

Add this test to `tests/grid-feature-flags.test.ts`:

```ts
it('does not treat missing or accidental truthy strings as launch approval', () => {
  for (const value of [undefined, '', 'yes', 'TRUE', 'enabled']) {
    expect(
      isGridFoundationEnabled(
        { GRID_FOUNDATION_ENABLED: value } as NodeJS.ProcessEnv
      )
    ).toBe(false);
  }
});
```

- [ ] **Step 2: Run focused test**

```bash
npx vitest run tests/grid-feature-flags.test.ts
```

Expected: PASS with the existing strict helper.

- [ ] **Step 3: Create the server-rendered foundation page**

Create `app/grid/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { cantonFoundingSeasonPackage } from '../../lib/grid/cities/canton/founding-season';
import { validateGridCityPackage } from '../../lib/grid/core/city-package';
import { isGridFoundationEnabled } from '../../lib/grid/server/feature-flags';

export const dynamic = 'force-dynamic';

export default function GridFoundationPage() {
  if (!isGridFoundationEnabled()) notFound();

  const pkg = cantonFoundingSeasonPackage;
  const validation = validateGridCityPackage(pkg);

  return (
    <main className="cq-grid-foundation">
      <section className="cq-grid-foundation__panel">
        <p className="cq-grid-foundation__eyebrow">THE GRID</p>
        <h1 className="cq-grid-foundation__title">Canton — City #001</h1>
        <p className="cq-grid-foundation__season">Founding Season</p>
        <p className="cq-grid-foundation__copy">
          Multi-city engine foundation online. Gameplay remains locked while
          Canton geography and core systems are built and validated.
        </p>

        <dl className="cq-grid-foundation__status">
          <div>
            <dt>Package</dt>
            <dd>v{pkg.packageVersion}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{pkg.status.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Validation</dt>
            <dd>{validation.ok ? 'PASS' : 'BLOCKED'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add explicit CQ-prefixed CSS only**

Append to `app/globals.css`:

```css
.cq-grid-foundation {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 20%, rgba(35, 219, 255, 0.13), transparent 36%),
    #090c0f;
  color: #f4f5f5;
}

.cq-grid-foundation__panel {
  width: min(100%, 720px);
  padding: 28px;
  border: 1px solid rgba(211, 174, 79, 0.45);
  border-radius: 18px;
  background: rgba(13, 17, 21, 0.94);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
}

.cq-grid-foundation__eyebrow {
  margin: 0 0 8px;
  color: #d3ae4f;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.cq-grid-foundation__title {
  margin: 0;
  font-size: clamp(2rem, 8vw, 4.5rem);
  line-height: 0.95;
}

.cq-grid-foundation__season {
  margin: 12px 0 0;
  color: #23dbff;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cq-grid-foundation__copy {
  max-width: 58ch;
  margin: 20px 0 0;
  color: rgba(244, 245, 245, 0.78);
  line-height: 1.6;
}

.cq-grid-foundation__status {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 28px 0 0;
}

.cq-grid-foundation__status div {
  padding: 14px;
  border: 1px solid rgba(244, 245, 245, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.cq-grid-foundation__status dt {
  color: rgba(244, 245, 245, 0.55);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cq-grid-foundation__status dd {
  margin: 5px 0 0;
  font-weight: 800;
}

@media (max-width: 560px) {
  .cq-grid-foundation {
    padding: 14px;
  }

  .cq-grid-foundation__panel {
    padding: 20px;
  }

  .cq-grid-foundation__status {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify hidden-default behavior locally**

With no Grid flag set:

```bash
unset GRID_FOUNDATION_ENABLED
npm run dev
```

Visit `/grid`.

Expected: Next.js 404.

Then restart with:

```bash
GRID_FOUNDATION_ENABLED=1 npm run dev
```

Visit `/grid`.

Expected: foundation status screen renders; no gameplay controls exist.

- [ ] **Step 6: Run focused and static verification**

```bash
npx vitest run \
  tests/grid-feature-flags.test.ts \
  tests/grid-city-package.test.ts \
  tests/grid-city-registry.test.ts
npm run lint
npm run build
```

Expected: all focused tests pass; lint/build produce no new Grid failures.

- [ ] **Step 7: Commit**

```bash
git add app/grid/page.tsx app/globals.css tests/grid-feature-flags.test.ts
git commit -m "feat: add hidden Grid foundation route"
```

---

### Task 8: Foundation acceptance gate

**Files:**
- No new production files expected
- Update only this plan’s checkbox state/reporting if the repo workflow tracks plan progress

**Interfaces:**
- Consumes all Task 1–7 deliverables
- Produces a verified foundation commit chain ready for the next Grid plan

- [ ] **Step 1: Run every Grid-focused test**

```bash
npx vitest run \
  tests/grid-feature-flags.test.ts \
  tests/grid-city-package.test.ts \
  tests/grid-city-registry.test.ts \
  tests/grid-schema-contract.test.ts \
  tests/grid-event-ledger.test.ts \
  tests/grid-simulation.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Validate City #001 package**

```bash
npm run grid:validate-city -- canton-oh
```

Expected: `ok: true`, `status: draft`, and no fake geography.

- [ ] **Step 3: Re-run the local database from zero**

```bash
npx supabase start
npx supabase db reset
```

Expected: clean reset and all migrations, including Grid foundation, apply successfully.

- [ ] **Step 4: Confirm the Grid migration did not touch existing CQ runtime tables**

Inspect the Grid migration diff/file and verify it only:
- enables PostGIS if absent
- creates `grid_*` objects
- references `players(id)`
- does not UPDATE/DELETE/ALTER quest, event, XP, drawing, Fair QR, Founder’s Cipher, or auth data

Any unexpected existing-table mutation blocks completion.

- [ ] **Step 5: Run full repository verification**

```bash
npm run lint
npm test
npm run build
git status --short
```

Acceptance:
- no new lint errors
- no new test failures beyond already-known unrelated baseline failures
- build passes
- working tree is clean after commits
- no production migration has been applied
- no deployment has been triggered

- [ ] **Step 6: Review architecture boundary with a code search**

Run:

```bash
grep -RniE 'Canton|canton-oh|40\.7989|-81\.3748' lib/grid/core lib/grid/server lib/grid/sim || true
```

Expected:
- no Canton-specific result in `lib/grid/core`
- no Canton-specific result in `lib/grid/server`
- no Canton-specific result in `lib/grid/sim`

Canton references are allowed only under `lib/grid/cities/canton/**` and player-facing foundation copy.

- [ ] **Step 7: Produce the phase report**

The completion report must include:
- commit hashes from Tasks 1–7
- focused Grid test count/result
- full suite result
- lint result
- build result
- local Supabase reset result
- exact migration filename generated by CLI
- confirmation `GRID_FOUNDATION_ENABLED` defaults off
- confirmation no production migration/deployment occurred
- any pre-existing unrelated failures, identified separately

Do not claim this phase complete without the evidence above.

---

## Follow-On Plan Sequence

Do not pull these into the Foundation plan. Each gets its own spec-derived implementation plan and acceptance gate.

1. **City Compiler + Canton Geography**
   - approved map/parcels/district sources
   - geometry normalization
   - privacy classification
   - adjacency compiler
   - Canton real territories/properties/landmarks
   - package importer and validation

2. **Season Economy + Ownership + Property Development**
   - join season
   - Credits / Influence / Command Point regeneration
   - neutral claims
   - territory control projection
   - property acquisition
   - branching Commerce / Influence / Fortress / Intel / Prestige development
   - Skyline bonuses
   - deterministic economy simulation

3. **Contests + Signal Dice + Offline Defense**
   - adjacency attack rules
   - Influence commitment
   - Risk-style dice comparisons
   - Pressure / Flank / Fortify / Feint
   - defensive doctrines
   - takeover damage
   - replayable event history
   - contest simulation and balance tests

4. **2.5D Map + Mobile Onboarding**
   - optimized geography API/projections
   - zoom-dependent rendering
   - player territory styling
   - virtual structures
   - first 10-minute onboarding
   - return summary
   - realtime state updates
   - outdoor/mobile performance

5. **NPC Factions + Dynamic Events + City Power + Surge**
   - neutral factions
   - PvE landmark control
   - event templates
   - Dominance Heat
   - City Power
   - specialist leaderboards
   - 72-hour Surge
   - anti-snowball simulations

6. **Alliances + Market + Trading**
   - alliance map networks
   - shared projects
   - coordination costs
   - auctions
   - direct atomic trades
   - transaction tax
   - collusion detection
   - alliance leaderboard

7. **Multi-City / Visitor Economy + Grid Passport**
   - Home City
   - visitor caps
   - residency
   - isolated local economies
   - national reputation
   - passport history
   - City #002 acceptance test proving zero Core changes

8. **Grid Boardroom Specialization + Launch Hardening**
   - logical GRID Architect/Game Director/Balance/Mapper/Backend/UI/QA/Exploit/Launch roles mapped onto existing Astra/Claude/Agy Boardroom
   - simulation campaigns
   - exploit campaigns
   - performance/accessibility gates
   - production migration review
   - Founding Season launch checklist

---

## Self-Review

### Spec coverage for this plan

This Foundation plan intentionally implements only the approved architecture prerequisites:
- Core/City Package separation
- Canton as City #001 package
- global-player linkage to existing `players`
- multi-city database keys
- PostGIS-ready geography
- append-only event ledger
- deterministic simulation foundation
- hidden launch surface
- RLS/server-authoritative write boundary
- no impact on Founder’s Cipher

All gameplay systems are explicitly assigned to follow-on plans above instead of being left ambiguous.

### Placeholder scan

There are no TODO/TBD implementation instructions. The only variable path is the migration filename, which is deliberately generated by `supabase migration new grid_foundation` per the repository’s Supabase workflow rather than guessed in advance.

### Type consistency

- City registry consumes the `GridCityPackage` created in Task 2.
- Event-ledger port and adapter use the same `GridEventInput` / `GridGameEvent` contracts.
- Canton data exists only below `lib/grid/cities/canton`.
- Simulation harness has no dependency on Canton or Supabase.
- `/grid` consumes the same package validator used by CLI/tests.
