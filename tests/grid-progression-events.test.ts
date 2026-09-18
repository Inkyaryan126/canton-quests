import { describe, expect, it } from 'vitest';
import {
  GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
  reduceGridProgressionEvents,
  type GridProgressionEvent,
  type GridProgressionEventPolicy,
} from '../lib/grid/core/progression-events';

const playerId = '00000000-0000-4000-8000-000000000001';

function event(
  id: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  createdAt = '2026-09-16T08:00:00.000Z',
  actorPlayerId: string | null = playerId,
): GridProgressionEvent {
  return {
    id,
    seasonId: '00000000-0000-4000-8000-000000000010',
    actorPlayerId,
    eventType,
    payload,
    createdAt,
  };
}

describe('Grid progression event reducer', () => {
  it('derives factual cumulative capture stats from canonical Grid events without inventing XP', () => {
    const result = reduceGridProgressionEvents(
      [
        event('a', 'grid:territory_claimed'),
        event('b', 'grid:contest_session_round_resolved', { territoryCaptured: false }),
        event('c', 'grid:contest_session_round_resolved', { territoryCaptured: true }),
      ],
      playerId,
      GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
    );

    expect(result.stats.territoriesCaptured).toBe(2);
    expect(result.stats.xp).toBe(0);
    expect(result.appliedEventIds).toEqual(['a', 'c']);
    expect(result.ignoredEventIds).toEqual(['b']);
  });

  it('supports configured static and numeric-payload deltas without hardcoded award values', () => {
    const policy: GridProgressionEventPolicy = {
      version: 1,
      rules: [
        {
          id: 'mission-complete',
          eventType: 'mission:completed',
          delta: { missionsCompleted: 1 },
          payloadDeltas: [
            { stat: 'missionScore', payloadPath: ['score'] },
            { stat: 'xp', payloadPath: ['rewards', 'xp'], multiplier: 2 },
          ],
        },
      ],
    };

    const result = reduceGridProgressionEvents(
      [event('mission-1', 'mission:completed', { score: 125, rewards: { xp: 40 } })],
      playerId,
      policy,
    );

    expect(result.stats.missionsCompleted).toBe(1);
    expect(result.stats.missionScore).toBe(125);
    expect(result.stats.xp).toBe(80);
  });

  it('supports exact payload conditions and ignores rules that do not match', () => {
    const policy: GridProgressionEventPolicy = {
      version: 1,
      rules: [
        {
          id: 'capture-only',
          eventType: 'round',
          when: [{ payloadPath: ['outcome'], equals: 'captured' }],
          delta: { territoriesCaptured: 1 },
        },
      ],
    };

    const result = reduceGridProgressionEvents(
      [
        event('held', 'round', { outcome: 'held' }),
        event('captured', 'round', { outcome: 'captured' }),
      ],
      playerId,
      policy,
    );

    expect(result.stats.territoriesCaptured).toBe(1);
    expect(result.appliedEventIds).toEqual(['captured']);
    expect(result.ignoredEventIds).toEqual(['held']);
  });

  it('is deterministic regardless of input order by sorting on createdAt then immutable event id', () => {
    const events = [
      event('b', 'grid:territory_claimed', {}, '2026-09-16T08:00:01.000Z'),
      event('c', 'grid:territory_claimed', {}, '2026-09-16T08:00:01.000Z'),
      event('a', 'grid:territory_claimed', {}, '2026-09-16T08:00:00.000Z'),
    ];

    const forward = reduceGridProgressionEvents(
      events,
      playerId,
      GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
    );
    const reversed = reduceGridProgressionEvents(
      [...events].reverse(),
      playerId,
      GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
    );

    expect(reversed).toEqual(forward);
    expect(forward.sourceEventIds).toEqual(['a', 'b', 'c']);
  });

  it('ignores events attributed to another player or with no actor', () => {
    const result = reduceGridProgressionEvents(
      [
        event('mine', 'grid:territory_claimed'),
        event('other', 'grid:territory_claimed', {}, undefined, 'other-player'),
        event('system', 'grid:territory_claimed', {}, undefined, null),
      ],
      playerId,
      GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
    );

    expect(result.stats.territoriesCaptured).toBe(1);
    expect(result.sourceEventIds).toEqual(['mine']);
  });

  it('rejects duplicate immutable event ids instead of double-counting them', () => {
    expect(() =>
      reduceGridProgressionEvents(
        [event('same', 'grid:territory_claimed'), event('same', 'grid:territory_claimed')],
        playerId,
        GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
      ),
    ).toThrow('duplicate Grid progression event id: same');
  });

  it('ignores missing, non-numeric, negative, and non-finite payload deltas', () => {
    const policy: GridProgressionEventPolicy = {
      version: 1,
      rules: [
        {
          id: 'payload',
          eventType: 'payload',
          payloadDeltas: [
            { stat: 'xp', payloadPath: ['good'] },
            { stat: 'missionScore', payloadPath: ['bad'] },
            { stat: 'exploration', payloadPath: ['negative'] },
          ],
        },
      ],
    };

    const result = reduceGridProgressionEvents(
      [event('payload-1', 'payload', { good: 25, bad: 'nope', negative: -10 })],
      playerId,
      policy,
    );

    expect(result.stats.xp).toBe(25);
    expect(result.stats.missionScore).toBe(0);
    expect(result.stats.exploration).toBe(0);
  });
});
