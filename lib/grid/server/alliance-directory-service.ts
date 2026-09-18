import type {
  GridAlliancePersistencePort,
  GridAllianceState,
} from './alliance-persistence-port';

export interface GridAllianceDirectoryEntry {
  allianceId: string;
  slug: string;
  name: string;
  activeMemberCount: number;
  isCurrent: boolean;
}

export interface GridAllianceCurrentView {
  allianceId: string;
  slug: string;
  name: string;
  role: 'leader' | 'member';
  influencePool: number;
  revision: number;
  activeMemberCount: number;
  joinedAt: string;
}

export interface GridAllianceDirectory {
  seasonId: string;
  alliances: GridAllianceDirectoryEntry[];
  current: GridAllianceCurrentView | null;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid Alliance directory requires ${label}`);
  return normalized;
}

export async function getGridAllianceDirectory(
  port: GridAlliancePersistencePort,
  seasonIdInput: string,
  playerIdInput: string,
): Promise<GridAllianceDirectory> {
  const seasonId = requireText(seasonIdInput, 'seasonId');
  const playerId = requireText(playerIdInput, 'playerId');
  const [alliances, history] = await Promise.all([
    port.listActiveAlliances(seasonId),
    port.getMembershipHistory(seasonId, playerId),
  ]);
  const activeMembership = history.find((membership) => membership.leftAt === null) ?? null;

  const sorted = [...alliances].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.allianceId.localeCompare(right.allianceId);
  });
  const counts = await Promise.all(
    sorted.map((alliance) => port.countActiveMembers(alliance.allianceId)),
  );

  const entries = sorted.map((alliance, index) => ({
    allianceId: alliance.allianceId,
    slug: alliance.slug,
    name: alliance.name,
    activeMemberCount: counts[index] ?? 0,
    isCurrent: activeMembership?.allianceId === alliance.allianceId,
  }));

  let current: GridAllianceCurrentView | null = null;
  if (activeMembership) {
    const index = sorted.findIndex(
      (alliance) => alliance.allianceId === activeMembership.allianceId,
    );
    const alliance: GridAllianceState | undefined = index >= 0 ? sorted[index] : undefined;
    if (alliance) {
      current = {
        allianceId: alliance.allianceId,
        slug: alliance.slug,
        name: alliance.name,
        role: alliance.leaderPlayerId === playerId ? 'leader' : 'member',
        influencePool: alliance.influencePool,
        revision: alliance.revision,
        activeMemberCount: counts[index] ?? 0,
        joinedAt: activeMembership.joinedAt,
      };
    }
  }

  return { seasonId, alliances: entries, current };
}
