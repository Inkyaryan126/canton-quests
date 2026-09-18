import { describe, expect, it } from 'vitest';
import {
  buildGridMapNavigationIntent,
  type GridMapNavigationIntent,
} from '../lib/grid/map/navigation';
import type { GridMapInteractionTarget } from '../lib/grid/map/render-packet';

function navigate(target: GridMapInteractionTarget): GridMapNavigationIntent {
  return buildGridMapNavigationIntent(target);
}

describe('Grid map navigation intents', () => {
  it('drills a district target from city view into district zoom', () => {
    expect(navigate({
      kind: 'district',
      slug: 'downtown',
      districtSlug: 'downtown',
      territorySlug: null,
      propertySlug: null,
    })).toEqual({
      zoom: 11,
      focusDistrictSlug: 'downtown',
      focusTerritorySlug: null,
      focusPropertySlug: null,
    });
  });

  it('drills a territory target into property-ready zoom context', () => {
    expect(navigate({
      kind: 'territory',
      slug: 'territory-1',
      districtSlug: 'downtown',
      territorySlug: 'territory-1',
      propertySlug: null,
    })).toEqual({
      zoom: 15,
      focusDistrictSlug: 'downtown',
      focusTerritorySlug: 'territory-1',
      focusPropertySlug: null,
    });
  });

  it('focuses a property target at property zoom', () => {
    expect(navigate({
      kind: 'property',
      slug: 'property-1',
      districtSlug: 'downtown',
      territorySlug: 'territory-1',
      propertySlug: 'property-1',
    })).toEqual({
      zoom: 15,
      focusDistrictSlug: 'downtown',
      focusTerritorySlug: 'territory-1',
      focusPropertySlug: 'property-1',
    });
  });

  it('rejects internally inconsistent interaction targets', () => {
    expect(() => navigate({
      kind: 'territory',
      slug: 'territory-1',
      districtSlug: null,
      territorySlug: 'territory-2',
      propertySlug: null,
    })).toThrow(/interaction target/i);

    expect(() => navigate({
      kind: 'property',
      slug: 'property-1',
      districtSlug: 'downtown',
      territorySlug: null,
      propertySlug: 'property-1',
    })).toThrow(/interaction target/i);
  });
});
