import type { GridPlatformRuntime } from './runtime';

export type GridRecoveryReason = 'app-resume' | 'network-reconnect';

export interface GridRecoverySignal {
  reason: GridRecoveryReason;
  observedAtMs: number;
}

export interface GridRecoveryOptions {
  dedupeWindowMs?: number;
  now?: () => number;
}

export async function subscribeGridRecoverySignals(
  runtime: GridPlatformRuntime,
  listener: (signal: GridRecoverySignal) => void,
  options: GridRecoveryOptions = {},
): Promise<() => void> {
  const dedupeWindowMs = options.dedupeWindowMs ?? 1_000;
  const now = options.now ?? Date.now;
  let lastEmittedAt = Number.NEGATIVE_INFINITY;
  const unsubscribers: Array<() => void> = [];

  const emit = (reason: GridRecoveryReason): void => {
    const observedAtMs = now();
    if (observedAtMs - lastEmittedAt < dedupeWindowMs) return;
    lastEmittedAt = observedAtMs;
    listener({ reason, observedAtMs });
  };
  if (runtime.supports('app-lifecycle')) {
    unsubscribers.push(await runtime.subscribeResumes(() => emit('app-resume')));
  }

  if (runtime.supports('network-status')) {
    unsubscribers.push(await runtime.subscribeReconnects(() => emit('network-reconnect')));
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}