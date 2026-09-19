import { describe, expect, it } from 'vitest';
import {
  isGridAllianceEnabled,
  isGridContestWriteEnabled,
  isGridEconomyWriteEnabled,
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

  it('keeps economy mutations off unless explicitly activated', () => {
    expect(
      isGridEconomyWriteEnabled({
        GRID_ECONOMY_WRITE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridEconomyWriteEnabled({
        GRID_ECONOMY_WRITE_ENABLED: 'true',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(isGridEconomyWriteEnabled({} as NodeJS.ProcessEnv)).toBe(false);
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
  it('keeps Alliance activation additive to economy and contest flags', () => {
    const env = {
      GRID_FOUNDATION_ENABLED: '1',
      GRID_ALLIANCE_ENABLED: '1',
      GRID_ECONOMY_WRITE_ENABLED: '1',
      GRID_CONTEST_WRITE_ENABLED: '1',
    } as unknown as NodeJS.ProcessEnv;

    expect(isGridAllianceEnabled(env)).toBe(true);
    expect(isGridEconomyWriteEnabled(env)).toBe(true);
    expect(isGridContestWriteEnabled(env)).toBe(true);
  });

});
