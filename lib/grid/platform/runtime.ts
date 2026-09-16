import { assertValidGridPlatformAdapter, hasGridPlatformCapability } from './capabilities';
import { gridPlatformFeatureSupport } from './features';
import type { GridPlatformFeature, GridPlatformFeatureSupport } from './features';
import type {
  GridCameraPort,
  GridDeepLinksPort,
  GridHapticsPort,
  GridLocationPort,
  GridNotificationsPort,
  GridPlatformAdapter,
  GridPlatformCapability,
  GridSecureStoragePort,
  GridSharePort,
} from './types';

export interface GridPlatformRuntime {
  readonly adapter: Readonly<GridPlatformAdapter>;
  supports(capability: GridPlatformCapability): boolean;
  feature(feature: GridPlatformFeature): GridPlatformFeatureSupport;
  requireLocation(): GridLocationPort;
  requireCamera(): GridCameraPort;
  requireNotifications(): GridNotificationsPort;
  requireHaptics(): GridHapticsPort;
  requireSecureStorage(): GridSecureStoragePort;
  requireShare(): GridSharePort;
  requireDeepLinks(): GridDeepLinksPort;
}

function requirePort<T>(
  value: T | undefined,
  capability: GridPlatformCapability,
): T {
  if (!value) throw new Error(`Grid platform capability unavailable: ${capability}`);
  return value;
}
export function createGridPlatformRuntime(
  adapter: GridPlatformAdapter,
): GridPlatformRuntime {
  assertValidGridPlatformAdapter(adapter);
  const frozenAdapter = Object.freeze({
    ...adapter,
    capabilities: Object.freeze([...adapter.capabilities]),
  });

  return {
    adapter: frozenAdapter,
    supports: (capability) => hasGridPlatformCapability(frozenAdapter, capability),
    feature: (feature) => gridPlatformFeatureSupport(frozenAdapter, feature),
    requireLocation: () => requirePort(frozenAdapter.location, 'foreground-location'),
    requireCamera: () => requirePort(frozenAdapter.camera, 'camera'),
    requireNotifications: () => requirePort(
      frozenAdapter.notifications,
      'push-notifications',
    ),
    requireHaptics: () => requirePort(frozenAdapter.haptics, 'haptics'),
    requireSecureStorage: () => requirePort(
      frozenAdapter.secureStorage,
      'secure-storage',
    ),
    requireShare: () => requirePort(frozenAdapter.share, 'share'),
    requireDeepLinks: () => requirePort(frozenAdapter.deepLinks, 'deep-links'),
  };
}
