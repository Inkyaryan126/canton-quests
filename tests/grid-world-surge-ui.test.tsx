import { describe, expect, it } from 'vitest';
import { surgeStatusPresentation } from '../app/grid/grid-world-client';

describe('Grid City Board Surge status', () => {
  it('turns authoritative live Surge timing into player-facing copy', () => {
    expect(surgeStatusPresentation({
      state: 'live',
      millisecondsRemaining: 172_800_000,
    })).toEqual({
      label: 'SURGE LIVE',
      detail: '2D 0H REMAINING',
    });
  });
});
