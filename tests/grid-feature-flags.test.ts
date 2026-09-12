import { describe, expect, it } from 'vitest';
import { isGridFoundationEnabled } from '../lib/grid/server/feature-flags';

describe('Grid foundation feature flag', () => {
  it('defaults off', () => {
    expect(isGridFoundationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('only enables for the explicit value 1', () => {
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridFoundationEnabled({ GRID_FOUNDATION_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('does not treat missing or accidental truthy strings as launch approval', () => {
    for (const value of [undefined, '', 'yes', 'TRUE', 'enabled']) {
      expect(
        isGridFoundationEnabled(
          { GRID_FOUNDATION_ENABLED: value } as NodeJS.ProcessEnv
        )
      ).toBe(false);
    }
  });
});
