import { describe, expect, it } from 'vitest';
import { isGridFoundationEnabled } from '../lib/grid/server/feature-flags';

describe('Grid foundation feature flag', () => {
  it('defaults off', () => {
    expect(isGridFoundationEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('only enables for the explicit value 1', () => {
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
