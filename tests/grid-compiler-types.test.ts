import { describe, expect, it } from 'vitest';
import type {
  GridCityPackage,
  GridConfidenceLevel,
  GridHistoricalMetadata,
  GridPrivacyClass,
  GridDistrictDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
  GridPropertyDefinition,
  GridLandmarkDefinition,
} from '../lib/grid/core/types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';
import type {
  GridProvenanceRecord,
  GridValidationSeverity,
  GridValidationIssue,
  GridValidationReport,
  GridRawDistrict,
  GridRawTerritory,
  GridRawProperty,
  GridRawLandmark,
  GridRawGeography,
  GridCompilerOptions,
  GridCompiledPackageResult,
} from '../lib/grid/compiler/types';

describe('GRID compiler contracts and core types', () => {
  it('validates a minimal legacy-shaped GridCityPackage without any new optional fields', () => {
    const legacyPackage: GridCityPackage = {
      schemaVersion: 1,
      packageVersion: 1,
      status: 'draft',
      city: {
        slug: 'core-city',
        name: 'Core City',
        regionCode: 'TEST',
        countryCode: 'US',
        timezone: 'UTC',
        mapCenter: { lat: 40.0, lng: -80.0 },
      },
      seasonTemplate: {
        slug: 'test-season',
        name: 'Test Season',
        durationDays: 14,
        surgeHours: 24,
        balance: {
          startingCredits: 1000,
          startingInfluence: 50,
          maxCommandPoints: 5,
          commandPointRegenMinutes: 30,
        },
      },
      districts: [],
      territories: [],
      edges: [],
      properties: [],
      landmarks: [],
    };

    const validation = validateGridCityPackage(legacyPackage);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(legacyPackage.compilerVersion).toBeUndefined();
    expect(legacyPackage.sourceSnapshotVersion).toBeUndefined();
    expect(legacyPackage.provenance).toBeUndefined();
  });

  it('validates a fully populated GridCityPackage using all new optional fields', () => {
    const provenanceRecord: GridProvenanceRecord = {
      id: 'prov-source-1',
      sourceName: 'Municipal Open Data Portal',
      sourceUrl: 'https://data.example.org/gis',
      license: 'ODbL-1.0',
      retrievedAt: '2026-09-12T00:00:00.000Z',
      transformation: 'Reprojected to WGS84, filtered parcels, and normalized polygon rings',
      attribution: 'Contains municipal GIS information licensed under Open Data Commons Open Database License.',
      confidence: 'confirmed',
    };

    const district: GridDistrictDefinition = {
      slug: 'civic-center',
      name: 'Civic Center',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-80.0, 40.0],
              [-80.0, 40.01],
              [-79.99, 40.01],
              [-79.99, 40.0],
              [-80.0, 40.0],
            ],
          ],
        ],
      },
      config: { zoneCode: 'CC-1' },
      sourceRefs: [provenanceRecord.id],
    };

    const territoryHistory: GridHistoricalMetadata = {
      era: 'Founding Era',
      activationYear: 1905,
      builtYear: 1898,
      openedYear: 1900,
      retiredYear: 1965,
      demolishedYear: 1972,
      predecessorSlug: 'historic-marsh',
      successorSlug: 'modern-commons',
      sourceRefs: [provenanceRecord.id],
      confidence: 'confirmed',
    };

    const territory1: GridTerritoryDefinition = {
      slug: 'territory-north',
      name: 'North Commons',
      districtSlug: district.slug,
      baseValue: 120,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      config: { priority: 'high' },
      historical: territoryHistory,
      sourceRefs: [provenanceRecord.id],
    };

    const territory2: GridTerritoryDefinition = {
      slug: 'territory-south',
      name: 'South Commons',
      districtSlug: district.slug,
      baseValue: 150,
      sourceRefs: [provenanceRecord.id],
    };

    const edge: GridTerritoryEdgeDefinition = {
      a: territory1.slug,
      b: territory2.slug,
      edgeType: 'border',
      historical: {
        openedYear: 1905,
        retiredYear: 1980,
        confidence: 'approximate',
        sourceRefs: [provenanceRecord.id],
      },
    };

    const property: GridPropertyDefinition = {
      slug: 'town-hall-plaza',
      name: 'Town Hall Plaza',
      territorySlug: territory1.slug,
      baseValue: 80,
      publicNameSafe: true,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      point: { lat: 40.005, lng: -79.995 },
      config: { hasPublicRestrooms: true },
      privacyClass: 'PUBLIC_CIVIC',
      historical: {
        builtYear: 1912,
        openedYear: 1914,
        confidence: 'confirmed',
        sourceRefs: [provenanceRecord.id],
      },
      sourceRefs: [provenanceRecord.id],
    };

    const landmark: GridLandmarkDefinition = {
      slug: 'founders-monument',
      name: 'Founders Monument',
      territorySlug: territory1.slug,
      point: { lat: 40.006, lng: -79.996 },
      config: { lightingSchedule: 'dusk-to-dawn' },
      privacyClass: 'CULTURAL',
      historical: {
        builtYear: 1925,
        confidence: 'confirmed',
        sourceRefs: [provenanceRecord.id],
      },
      sourceRefs: [provenanceRecord.id],
    };

    const fullPackage: GridCityPackage = {
      schemaVersion: 1,
      packageVersion: 2,
      status: 'ready',
      city: {
        slug: 'full-city',
        name: 'Full City',
        regionCode: 'TEST',
        countryCode: 'US',
        timezone: 'America/New_York',
        mapCenter: { lat: 40.005, lng: -79.995 },
      },
      seasonTemplate: {
        slug: 'championship-season',
        name: 'Championship Season',
        durationDays: 30,
        surgeHours: 72,
        balance: {
          startingCredits: 5000,
          startingInfluence: 100,
          maxCommandPoints: 10,
          commandPointRegenMinutes: 60,
        },
      },
      districts: [district],
      territories: [territory1, territory2],
      edges: [edge],
      properties: [property],
      landmarks: [landmark],
      compilerVersion: '1.0.0',
      sourceSnapshotVersion: 'test-city-downtown-v1',
      generatedAt: '2026-09-12T12:00:00.000Z',
      approvedAt: '2026-09-12T15:00:00.000Z',
      approvedBy: 'lead-geographer-1',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      provenance: [provenanceRecord],
    };

    const validation = validateGridCityPackage(fullPackage);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(fullPackage.compilerVersion).toBe('1.0.0');
    expect(fullPackage.sourceSnapshotVersion).toBe('test-city-downtown-v1');
    expect(fullPackage.provenance).toHaveLength(1);
    expect(fullPackage.districts[0].sourceRefs).toContain('prov-source-1');
    expect(fullPackage.territories[0].historical?.activationYear).toBe(1905);
    expect(fullPackage.edges[0].historical?.edgeType).toBeUndefined();
    expect(fullPackage.edges[0].historical?.openedYear).toBe(1905);
    expect(fullPackage.properties[0].privacyClass).toBe('PUBLIC_CIVIC');
    expect(fullPackage.landmarks[0].privacyClass).toBe('CULTURAL');
  });

  it('verifies all GridConfidenceLevel and GridPrivacyClass variants are constructible', () => {
    const confidenceLevels: GridConfidenceLevel[] = ['confirmed', 'approximate', 'unknown'];
    expect(confidenceLevels).toHaveLength(3);

    const privacyClasses: GridPrivacyClass[] = [
      'PUBLIC_CIVIC',
      'COMMERCIAL',
      'CULTURAL',
      'PARK',
      'INFRASTRUCTURE',
      'RESIDENTIAL_BACKGROUND',
      'PRIVATE_EXCLUDED',
      'UNKNOWN_REVIEW_REQUIRED',
    ];
    expect(privacyClasses).toHaveLength(8);
  });

  it('correctly constructs raw geography compiler input contracts and validation types', () => {
    const provenance: GridProvenanceRecord = {
      id: 'prov-raw-1',
      sourceName: 'OpenStreetMap Snapshot',
      sourceUrl: 'https://planet.openstreetmap.org',
      license: 'ODbL-1.0',
      retrievedAt: '2026-09-12T00:00:00.000Z',
      transformation: 'Extracted building polygons and tagged civic attributes',
      attribution: '© OpenStreetMap contributors',
      confidence: 'confirmed',
    };

    const rawDistrict: GridRawDistrict = {
      slug: 'arts-quarter',
      name: 'Arts Quarter',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      sourceRefs: [provenance.id],
    };

    const rawTerritory: GridRawTerritory = {
      slug: 'gallery-way',
      name: 'Gallery Way',
      districtSlug: rawDistrict.slug,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      baseValue: 200,
      historical: {
        era: 'Revitalization',
        confidence: 'confirmed',
        sourceRefs: [provenance.id],
      },
      sourceRefs: [provenance.id],
    };

    const rawProperty: GridRawProperty = {
      slug: 'community-gallery',
      name: 'Community Gallery',
      territorySlug: rawTerritory.slug,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      point: { lat: 40.1, lng: -80.1 },
      privacyClass: 'CULTURAL',
      publicNameSafe: true,
      historical: {
        builtYear: 1950,
        confidence: 'approximate',
        sourceRefs: [provenance.id],
      },
      sourceRefs: [provenance.id],
    };

    const rawLandmark: GridRawLandmark = {
      slug: 'sculpture-garden',
      name: 'Sculpture Garden',
      territorySlug: rawTerritory.slug,
      point: { lat: 40.101, lng: -80.101 },
      privacyClass: 'PARK',
      historical: {
        builtYear: 1985,
        confidence: 'confirmed',
        sourceRefs: [provenance.id],
      },
      sourceRefs: [provenance.id],
    };

    const rawGeography: GridRawGeography = {
      citySlug: 'raw-sample-city',
      cityBoundary: {
        type: 'MultiPolygon',
        coordinates: [],
      },
      districts: [rawDistrict],
      territories: [rawTerritory],
      edges: [{ a: 'gallery-way', b: 'gallery-way-2', edgeType: 'corridor' }],
      properties: [rawProperty],
      landmarks: [rawLandmark],
      provenance: [provenance],
    };

    expect(rawGeography.citySlug).toBe('raw-sample-city');
    expect(rawGeography.districts).toHaveLength(1);
    expect(rawGeography.territories).toHaveLength(1);
    expect(rawGeography.properties).toHaveLength(1);
    expect(rawGeography.landmarks).toHaveLength(1);
    expect(rawGeography.provenance).toHaveLength(1);

    const compilerOptions: GridCompilerOptions = {
      compilerVersion: '0.1.0',
      sourceSnapshotVersion: 'test-snapshot-20260912',
      adjacencyToleranceMeters: 5,
      overlapToleranceMeters: 1,
      generatedAt: '2026-09-12T12:00:00.000Z',
    };

    expect(compilerOptions.compilerVersion).toBe('0.1.0');

    const issueInfo: GridValidationIssue = {
      severity: 'INFO',
      code: 'GEOMETRY_SIMPLIFIED',
      message: 'MultiPolygon simplified within tolerance threshold',
      assetType: 'territory',
      assetSlug: 'gallery-way',
    };

    const issueWarning: GridValidationIssue = {
      severity: 'WARNING',
      code: 'HISTORICAL_DATE_APPROXIMATE',
      message: 'Built year is marked approximate',
      assetType: 'property',
      assetSlug: 'community-gallery',
    };

    const issueError: GridValidationIssue = {
      severity: 'ERROR',
      code: 'GEOMETRY_INVALID',
      message: 'Self-intersecting polygon detected',
      assetType: 'district',
      assetSlug: 'arts-quarter',
    };

    const severities: GridValidationSeverity[] = ['ERROR', 'WARNING', 'INFO'];
    expect(severities).toContain(issueInfo.severity);
    expect(severities).toContain(issueWarning.severity);
    expect(severities).toContain(issueError.severity);

    const validReport: GridValidationReport = {
      ok: true,
      issues: [issueInfo, issueWarning],
    };
    expect(validReport.ok).toBe(true);

    const invalidReport: GridValidationReport = {
      ok: false,
      issues: [issueInfo, issueWarning, issueError],
    };
    expect(invalidReport.ok).toBe(false);

    const result: GridCompiledPackageResult = {
      package: {
        schemaVersion: 1,
        packageVersion: 1,
        status: 'draft',
        city: {
          slug: rawGeography.citySlug,
          name: 'Raw Sample City',
          regionCode: 'TEST',
          countryCode: 'US',
          timezone: 'UTC',
          mapCenter: { lat: 40.1, lng: -80.1 },
        },
        seasonTemplate: {
          slug: 'sample-season',
          name: 'Sample Season',
          durationDays: 7,
          surgeHours: 12,
          balance: {
            startingCredits: 1000,
            startingInfluence: 50,
            maxCommandPoints: 5,
            commandPointRegenMinutes: 30,
          },
        },
        districts: [],
        territories: [],
        edges: [],
        properties: [],
        landmarks: [],
      },
      validation: validReport,
    };

    expect(result.package.status).toBe('draft');
    expect(result.validation.ok).toBe(true);
  });
});
