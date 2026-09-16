import type {
  GridCameraPort,
  GridDeepLinksPort,
  GridHapticsPort,
  GridLocationPort,
  GridNotificationsPort,
  GridPlatformAdapter,
  GridSecureStoragePort,
  GridSharePort,
} from './types';

export interface GridNativePlatformEnvironment {
  kind: 'ios' | 'android';
  location?: GridLocationPort;
  backgroundLocation?: boolean;
  camera?: GridCameraPort;
  notifications?: GridNotificationsPort;
  haptics?: GridHapticsPort;
  secureStorage?: GridSecureStoragePort;
  share?: GridSharePort;
  deepLinks?: GridDeepLinksPort;
}

export function createGridNativePlatformAdapter(
  environment: GridNativePlatformEnvironment,
): GridPlatformAdapter {
  if (environment.backgroundLocation && !environment.location) {
    throw new Error('Native background location requires a location port');
  }

  const capabilities: GridPlatformAdapter['capabilities'][number][] = [];
  if (environment.location) capabilities.push('foreground-location');
  if (environment.backgroundLocation) capabilities.push('background-location');
  if (environment.camera) capabilities.push('camera');
  if (environment.notifications) capabilities.push('push-notifications');
  if (environment.haptics) capabilities.push('haptics');
  if (environment.secureStorage) capabilities.push('secure-storage');
  if (environment.share) capabilities.push('share');
  if (environment.deepLinks) capabilities.push('deep-links');

  return {
    kind: environment.kind,
    capabilities,
    location: environment.location,
    camera: environment.camera,
    notifications: environment.notifications,
    haptics: environment.haptics,
    secureStorage: environment.secureStorage,
    share: environment.share,
    deepLinks: environment.deepLinks,
  };
}
