import { describe, expect, it, vi } from 'vitest';
import type { GridAlliancePersistencePort } from '../lib/grid/server/alliance-persistence-port';
import { getGridAllianceDirectory } from '../lib/grid/server/alliance-directory-service';

const alliances = [
  {
    allianceId: 'a-1', seasonId: 'season-1', slug: 'alpha', name: 'Alpha',
    leaderPlayerId: 'leader-a', status: 'active' as const, influencePool: 450,
    revision: 3, createdAt: '2026-09-18T01:00:00.000Z',
    updatedAt: '2026-09-18T02:00:00.000Z', disbandedAt: null,
  },
  {
    allianceId: 'a-2', seasonId: 'season-1', slug: 'bravo', name: 'Bravo',
    leaderPlayerId: 'viewer', status: 'active' as const, influencePool: 120,
    revision: 4, createdAt: '2026-09-18T01:00:00.000Z',
    updatedAt: '2026-09-18T02:00:00.000Z', disbandedAt: null,
  },
];

function port(): GridAlliancePersistencePort {
  return {
    getAllianceById: vi.fn(),
    listActiveAlliances: vi.fn().mockResolvedValue(alliances),
    getMembershipHistory: vi.fn().mockResolvedValue([{
      playerId: 'viewer', seasonId: 'season-1', allianceId: 'a-2',
      joinedAt: '2026-09-18T02:00:00.000Z', leftAt: null, cooldownUntil: null,
    }]),
    countActiveMembers: vi.fn().mockImplementation(async (id: string) => id === 'a-1' ? 5 : 3),
    createAllianceWithLeader: vi.fn(), joinAlliance: vi.fn(), leaveAlliance: vi.fn(),
    getPlayerInfluence: vi.fn(), getInfluenceContributionReplay: vi.fn(),
    applyInfluenceContribution: vi.fn(), getActiveMemberPlayerIds: vi.fn(),
    getAllianceNetworkInputs: vi.fn(), getUpkeepSettlementReplay: vi.fn(),
    applyUpkeepSettlement: vi.fn(),
    getDisbandReplay: vi.fn().mockResolvedValue(null),
    disbandAlliance: vi.fn(),
  };
}

describe('GRID Alliance directory', () => {
  it('shows rival identity and size without leaking rival pool or player ids', async () => {
    const directory = await getGridAllianceDirectory(port(), 'season-1', 'viewer');
    expect(directory.alliances).toEqual([
      { allianceId: 'a-1', slug: 'alpha', name: 'Alpha', activeMemberCount: 5, isCurrent: false },
      { allianceId: 'a-2', slug: 'bravo', name: 'Bravo', activeMemberCount: 3, isCurrent: true },
    ]);
    expect(JSON.stringify(directory.alliances)).not.toContain('influencePool');
    expect(JSON.stringify(directory.alliances)).not.toContain('leaderPlayerId');
  });

  it('exposes pooled Influence only for the viewer current Alliance', async () => {
    const directory = await getGridAllianceDirectory(port(), 'season-1', 'viewer');
    expect(directory.current).toMatchObject({
      allianceId: 'a-2', slug: 'bravo', name: 'Bravo', role: 'leader',
      influencePool: 120, revision: 4, activeMemberCount: 3,
    });
    expect(directory.current).not.toHaveProperty('leaderPlayerId');
  });
});
