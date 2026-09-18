import type { GridPlatformAdapter, GridPlatformCapability } from './types';

export type GridPlatformValidationCode =
  | 'DUPLICATE_CAPABILITY'
  | 'MISSING_DEPENDENCY'
  | 'MISSING_PORT'
  | 'UNDECLARED_PORT';

export interface GridPlatformValidationIssue {
  code: GridPlatformValidationCode;
  capability?: GridPlatformCapability;
  message: string;
}

type AdapterPortName =
  | 'location'
  | 'camera'
  | 'notifications'
  | 'haptics'
  | 'secureStorage'
  | 'share'
  | 'deepLinks'
  | 'lifecycle'
  | 'network';

const CAPABILITY_PORT: Record<GridPlatformCapability, AdapterPortName> = {
  'foreground-location': 'location',
  'background-location': 'location',
  camera: 'camera',
  'push-notifications': 'notifications',
  haptics: 'haptics',
  'secure-storage': 'secureStorage',
  share: 'share',
  'deep-links': 'deepLinks',
  'app-lifecycle': 'lifecycle',
  'network-status': 'network',
};
const PORT_CAPABILITIES: Record<AdapterPortName, GridPlatformCapability[]> = {
  location: ['foreground-location', 'background-location'],
  camera: ['camera'],
  notifications: ['push-notifications'],
  haptics: ['haptics'],
  secureStorage: ['secure-storage'],
  share: ['share'],
  deepLinks: ['deep-links'],
  lifecycle: ['app-lifecycle'],
  network: ['network-status'],
};

export function hasGridPlatformCapability(
  adapter: GridPlatformAdapter,
  capability: GridPlatformCapability,
): boolean {
  return adapter.capabilities.includes(capability);
}

export function missingGridPlatformCapabilities(
  adapter: GridPlatformAdapter,
  required: readonly GridPlatformCapability[],
): GridPlatformCapability[] {
  const available = new Set(adapter.capabilities);
  return [...new Set(required)].filter((capability) => !available.has(capability));
}
export function validateGridPlatformAdapter(
  adapter: GridPlatformAdapter,
): GridPlatformValidationIssue[] {
  const issues: GridPlatformValidationIssue[] = [];
  const seen = new Set<GridPlatformCapability>();

  for (const capability of adapter.capabilities) {
    if (seen.has(capability)) {
      issues.push({
        code: 'DUPLICATE_CAPABILITY',
        capability,
        message: `Duplicate platform capability: ${capability}`,
      });
    }
    seen.add(capability);

    const portName = CAPABILITY_PORT[capability];
    if (!adapter[portName]) {
      issues.push({
        code: 'MISSING_PORT',
        capability,
        message: `Capability ${capability} requires adapter port ${portName}`,
      });
    }
  }
  if (seen.has('background-location') && !seen.has('foreground-location')) {
    issues.push({
      code: 'MISSING_DEPENDENCY',
      capability: 'background-location',
      message: 'Background location requires foreground location capability',
    });
  }

  for (const [portName, capabilities] of Object.entries(PORT_CAPABILITIES) as Array<[AdapterPortName, GridPlatformCapability[]]>) {
    if (!adapter[portName]) continue;
    if (!capabilities.some((capability) => seen.has(capability))) {
      issues.push({
        code: 'UNDECLARED_PORT',
        message: `Adapter port ${portName} exists without declaring a matching capability`,
      });
    }
  }

  return issues.sort((left, right) => {
    const codeDelta = left.code.localeCompare(right.code);
    if (codeDelta !== 0) return codeDelta;
    return (left.capability ?? '').localeCompare(right.capability ?? '');
  });
}

export function assertValidGridPlatformAdapter(adapter: GridPlatformAdapter): void {
  const issues = validateGridPlatformAdapter(adapter);
  if (issues.length === 0) return;
  throw new Error(`Invalid Grid platform adapter: ${issues.map((issue) => issue.message).join('; ')}`);
}
