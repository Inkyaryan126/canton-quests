import type {
  GridAppLifecyclePort,
  GridCameraPort,
  GridHapticPattern,
  GridLocationPort,
  GridNotificationsPort,
  GridPermissionState,
  GridPlatformAdapter,
  GridSharePort,
} from './types';

interface GridWebCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

interface GridWebPosition {
  coords: GridWebCoordinates;
  timestamp: number;
}

interface GridWebGeolocation {
  getCurrentPosition(
    success: (position: GridWebPosition) => void,
    error?: (error: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
}
interface GridWebPermissionStatus {
  state: 'granted' | 'denied' | 'prompt';
}

interface GridWebPermissions {
  query(descriptor: { name: 'geolocation' }): Promise<GridWebPermissionStatus>;
}

export interface GridWebPlatformEnvironment {
  geolocation?: GridWebGeolocation;
  permissions?: GridWebPermissions;
  vibrate?: (pattern: number | number[]) => boolean;
  share?: (payload: { title?: string; text?: string; url?: string }) => Promise<void>;
  currentUrl?: () => string;
  camera?: GridCameraPort;
  notifications?: GridNotificationsPort;
  lifecycle?: GridAppLifecyclePort;
}

function permissionState(
  state: GridWebPermissionStatus['state'] | undefined,
): GridPermissionState {
  return state ?? 'prompt';
}

async function queryLocationPermission(
  environment: GridWebPlatformEnvironment,
): Promise<GridPermissionState> {
  if (!environment.geolocation) return 'unavailable';
  if (!environment.permissions) return 'prompt';
  return permissionState((await environment.permissions.query({ name: 'geolocation' })).state);
}
function webLocationPort(environment: GridWebPlatformEnvironment): GridLocationPort | undefined {
  if (!environment.geolocation) return undefined;
  return {
    getPermission: () => queryLocationPermission(environment),
    requestPermission: async (mode) => {
      if (mode === 'background') return 'unavailable';
      const current = await queryLocationPermission(environment);
      if (current === 'granted' || current === 'denied') return current;
      try {
        await new Promise<void>((resolve, reject) => {
          environment.geolocation!.getCurrentPosition(
            () => resolve(),
            reject,
            { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 },
          );
        });
        return 'granted';
      } catch {
        return queryLocationPermission(environment);
      }
    },
    getCurrentPosition: (request) =>
      new Promise((resolve, reject) => {
        environment.geolocation!.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
            altitudeMeters: position.coords.altitude ?? null,
            headingDegrees: position.coords.heading ?? null,
            speedMetersPerSecond: position.coords.speed ?? null,
          }),
          reject,
          {
            enableHighAccuracy: request.accuracy === 'high',
            timeout: request.timeoutMs,
            maximumAge: request.maximumAgeMs,
          },
        );
      }),
  };
}

const HAPTIC_PATTERNS: Record<GridHapticPattern, number | number[]> = {
  selection: 10,
  success: [15, 40, 15],
  warning: [30, 40, 30],
  error: [40, 30, 40, 30, 40],
  'impact-light': 10,
  'impact-medium': 20,
  'impact-heavy': 35,
};
function webSharePort(environment: GridWebPlatformEnvironment): GridSharePort | undefined {
  if (!environment.share) return undefined;
  return {
    share: async (payload) => {
      try {
        await environment.share!(payload);
        return 'shared';
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error as { name?: unknown }).name === 'AbortError'
        ) {
          return 'cancelled';
        }
        throw error;
      }
    },
  };
}

export function createGridWebPlatformAdapter(
  environment: GridWebPlatformEnvironment,
): GridPlatformAdapter {
  const location = webLocationPort(environment);
  const share = webSharePort(environment);
  const capabilities: GridPlatformAdapter['capabilities'][number][] = [];
  if (location) capabilities.push('foreground-location');
  if (environment.camera) capabilities.push('camera');
  if (environment.notifications) capabilities.push('push-notifications');
  if (environment.vibrate) capabilities.push('haptics');
  if (share) capabilities.push('share');
  if (environment.currentUrl) capabilities.push('deep-links');
  if (environment.lifecycle) capabilities.push('app-lifecycle');

  return {
    kind: 'web',
    capabilities,
    location,
    camera: environment.camera,
    notifications: environment.notifications,
    haptics: environment.vibrate
      ? { trigger: async (pattern) => { environment.vibrate!(HAPTIC_PATTERNS[pattern]); } }
      : undefined,
    share,
    deepLinks: environment.currentUrl
      ? { getInitialUrl: async () => environment.currentUrl!() }
      : undefined,
    lifecycle: environment.lifecycle,
  };
}
