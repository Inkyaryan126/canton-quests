import { missingGridPlatformCapabilities } from './capabilities';
import type { GridPlatformAdapter, GridPlatformCapability } from './types';

export type GridPlatformFeature =
  | 'player-location'
  | 'background-presence'
  | 'photo-proof'
  | 'live-alerts'
  | 'tactile-feedback'
  | 'secure-session'
  | 'native-share'
  | 'deep-link-entry';

const FEATURE_REQUIREMENTS: Record<GridPlatformFeature, readonly GridPlatformCapability[]> = {
  'player-location': ['foreground-location'],
  'background-presence': ['foreground-location', 'background-location'],
  'photo-proof': ['camera'],
  'live-alerts': ['push-notifications'],
  'tactile-feedback': ['haptics'],
  'secure-session': ['secure-storage'],
  'native-share': ['share'],
  'deep-link-entry': ['deep-links'],
};

export interface GridPlatformFeatureSupport {
  feature: GridPlatformFeature;
  available: boolean;
  missingCapabilities: GridPlatformCapability[];
}
export function gridPlatformFeatureRequirements(
  feature: GridPlatformFeature,
): readonly GridPlatformCapability[] {
  return FEATURE_REQUIREMENTS[feature];
}

export function gridPlatformFeatureSupport(
  adapter: GridPlatformAdapter,
  feature: GridPlatformFeature,
): GridPlatformFeatureSupport {
  const missingCapabilities = missingGridPlatformCapabilities(
    adapter,
    FEATURE_REQUIREMENTS[feature],
  );
  return {
    feature,
    available: missingCapabilities.length === 0,
    missingCapabilities,
  };
}

export function listGridPlatformFeatureSupport(
  adapter: GridPlatformAdapter,
): GridPlatformFeatureSupport[] {
  return (Object.keys(FEATURE_REQUIREMENTS) as GridPlatformFeature[])
    .sort()
    .map((feature) => gridPlatformFeatureSupport(adapter, feature));
}
