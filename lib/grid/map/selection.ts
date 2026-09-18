import type {
  GridMapInteractionTarget,
  GridMapRenderPacket,
} from './render-packet';

export interface GridMapDistrictSelection {
  kind: 'district';
  slug: string;
  controlRole: string;
  focused: boolean;
  territoryCount: number;
  neutralTerritories: number;
  yourTerritories: number;
  occupiedTerritories: number;
  contestedTerritories: number;
}

export interface GridMapTerritorySelection {
  kind: 'territory';
  slug: string;
  name: string;
  districtSlug: string;
  fillRole: string;
  borderRole: string;
  focused: boolean;
  claimable: boolean;
  starterEligible: boolean;
  contested: boolean;
  propertyCount: number;
  developedPropertyCount: number;
  totalDevelopmentLevel: number;
}

export interface GridMapPropertySelection {
  kind: 'property';
  slug: string;
  name: string;
  territorySlug: string;
  ownership: 'neutral' | 'you' | 'occupied';
  developmentBranch: string | null;
  developmentLevel: number;
  conditionBand: string;
  heightUnits: number;
  focused: boolean;
}

export type GridMapSelectionDetails =
  | GridMapDistrictSelection
  | GridMapTerritorySelection
  | GridMapPropertySelection;

export function toggleGridMapSelection(
  current: GridMapInteractionTarget | null,
  next: GridMapInteractionTarget,
): GridMapInteractionTarget | null {
  if (current !== null && current.kind === next.kind && current.slug === next.slug) {
    return null;
  }
  return next;
}

export function resolveGridMapSelection(
  packet: GridMapRenderPacket,
  target: GridMapInteractionTarget,
): GridMapSelectionDetails | null {
  if (target.kind === 'district') {
    const feature = packet.districts.features.find(
      (row) => row.properties.slug === target.slug,
    );
    if (!feature) return null;
    const p = feature.properties;
    return {
      kind: 'district',
      slug: p.slug,
      controlRole: p.controlRole,
      focused: p.focused,
      territoryCount: p.territoryCount,
      neutralTerritories: p.neutralTerritories,
      yourTerritories: p.yourTerritories,
      occupiedTerritories: p.occupiedTerritories,
      contestedTerritories: p.contestedTerritories,
    };
  }

  if (target.kind === 'territory') {
    const feature = packet.territories.features.find(
      (row) => row.properties.slug === target.slug,
    );
    if (!feature) return null;
    const p = feature.properties;
    return {
      kind: 'territory',
      slug: p.slug,
      name: p.name,
      districtSlug: p.districtSlug,
      fillRole: p.fillRole,
      borderRole: p.borderRole,
      focused: p.focused,
      claimable: p.claimable,
      starterEligible: p.starterEligible,
      contested: p.contested,
      propertyCount: p.propertyCount,
      developedPropertyCount: p.developedPropertyCount,
      totalDevelopmentLevel: p.totalDevelopmentLevel,
    };
  }

  const feature = packet.properties.features.find(
    (row) => row.properties.slug === target.slug,
  );
  if (!feature) return null;
  const p = feature.properties;
  return {
    kind: 'property',
    slug: p.slug,
    name: p.name,
    territorySlug: p.territorySlug,
    ownership: p.ownership,
    developmentBranch: p.developmentBranch,
    developmentLevel: p.developmentLevel,
    conditionBand: p.conditionBand,
    heightUnits: p.heightUnits,
    focused: p.focused,
  };
}
