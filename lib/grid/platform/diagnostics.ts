import { assessGridPlatformBridgeCompatibility } from './bridge';
import { listGridPlatformFeatureSupport } from './features';
import type { GridPlatformFeatureSupport } from './features';
import type { GridPlatformBridgeCompatibility } from './bridge';
import type { GridPlatformRuntime } from './runtime';
import type {
  GridAppLifecycleState,
  GridPlatformCapability,
  GridPlatformKind,
} from './types';

export interface GridPlatformDiagnostics {
  bridgeVersion: number;
  bridgeCompatibility: GridPlatformBridgeCompatibility;
  platform: GridPlatformKind;
  capabilities: GridPlatformCapability[];
  features: GridPlatformFeatureSupport[];
  lifecycleState: GridAppLifecycleState | null;
}

export async function buildGridPlatformDiagnostics(
  runtime: GridPlatformRuntime,
): Promise<GridPlatformDiagnostics> {
  const lifecycleState = runtime.supports('app-lifecycle')
    ? await runtime.requireLifecycle().getState()
    : null;
  return {
    bridgeVersion: runtime.adapter.bridgeVersion,
    bridgeCompatibility: assessGridPlatformBridgeCompatibility(
      runtime.adapter.bridgeVersion,
    ),
    platform: runtime.adapter.kind,
    capabilities: [...runtime.adapter.capabilities].sort(),
    features: listGridPlatformFeatureSupport(runtime.adapter),
    lifecycleState,
  };
}
