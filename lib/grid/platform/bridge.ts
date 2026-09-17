export const GRID_PLATFORM_BRIDGE_VERSION = 1 as const;

export type GridPlatformBridgeVersion = typeof GRID_PLATFORM_BRIDGE_VERSION;
export type GridPlatformBridgeRelation = 'current' | 'too-old' | 'too-new' | 'invalid';

export interface GridPlatformBridgeCompatibility {
  compatible: boolean;
  currentVersion: GridPlatformBridgeVersion;
  peerVersion: number;
  relation: GridPlatformBridgeRelation;
}

export function assessGridPlatformBridgeCompatibility(
  peerVersion: number,
): GridPlatformBridgeCompatibility {
  if (!Number.isInteger(peerVersion) || peerVersion < 0) {
    return { compatible: false, currentVersion: GRID_PLATFORM_BRIDGE_VERSION, peerVersion, relation: 'invalid' };
  }
  if (peerVersion < GRID_PLATFORM_BRIDGE_VERSION) {
    return { compatible: false, currentVersion: GRID_PLATFORM_BRIDGE_VERSION, peerVersion, relation: 'too-old' };
  }
  if (peerVersion > GRID_PLATFORM_BRIDGE_VERSION) {
    return { compatible: false, currentVersion: GRID_PLATFORM_BRIDGE_VERSION, peerVersion, relation: 'too-new' };
  }
  return { compatible: true, currentVersion: GRID_PLATFORM_BRIDGE_VERSION, peerVersion, relation: 'current' };
}
