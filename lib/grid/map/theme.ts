import type {
  GridMapPropertyFeatureProperties,
  GridMapTerritoryFeatureProperties,
  GridMapVirtualBuilding,
} from './render-packet';

export interface GridMapSurfaceStyle {
  fill: string;
  stroke: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  glow: string;
  dashPattern?: string;
}

export interface GridMapVirtualBuildingStyle {
  accent: string;
  body: string;
  opacity: number;
  heightPx: number;
  glow: string;
}

export const GRID_MAP_DARK_THEME = {
  background: '#05070d',
  text: {
    primary: '#eaf6ff',
    muted: '#8ea6bb',
  },
  fill: {
    neutral: '#152033',
    you: '#0d7892',
    rival: '#7d203d',
    contested: '#755519',
    property: '#192538',
  },
  stroke: {
    quiet: '#405168',
    claimable: '#18e3ae',
    owned: '#24e0ff',
    hostile: '#ff4d70',
    contested: '#ffd34d',
    focus: '#ffffff',
  },
  branch: {
    commerce: '#ffc247',
    influence: '#9d73ff',
    fortress: '#ff5c5c',
    intel: '#47d9ff',
    prestige: '#ff7ad8',
    undeveloped: '#71839a',
  },
} as const;

function hexChannel(value: string, offset: number): number {
  return Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error('Grid map theme colors must be six-digit hexadecimal values');
  }
  const r = linearize(hexChannel(hex, 1));
  const g = linearize(hexChannel(hex, 3));
  const b = linearize(hexChannel(hex, 5));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function gridMapContrastRatio(a: string, b: string): number {
  const aLum = luminance(a);
  const bLum = luminance(b);
  const lighter = Math.max(aLum, bLum);
  const darker = Math.min(aLum, bLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function territoryFill(
  properties: GridMapTerritoryFeatureProperties,
): string {
  if (properties.fillRole === 'controlled-you') {
    return GRID_MAP_DARK_THEME.fill.you;
  }
  if (properties.fillRole === 'controlled-rival') {
    return GRID_MAP_DARK_THEME.fill.rival;
  }
  if (properties.fillRole === 'contested') {
    return GRID_MAP_DARK_THEME.fill.contested;
  }
  return GRID_MAP_DARK_THEME.fill.neutral;
}
function territoryStroke(
  properties: GridMapTerritoryFeatureProperties,
): string {
  if (properties.focused) return GRID_MAP_DARK_THEME.stroke.focus;
  if (properties.borderRole === 'claimable') {
    return GRID_MAP_DARK_THEME.stroke.claimable;
  }
  if (properties.borderRole === 'owned') {
    return GRID_MAP_DARK_THEME.stroke.owned;
  }
  if (properties.borderRole === 'hostile') {
    return GRID_MAP_DARK_THEME.stroke.hostile;
  }
  if (properties.borderRole === 'contested') {
    return GRID_MAP_DARK_THEME.stroke.contested;
  }
  return GRID_MAP_DARK_THEME.stroke.quiet;
}

function glowFor(
  strength: 'none' | 'soft' | 'strong',
  color: string,
): string {
  if (strength === 'none') return 'none';
  const radius = strength === 'strong' ? 18 : 10;
  return `0 0 ${radius}px ${color}`;
}

export function gridMapTerritoryStyle(
  properties: GridMapTerritoryFeatureProperties,
): GridMapSurfaceStyle {
  const stroke = territoryStroke(properties);
  return {
    fill: territoryFill(properties),
    stroke,
    fillOpacity: properties.contested ? 0.5 : 0.36,
    strokeOpacity: 0.95,
    strokeWidth: properties.focused ? 4 : properties.contested ? 3 : 2,
    glow: glowFor(properties.glow, stroke),
    dashPattern: properties.contested ? '8 5' : undefined,
  };
}

const CONDITION_OPACITY = {
  healthy: 0.78,
  worn: 0.64,
  damaged: 0.5,
  critical: 0.36,
} as const;

export function gridMapPropertyStyle(
  properties: GridMapPropertyFeatureProperties,
): GridMapSurfaceStyle {
  const stroke =
    properties.focused
      ? GRID_MAP_DARK_THEME.stroke.focus
      : properties.ownership === 'you'
        ? GRID_MAP_DARK_THEME.stroke.owned
        : properties.ownership === 'occupied'
          ? GRID_MAP_DARK_THEME.stroke.hostile
          : GRID_MAP_DARK_THEME.stroke.quiet;

  return {
    fill: GRID_MAP_DARK_THEME.fill.property,
    stroke,
    fillOpacity: CONDITION_OPACITY[properties.conditionBand],
    strokeOpacity: 0.92,
    strokeWidth: properties.focused ? 3 : 1.5,
    glow: glowFor(properties.glow, stroke),
  };
}
function branchAccent(
  branch: GridMapVirtualBuilding['developmentBranch'],
): string {
  switch (branch) {
    case 'commerce':
      return GRID_MAP_DARK_THEME.branch.commerce;
    case 'influence':
      return GRID_MAP_DARK_THEME.branch.influence;
    case 'fortress':
      return GRID_MAP_DARK_THEME.branch.fortress;
    case 'intel':
      return GRID_MAP_DARK_THEME.branch.intel;
    case 'prestige':
      return GRID_MAP_DARK_THEME.branch.prestige;
    default:
      return GRID_MAP_DARK_THEME.branch.undeveloped;
  }
}

export function gridMapVirtualBuildingStyle(
  building: GridMapVirtualBuilding,
): GridMapVirtualBuildingStyle {
  const accent = branchAccent(building.developmentBranch);
  const body =
    building.ownership === 'you'
      ? GRID_MAP_DARK_THEME.fill.you
      : building.ownership === 'occupied'
        ? GRID_MAP_DARK_THEME.fill.rival
        : GRID_MAP_DARK_THEME.fill.property;
  const opacity = CONDITION_OPACITY[building.conditionBand];

  return {
    accent,
    body,
    opacity,
    heightPx: Math.min(96, Math.max(12, building.heightUnits * 14)),
    glow: building.focused || building.ownership === 'you'
      ? glowFor(building.focused ? 'strong' : 'soft', accent)
      : 'none',
  };
}
