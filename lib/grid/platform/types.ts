export type GridPlatformKind = 'web' | 'ios' | 'android' | 'test';

export type GridPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

export type GridPlatformCapability =
  | 'foreground-location'
  | 'background-location'
  | 'camera'
  | 'push-notifications'
  | 'haptics'
  | 'secure-storage'
  | 'share'
  | 'deep-links'
  | 'app-lifecycle'
  | 'network-status';

export interface GridPlatformLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  altitudeMeters?: number | null;
  headingDegrees?: number | null;
  speedMetersPerSecond?: number | null;
}

export interface GridLocationRequest {
  accuracy: 'balanced' | 'high';
  timeoutMs?: number;
  maximumAgeMs?: number;
}

export interface GridLocationPort {
  getPermission(): Promise<GridPermissionState>;
  requestPermission(mode: 'foreground' | 'background'): Promise<GridPermissionState>;
  getCurrentPosition(request: GridLocationRequest): Promise<GridPlatformLocation>;
}

export interface GridCapturedPhoto {
  id: string;
  mimeType: string;
  byteLength: number;
  capturedAt: string;
  /** Adapter-owned URI/reference. Core game logic must treat this as opaque. */
  localReference: string;
}

export interface GridCameraPort {
  getPermission(): Promise<GridPermissionState>;
  requestPermission(): Promise<GridPermissionState>;
  capturePhoto(): Promise<GridCapturedPhoto>;
}

export interface GridPushRegistration {
  provider: 'web-push' | 'apns' | 'fcm' | 'test';
  token: string;
}

export interface GridNotificationsPort {
  getPermission(): Promise<GridPermissionState>;
  requestPermission(): Promise<GridPermissionState>;
  getPushRegistration(): Promise<GridPushRegistration | null>;
}

export type GridHapticPattern = 'selection' | 'success' | 'warning' | 'error' | 'impact-light' | 'impact-medium' | 'impact-heavy';

export interface GridHapticsPort {
  trigger(pattern: GridHapticPattern): Promise<void>;
}

export interface GridSecureStoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface GridSharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface GridSharePort {
  share(payload: GridSharePayload): Promise<'shared' | 'cancelled' | 'unavailable'>;
}

export interface GridDeepLinksPort {
  getInitialUrl(): Promise<string | null>;
}

export type GridAppLifecycleState = 'active' | 'inactive' | 'background';

export interface GridAppLifecyclePort {
  getState(): Promise<GridAppLifecycleState>;
  subscribe(listener: (state: GridAppLifecycleState) => void): () => void;
}

export type GridNetworkInterface =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'unknown';

export interface GridNetworkStatus {
  connected: boolean;
  interface: GridNetworkInterface;
}

export interface GridNetworkPort {
  getStatus(): Promise<GridNetworkStatus>;
  subscribe(listener: (status: GridNetworkStatus) => void): () => void;
}

export interface GridPlatformAdapter {
  bridgeVersion: number;
  kind: GridPlatformKind;
  capabilities: readonly GridPlatformCapability[];
  location?: GridLocationPort;
  camera?: GridCameraPort;
  notifications?: GridNotificationsPort;
  haptics?: GridHapticsPort;
  secureStorage?: GridSecureStoragePort;
  share?: GridSharePort;
  deepLinks?: GridDeepLinksPort;
  lifecycle?: GridAppLifecyclePort;
  network?: GridNetworkPort;
}
