import type { GridPlatformFeature } from './features';
import type { GridPlatformRuntime } from './runtime';
import type { GridPermissionState, GridPlatformCapability } from './types';

export type GridPermissionFlowFeature =
  | 'player-location'
  | 'background-presence'
  | 'photo-proof'
  | 'live-alerts';

export interface GridPermissionFlowStep {
  capability: GridPlatformCapability;
  state: GridPermissionState;
}

export interface GridPermissionFlowResult {
  feature: GridPermissionFlowFeature;
  supported: boolean;
  state: GridPermissionState;
  missingCapabilities: GridPlatformCapability[];
  steps: GridPermissionFlowStep[];
}

function unsupportedResult(
  runtime: GridPlatformRuntime,
  feature: GridPermissionFlowFeature,
): GridPermissionFlowResult {
  const support = runtime.feature(feature as GridPlatformFeature);
  return {
    feature,
    supported: false,
    state: 'unavailable',
    missingCapabilities: support.missingCapabilities,
    steps: [],
  };
}
function resultFromSteps(
  feature: GridPermissionFlowFeature,
  steps: GridPermissionFlowStep[],
): GridPermissionFlowResult {
  const state = steps.at(-1)?.state ?? 'unavailable';
  return {
    feature,
    supported: true,
    state,
    missingCapabilities: [],
    steps,
  };
}

export async function requestGridPlatformFeaturePermission(
  runtime: GridPlatformRuntime,
  feature: GridPermissionFlowFeature,
): Promise<GridPermissionFlowResult> {
  const support = runtime.feature(feature);
  if (!support.available) return unsupportedResult(runtime, feature);

  if (feature === 'player-location') {
    const state = await runtime.requireLocation().requestPermission('foreground');
    return resultFromSteps(feature, [
      { capability: 'foreground-location', state },
    ]);
  }

  if (feature === 'photo-proof') {
    const state = await runtime.requireCamera().requestPermission();
    return resultFromSteps(feature, [{ capability: 'camera', state }]);
  }

  if (feature === 'live-alerts') {
    const state = await runtime.requireNotifications().requestPermission();
    return resultFromSteps(feature, [
      { capability: 'push-notifications', state },
    ]);
  }
  const location = runtime.requireLocation();
  const foreground = await location.requestPermission('foreground');
  const steps: GridPermissionFlowStep[] = [
    { capability: 'foreground-location', state: foreground },
  ];
  if (foreground !== 'granted') {
    return resultFromSteps(feature, steps);
  }

  const background = await location.requestPermission('background');
  steps.push({ capability: 'background-location', state: background });
  return resultFromSteps(feature, steps);
}
