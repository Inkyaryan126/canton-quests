import { describe, expect, it, vi } from 'vitest';
import type { GridReturnSummaryPort } from '../lib/grid/server/return-summary-port';
import { buildGridReturnSummary } from '../lib/grid/server/return-summary-service';

const context = {
  cityId: 'city-secret-id',
  seasonId: 'season-secret-id',
  lastActiveAt: '2026-09-16T07:00:00.000Z',
};

describe('Grid return summary', () => {
  it('summarizes city changes and player-specific outcomes without exposing identities', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(context),
      listActivity: vi.fn().mockResolvedValue({
        truncated: false,
        events: [
          {
            eventType: 'grid:contest_session_round_resolved',
            entityType: 'contest',
            createdAt: '2026-09-16T08:10:00.000Z',
            viewerRole: 'defender',
            contestOutcome: 'defended',
          },
          {
            eventType: 'grid:contest_started',
            entityType: 'contest',
            createdAt: '2026-09-16T08:00:00.000Z',
            viewerRole: 'defender',
            contestOutcome: null,
          },
          {
            eventType: 'grid:property_developed',
            entityType: 'property',
            createdAt: '2026-09-16T07:55:00.000Z',
            viewerRole: 'actor',
            contestOutcome: null,
          },
          {
            eventType: 'grid:territory_claimed',
            entityType: 'territory',
            createdAt: '2026-09-16T07:40:00.000Z',
            viewerRole: 'none',
            contestOutcome: null,
          },
          {
            eventType: 'grid:contest_auto_retreat_capture',
            entityType: 'territory',
            createdAt: '2026-09-16T07:20:00.000Z',
            viewerRole: 'attacker',
            contestOutcome: null,
          },
        ],
      }),
    };

    const summary = await buildGridReturnSummary(
      port,
      'viewer-secret-id',
      '2026-09-16T08:15:00.000Z',
    );

    expect(summary).not.toBeNull();
    expect(summary?.cityActivity).toEqual({
      territoryClaims: 1,
      propertyAcquisitions: 0,
      propertyDevelopments: 1,
      contestsStarted: 1,
      contestRounds: 1,
      territoryCaptures: 1,
    });
    expect(summary?.yourActivity).toEqual({
      territoryClaims: 0,
      propertyAcquisitions: 0,
      propertyDevelopments: 1,
      attacksStarted: 0,
      defensesFaced: 1,
      contestsWon: 2,
      contestsLost: 0,
    });
    expect(summary?.highlights[0]?.message).toBe(
      'You successfully defended a territory.',
    );
    expect(summary?.highlights.some((item) =>
      item.message.includes('auto-retreated'),
    )).toBe(true);

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('viewer-secret-id');
    expect(serialized).not.toContain('city-secret-id');
    expect(serialized).not.toContain('season-secret-id');
  });

  it('returns null for a player who has not joined the Grid season', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(null),
      listActivity: vi.fn(),
    };

    await expect(
      buildGridReturnSummary(
        port,
        'viewer',
        '2026-09-16T08:15:00.000Z',
      ),
    ).resolves.toBeNull();
    expect(port.listActivity).not.toHaveBeenCalled();
  });

  it('preserves truncation state and caps player highlights', async () => {
    const events = Array.from({ length: 10 }, (_, index) => ({
      eventType: 'grid:property_developed',
      entityType: 'property',
      createdAt: `2026-09-16T08:0${9 - index}:00.000Z`,
      viewerRole: 'actor' as const,
      contestOutcome: null,
    }));

    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(context),
      listActivity: vi.fn().mockResolvedValue({
        truncated: true,
        events,
      }),
    };

    const summary = await buildGridReturnSummary(
      port,
      'viewer',
      '2026-09-16T08:15:00.000Z',
    );

    expect(summary?.truncated).toBe(true);
    expect(summary?.eventsScanned).toBe(10);
    expect(summary?.yourActivity.propertyDevelopments).toBe(10);
    expect(summary?.highlights).toHaveLength(6);
  });

  it('validates player and generated-at inputs before querying storage', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn(),
      listActivity: vi.fn(),
    };

    await expect(
      buildGridReturnSummary(port, ' ', '2026-09-16T08:15:00.000Z'),
    ).rejects.toThrow('requires playerId');
    await expect(
      buildGridReturnSummary(port, 'viewer', 'not-a-date'),
    ).rejects.toThrow('valid generatedAt timestamp');
    expect(port.getContext).not.toHaveBeenCalled();
  });
});
