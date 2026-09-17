import { listGridPlatformFeatureSupport } from './features';
import type { GridPlatformFeatureSupport } from './features';
import {
  resolveInitialGridLaunchIntent,
} from './launch-intents';
import type {
  GridLaunchIntentConfig,
  GridLaunchIntentResult,
} from './launch-intents';
import type { GridPlatformRuntime } from './runtime';
import type {
  GridAppLifecycleState,
  GridPlatformCapability,
  GridPlatformKind,
} from './types';

export interface GridPlatformBootstrapSnapshot {
  bridgeVersion: number;
  platform: GridPlatformKind;
  capabilities: GridPlatformCapability[];
  features: GridPlatformFeatureSupport[];
  lifecycleState: GridAppLifecycleState | null;
  initialLaunchIntent: GridLaunchIntentResult | null;
}

export async function buildGridPlatformBootstrap(
  runtime: GridPlatformRuntime,
  launchConfig: GridLaunchIntentConfig,
): Promise<GridPlatformBootstrapSnapshot> {
  const lifecycleState = runtime.supports('app-lifecycle')
    ? await runtime.requireLifecycle().getState()
    : null;

  return {
    bridgeVersion: runtime.adapter.bridgeVersion,
    platform: runtime.adapter.kind,
    capabilities: [...runtime.adapter.capabilities].sort(),
    features: listGridPlatformFeatureSupport(runtime.adapter),
    lifecycleState,
    initialLaunchIntent: await resolveInitialGridLaunchIntent(runtime, launchConfig),
  };
}
