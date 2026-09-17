import { assertValidGridPlatformAdapter, hasGridPlatformCapability } from './capabilities';
import { gridPlatformFeatureSupport } from './features';
import type { GridPlatformFeature, GridPlatformFeatureSupport } from './features';
import type {
  GridAppLifecyclePort,
  GridAppLifecycleState,
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

export interface GridAppResumeEvent {
  previousState: GridAppLifecycleState;
  state: 'active';
}

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
  requireLifecycle(): GridAppLifecyclePort;
  subscribeResumes(listener: (event: GridAppResumeEvent) => void): Promise<() => void>;
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
    requireLifecycle: () => requirePort(frozenAdapter.lifecycle, 'app-lifecycle'),
    subscribeResumes: async (listener) => {
      const lifecycle = requirePort(frozenAdapter.lifecycle, 'app-lifecycle');
      let previousState = await lifecycle.getState();
      return lifecycle.subscribe((state) => {
        const prior = previousState;
        previousState = state;
        if (state === 'active' && prior !== 'active') {
          listener({ previousState: prior, state: 'active' });
        }
      });
    },
  };
}
