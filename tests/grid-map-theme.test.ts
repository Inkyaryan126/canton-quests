import { describe, expect, it } from 'vitest';
import {
  GRID_MAP_DARK_THEME,
  gridMapContrastRatio,
  gridMapPropertyStyle,
  gridMapTerritoryStyle,
  gridMapVirtualBuildingStyle,
} from '../lib/grid/map/theme';
import type {
  GridMapPropertyFeatureProperties,
  GridMapTerritoryFeatureProperties,
  GridMapVirtualBuilding,
} from '../lib/grid/map/render-packet';

function territory(
  overrides: Partial<GridMapTerritoryFeatureProperties> = {},
): GridMapTerritoryFeatureProperties {
  return {
    slug: 'territory-1',
    fillRole: 'neutral',
    borderRole: 'quiet',
    glow: 'none',
    pulse: false,
    focused: false,
    name: 'Territory 1',
    districtSlug: 'downtown',
    claimable: false,
    starterEligible: false,
    contested: false,
    propertyCount: 0,
    developedPropertyCount: 0,
    totalDevelopmentLevel: 0,
    ...overrides,
  };
}
function property(
  overrides: Partial<GridMapPropertyFeatureProperties> = {},
): GridMapPropertyFeatureProperties {
  return {
    slug: 'property-1',
    conditionBand: 'healthy',
    glow: 'none',
    focused: false,
    virtualBuildingVisible: true,
    heightUnits: 2,
    name: 'Property 1',
    territorySlug: 'territory-1',
    ownership: 'neutral',
    developmentBranch: null,
    developmentLevel: 2,
    ...overrides,
  };
}

describe('Grid dark tactical map theme', () => {
  it('keeps primary text highly legible against the map background', () => {
    expect(
      gridMapContrastRatio(
        GRID_MAP_DARK_THEME.text.primary,
        GRID_MAP_DARK_THEME.background,
      ),
    ).toBeGreaterThanOrEqual(7);
  });

  it('maps territory semantic roles into distinct visual treatments', () => {
    const neutral = gridMapTerritoryStyle(territory());
    const yours = gridMapTerritoryStyle(territory({
      fillRole: 'controlled-you',
      borderRole: 'owned',
    }));
    const rival = gridMapTerritoryStyle(territory({
      fillRole: 'controlled-rival',
      borderRole: 'hostile',
    }));

    expect(neutral.fill).not.toBe(yours.fill);
    expect(yours.fill).not.toBe(rival.fill);
    expect(yours.stroke).not.toBe(rival.stroke);
  });
  it('makes contested and focused territory states visually dominant', () => {
    const contested = gridMapTerritoryStyle(territory({
      fillRole: 'contested',
      borderRole: 'contested',
      glow: 'strong',
      pulse: true,
      contested: true,
      focused: true,
    }));
    const quiet = gridMapTerritoryStyle(territory());

    expect(contested.strokeWidth).toBeGreaterThan(quiet.strokeWidth);
    expect(contested.glow).not.toBe('none');
    expect(contested.dashPattern).toBeDefined();
  });

  it('uses property condition to lower visual integrity without hiding the asset', () => {
    const healthy = gridMapPropertyStyle(property({ conditionBand: 'healthy' }));
    const damaged = gridMapPropertyStyle(property({ conditionBand: 'damaged' }));
    const critical = gridMapPropertyStyle(property({ conditionBand: 'critical' }));

    expect(healthy.fillOpacity).toBeGreaterThan(damaged.fillOpacity);
    expect(damaged.fillOpacity).toBeGreaterThan(critical.fillOpacity);
    expect(critical.fillOpacity).toBeGreaterThan(0);
  });

  it('maps development branches to distinct virtual-building accents', () => {
    const base: GridMapVirtualBuilding = {
      propertySlug: 'property-1',
      territorySlug: 'territory-1',
      anchor: { lat: 40.79, lng: -81.37 },
      heightUnits: 3,
      developmentBranch: 'commerce',
      conditionBand: 'healthy',
      ownership: 'you',
      focused: false,
    };
    const commerce = gridMapVirtualBuildingStyle(base);
    const fortress = gridMapVirtualBuildingStyle({
      ...base,
      developmentBranch: 'fortress',
    });

    expect(commerce.accent).not.toBe(fortress.accent);
    expect(commerce.heightPx).toBeGreaterThan(0);
  });
  it('uses only explicit hexadecimal palette tokens', () => {
    const tokens = [
      GRID_MAP_DARK_THEME.background,
      GRID_MAP_DARK_THEME.text.primary,
      GRID_MAP_DARK_THEME.text.muted,
      ...Object.values(GRID_MAP_DARK_THEME.fill),
      ...Object.values(GRID_MAP_DARK_THEME.stroke),
      ...Object.values(GRID_MAP_DARK_THEME.branch),
    ];

    expect(tokens.every((token) => /^#[0-9a-f]{6}$/i.test(token))).toBe(true);
  });
});
