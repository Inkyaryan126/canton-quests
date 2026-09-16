import { describe, expect, it } from 'vitest';
import {
  isGridContestWriteEnabled,
  isGridFoundationEnabled,
  isGridWorldReadEnabled,
} from '../lib/grid/server/feature-flags';

describe('Grid feature flags', () => {
  it('defaults the foundation off', () => {
    expect(isGridFoundationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('only enables the foundation for the explicit value 1', () => {
    expect(
      isGridFoundationEnabled({
        GRID_FOUNDATION_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridFoundationEnabled({
        GRID_FOUNDATION_ENABLED: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isGridFoundationEnabled({
        GRID_FOUNDATION_ENABLED: '0',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('does not treat accidental truthy strings as foundation launch approval', () => {
    for (const value of [undefined, '', 'yes', 'TRUE', 'enabled']) {
      expect(
        isGridFoundationEnabled({
          GRID_FOUNDATION_ENABLED: value,
        } as NodeJS.ProcessEnv),
      ).toBe(false);
    }
  });

  it('keeps world runtime reads independently gated', () => {
    expect(
      isGridWorldReadEnabled({
        GRID_WORLD_READ_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridWorldReadEnabled({
        GRID_WORLD_READ_ENABLED: '0',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('keeps contest mutations off unless explicitly activated', () => {
    expect(
      isGridContestWriteEnabled({
        GRID_CONTEST_WRITE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridContestWriteEnabled({
        GRID_CONTEST_WRITE_ENABLED: 'true',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(isGridContestWriteEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
