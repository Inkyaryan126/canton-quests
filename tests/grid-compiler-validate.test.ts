import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import type { GridProvenanceRecord, GridRawGeography, GridValidationIssue } from '../lib/grid/compiler/types';
import { runCityValidation } from '../lib/grid/compiler/validate-package';

function square(x0: number, y0: number, x1: number, y1: number): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]],
  };
}

function bowtie(): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [[[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]],
  };
}

function provenanceRecord(id: string): GridProvenanceRecord {
  return {
    id,
    sourceName: 'Test Source',
    sourceUrl: 'https://example.com/source',
    license: 'ODbL 1.0',
    retrievedAt: '2026-01-01',
    transformation: 'none',
    attribution: '© Test',
    confidence: 'confirmed',
  };
}

function emptyPackage(): GridCityPackage {
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
      mapCenter: { lat: 0, lng: 0 },
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

function findIssue(issues: GridValidationIssue[], code: string): GridValidationIssue | undefined {
  return issues.find((issue) => issue.code === code);
}

describe('runCityValidation', () => {
  it('produces zero issues for a clean, fully-sourced draft package', () => {
    const provenance = provenanceRecord('src-1');
    const pkg = emptyPackage();
    pkg.provenance = [provenance];
    pkg.districts = [{ slug: 'downtown', name: 'Downtown', sourceRefs: [provenance.id] }];
    pkg.territories = [
      {
        slug: 't1',
        name: 'Territory 1',
        districtSlug: 'downtown',
        baseValue: 100,
        geometry: square(0, 0, 2, 2),
        sourceRefs: [provenance.id],
      },
    ];
    pkg.properties = [
      {
        slug: 'p1',
        name: 'Property 1',
        territorySlug: 't1',
        baseValue: 10,
        publicNameSafe: true,
        privacyClass: 'COMMERCIAL',
        sourceRefs: [provenance.id],
      },
    ];
    pkg.landmarks = [
      {
        slug: 'l1',
        name: 'Landmark 1',
        territorySlug: 't1',
        point: { lat: 0.5, lng: 0.5 },
        privacyClass: 'PUBLIC_CIVIC',
        sourceRefs: [provenance.id],
      },
    ];

    const raw: GridRawGeography = {
      citySlug: 'test-city',
      cityBoundary: square(-10, -10, 10, 10),
      districts: [],
      territories: [],
      properties: [],
      landmarks: [],
      provenance: [],
    };

    const result = runCityValidation(pkg, raw);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('GEOMETRY_INVALID: flags a self-intersecting territory polygon', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100, geometry: bowtie() },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'GEOMETRY_INVALID');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('DUPLICATE_SLUG: flags a duplicate district slug', () => {
    const pkg = emptyPackage();
    pkg.districts = [
      { slug: 'downtown', name: 'Downtown' },
      { slug: 'downtown', name: 'Duplicate Downtown' },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'DUPLICATE_SLUG');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'district', assetSlug: 'downtown' });
    expect(result.ok).toBe(false);
  });

  it('DUPLICATE_ID: flags a duplicate provenance record id', () => {
    const pkg = emptyPackage();
    pkg.provenance = [provenanceRecord('src-1'), provenanceRecord('src-1')];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'DUPLICATE_ID');
    expect(issue).toMatchObject({ severity: 'ERROR' });
    expect(result.ok).toBe(false);
  });

  it('TERRITORY_OUT_OF_BOUNDS: flags a territory outside the raw city boundary', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100, geometry: square(20, 20, 22, 22) },
    ];
    const raw: GridRawGeography = {
      citySlug: 'test-city',
      cityBoundary: square(0, 0, 10, 10),
      districts: [],
      territories: [],
      properties: [],
      landmarks: [],
      provenance: [],
    };

    const result = runCityValidation(pkg, raw);
    const issue = findIssue(result.issues, 'TERRITORY_OUT_OF_BOUNDS');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('TERRITORY_ISLAND: flags a territory with zero adjacency edges', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 },
      { slug: 't2', name: 'T2', districtSlug: 'd1', baseValue: 100 },
    ];
    pkg.edges = [];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'TERRITORY_ISLAND');
    expect(issue).toMatchObject({ severity: 'WARNING', assetType: 'territory' });
  });

  it('SELF_ADJACENCY: flags an edge connecting a territory to itself', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [{ slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 }];
    pkg.edges = [{ a: 't1', b: 't1' }];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'SELF_ADJACENCY');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'edge', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('CROSS_CITY_ADJACENCY: flags an edge referencing a territory outside this package', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [{ slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 }];
    pkg.edges = [{ a: 't1', b: 'other-city-territory' }];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'CROSS_CITY_ADJACENCY');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'edge' });
    expect(result.ok).toBe(false);
  });

  it('MISSING_DISTRICT_REF: flags a territory referencing an unknown district', () => {
    const pkg = emptyPackage();
    pkg.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'missing-district', baseValue: 100 },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'MISSING_DISTRICT_REF');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('OVERLAP_TOLERANCE_EXCEEDED: flags two territories overlapping beyond tolerance', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100, geometry: square(0, 0, 2, 2) },
      { slug: 't2', name: 'T2', districtSlug: 'd1', baseValue: 100, geometry: square(1, 1, 3, 3) },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'OVERLAP_TOLERANCE_EXCEEDED');
    expect(issue).toMatchObject({ severity: 'WARNING', assetType: 'territory' });
  });

  it('PROPERTY_MISSING_TERRITORY: flags a property referencing an unknown territory', () => {
    const pkg = emptyPackage();
    pkg.properties = [
      { slug: 'p1', name: 'P1', territorySlug: 'missing', baseValue: 10, publicNameSafe: false },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'PROPERTY_MISSING_TERRITORY');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'property', assetSlug: 'p1' });
    expect(result.ok).toBe(false);
  });

  it('LANDMARK_MISSING_TERRITORY: flags a landmark referencing an unknown territory', () => {
    const pkg = emptyPackage();
    pkg.landmarks = [
      { slug: 'l1', name: 'L1', territorySlug: 'missing', point: { lat: 0, lng: 0 } },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'LANDMARK_MISSING_TERRITORY');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'landmark', assetSlug: 'l1' });
    expect(result.ok).toBe(false);
  });

  it('MISSING_PROVENANCE: WARNING for a draft package, ERROR for a ready package', () => {
    const prov = provenanceRecord('src-1');
    const draft = emptyPackage();
    draft.provenance = [prov];
    draft.districts = [{ slug: 'd1', name: 'District 1', sourceRefs: [prov.id] }];
    draft.territories = [
      {
        slug: 't1',
        name: 'T1',
        districtSlug: 'd1',
        baseValue: 100,
        sourceRefs: ['unresolved-id'],
      },
    ];

    const draftResult = runCityValidation(draft);
    expect(findIssue(draftResult.issues, 'MISSING_PROVENANCE')).toMatchObject({
      severity: 'WARNING',
      assetType: 'territory',
      assetSlug: 't1',
    });

    const ready = { ...draft, status: 'ready' as const };
    const readyResult = runCityValidation(ready);
    expect(findIssue(readyResult.issues, 'MISSING_PROVENANCE')).toMatchObject({
      severity: 'ERROR',
      assetType: 'territory',
      assetSlug: 't1',
    });
    expect(readyResult.ok).toBe(false);
  });

  it('PRIVACY_UNCLASSIFIED: WARNING for a draft package, ERROR for a ready package', () => {
    const prov = provenanceRecord('src-1');
    const draft = emptyPackage();
    draft.provenance = [prov];
    draft.districts = [{ slug: 'd1', name: 'District 1', sourceRefs: [prov.id] }];
    draft.territories = [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100, sourceRefs: [prov.id] },
    ];
    draft.properties = [
      {
        slug: 'p1',
        name: 'P1',
        territorySlug: 't1',
        baseValue: 10,
        publicNameSafe: false,
        sourceRefs: [prov.id],
        privacyClass: 'UNKNOWN_REVIEW_REQUIRED',
      },
    ];

    const draftResult = runCityValidation(draft);
    expect(findIssue(draftResult.issues, 'PRIVACY_UNCLASSIFIED')).toMatchObject({
      severity: 'WARNING',
      assetType: 'property',
      assetSlug: 'p1',
    });

    const ready = { ...draft, status: 'ready' as const };
    const readyResult = runCityValidation(ready);
    expect(findIssue(readyResult.issues, 'PRIVACY_UNCLASSIFIED')).toMatchObject({
      severity: 'ERROR',
      assetType: 'property',
      assetSlug: 'p1',
    });
    expect(readyResult.ok).toBe(false);
  });

  it('RESIDENTIAL_EXPOSURE: flags a residential property marked publicNameSafe', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [{ slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 }];
    pkg.properties = [
      {
        slug: 'p1',
        name: 'P1',
        territorySlug: 't1',
        baseValue: 10,
        publicNameSafe: true,
        privacyClass: 'RESIDENTIAL_BACKGROUND',
      },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'RESIDENTIAL_EXPOSURE');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'property', assetSlug: 'p1' });
    expect(result.ok).toBe(false);
  });

  it('FAKE_PLACEHOLDER_GEOGRAPHY: flags an unsourced territory only once the package is ready', () => {
    const pkg = emptyPackage();
    pkg.status = 'ready';
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [{ slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 }];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'FAKE_PLACEHOLDER_GEOGRAPHY');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('EMPTY_READY_PACKAGE: flags a ready package with zero territories', () => {
    const pkg = emptyPackage();
    pkg.status = 'ready';

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'EMPTY_READY_PACKAGE');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'city', assetSlug: 'test-city' });
    expect(result.ok).toBe(false);
  });

  it('HISTORICAL_CHRONOLOGY_INVALID: flags a territory retired before it was built', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      {
        slug: 't1',
        name: 'T1',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { builtYear: 2000, retiredYear: 1990 },
      },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'HISTORICAL_CHRONOLOGY_INVALID');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });

  it('HISTORICAL_REFERENCE_LOOP: true positive -- a 2-cycle of successorSlug references', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      {
        slug: 't1',
        name: 'T1',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { successorSlug: 't2' },
      },
      {
        slug: 't2',
        name: 'T2',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { successorSlug: 't1' },
      },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'HISTORICAL_REFERENCE_LOOP');
    expect(issue).toMatchObject({ severity: 'ERROR' });
    expect(result.ok).toBe(false);
  });

  it('HISTORICAL_REFERENCE_LOOP: true negative -- a valid linear predecessor/successor chain', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      {
        slug: 't1',
        name: 'T1',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { successorSlug: 't2' },
      },
      {
        slug: 't2',
        name: 'T2',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { predecessorSlug: 't1' },
      },
    ];

    const result = runCityValidation(pkg);
    expect(findIssue(result.issues, 'HISTORICAL_REFERENCE_LOOP')).toBeUndefined();
  });

  it('HISTORICAL_REFERENCE_DANGLING: flags a predecessorSlug that does not exist in the package', () => {
    const pkg = emptyPackage();
    pkg.districts = [{ slug: 'd1', name: 'District 1' }];
    pkg.territories = [
      {
        slug: 't1',
        name: 'T1',
        districtSlug: 'd1',
        baseValue: 100,
        historical: { predecessorSlug: 'ghost-territory' },
      },
    ];

    const result = runCityValidation(pkg);
    const issue = findIssue(result.issues, 'HISTORICAL_REFERENCE_DANGLING');
    expect(issue).toMatchObject({ severity: 'ERROR', assetType: 'territory', assetSlug: 't1' });
    expect(result.ok).toBe(false);
  });
});
