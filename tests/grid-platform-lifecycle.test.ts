import { describe, expect, it, vi } from 'vitest';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import type {
  GridAppLifecyclePort,
  GridAppLifecycleState,
} from '../lib/grid/platform/types';

describe('GRID app lifecycle platform contract', () => {
  it('advertises lifecycle only when the native shell supplies it', () => {
    const lifecycle: GridAppLifecyclePort = {
      getState: async () => 'active',
      subscribe: () => () => undefined,
    };
    const adapter = createGridNativePlatformAdapter({
      kind: 'ios',
      lifecycle,
    });

    expect(adapter.capabilities).toContain('app-lifecycle');
    expect(adapter.lifecycle).toBe(lifecycle);
  });

  it('exposes lifecycle state and subscriptions through the shared runtime', async () => {
    let emit: (state: GridAppLifecycleState) => void = () => undefined;
    const unsubscribe = vi.fn();
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'android',
      lifecycle: {
        getState: async () => 'background',
        subscribe: (next) => {
          emit = next;
          return unsubscribe;
        },
      },
    }));

    expect(await runtime.requireLifecycle().getState()).toBe('background');
    const seen: string[] = [];
    const stop = runtime.requireLifecycle().subscribe((state) => seen.push(state));
    emit('active');
    expect(seen).toEqual(['active']);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('emits resume events only when the app returns to active', async () => {
    let emit: (state: GridAppLifecycleState) => void = () => undefined;
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      lifecycle: {
        getState: async () => 'active',
        subscribe: (next) => {
          emit = next;
          return () => undefined;
        },
      },
    }));
    const resumes: Array<{ previousState: string; state: string }> = [];

    const stop = await runtime.subscribeResumes((event) => resumes.push(event));
    emit('active');
    emit('inactive');
    emit('background');
    emit('active');
    emit('active');

    expect(resumes).toEqual([{ previousState: 'background', state: 'active' }]);
    stop();
  });
});
