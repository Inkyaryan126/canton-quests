import type {
  GridCategoryScores,
  GridProgressionSnapshot,
  GridProgressionStats,
  GridStatCategory,
  GridStatDefinition,
  GridStatKey,
} from './progression-types';

export const GRID_CATEGORY_WEIGHTS: Record<GridStatCategory, number> = {
  progression: 0.12,
  missions: 0.15,
  discovery: 0.15,
  territory: 0.16,
  economy: 0.12,
  competitive: 0.15,
  social: 0.07,
  legacy: 0.08,
};

const stat = (
  key: GridStatKey,
  label: string,
  category: GridStatCategory,
  kind: GridStatDefinition['kind'],
  softCap: number,
  weight: number,
  rankingEnabled = true,
): GridStatDefinition => ({ key, label, category, kind, softCap, weight, rankingEnabled });

export const GRID_STAT_DEFINITIONS: readonly GridStatDefinition[] = [
  stat('xp', 'XP', 'progression', 'counter', 25000, 4),
  stat('reputation', 'Reputation', 'progression', 'counter', 10000, 3),
  stat('seasonScore', 'Season Score', 'progression', 'counter', 10000, 3),
  stat('missionScore', 'Mission Score', 'missions', 'counter', 15000, 4),
  stat('missionsCompleted', 'Missions Completed', 'missions', 'counter', 150, 3),
  stat('bountyScore', 'Bounty Score', 'missions', 'counter', 5000, 2),
  stat('accuracyRating', 'Accuracy', 'missions', 'percent', 100, 1),
  stat('exploration', 'Exploration', 'discovery', 'counter', 10000, 3),
  stat('locationsDiscovered', 'Locations Discovered', 'discovery', 'counter', 250, 2),
  stat('signalFinds', 'Signals Found', 'discovery', 'counter', 250, 3),
  stat('intel', 'Intel', 'discovery', 'counter', 10000, 3),
  stat('discoveryScore', 'Discovery Score', 'discovery', 'counter', 10000, 3),
  stat('firstDiscoveries', 'First Discoveries', 'discovery', 'counter', 50, 2),
  stat('rareFinds', 'Rare Finds', 'discovery', 'counter', 100, 2),
  stat('collectionScore', 'Collection Score', 'discovery', 'counter', 7500, 2),
  stat('districtMastery', 'District Mastery', 'discovery', 'percent', 100, 2),
  stat('cityMastery', 'City Mastery', 'discovery', 'percent', 100, 3),
  stat('territoryControl', 'Territory Control', 'territory', 'counter', 10000, 4),
  stat('territoriesCaptured', 'Territories Captured', 'territory', 'counter', 100, 3),
  stat('territoriesDefended', 'Territories Defended', 'territory', 'counter', 100, 3),
  stat('captureRating', 'Capture Rating', 'territory', 'rating', 2000, 2),
  stat('defenseRating', 'Defense Rating', 'territory', 'rating', 2000, 2),
  stat('propertyValue', 'Property Value', 'economy', 'counter', 250000, 4),
  stat('propertiesOwned', 'Properties Owned', 'economy', 'counter', 75, 2),
  stat('netWorth', 'Net Worth', 'economy', 'counter', 500000, 4),
  stat('influence', 'Influence', 'economy', 'counter', 10000, 2),
  stat('scrimmageRating', 'Scrimmage Rating', 'competitive', 'rating', 2000, 4),
  stat('scrimmageWins', 'Scrimmage Wins', 'competitive', 'counter', 100, 3),
  stat('scrimmageLosses', 'Scrimmage Losses', 'competitive', 'counter', 100, 0, false),
  stat('winStreak', 'Win Streak', 'competitive', 'streak', 20, 2),
  stat('challengeRating', 'Challenge Rating', 'competitive', 'rating', 2000, 3),
  stat('strategyRating', 'Strategy Rating', 'competitive', 'rating', 2000, 3),
  stat('speedRating', 'Speed Rating', 'competitive', 'rating', 2000, 1),
  stat('stealthRating', 'Stealth Rating', 'competitive', 'rating', 2000, 1),
  stat('riskRating', 'Risk Rating', 'competitive', 'rating', 2000, 1),
  stat('survivalStreak', 'Survival Streak', 'competitive', 'streak', 30, 1),
  stat('factionRank', 'Faction Rank', 'social', 'counter', 5000, 2),
  stat('factionLoyalty', 'Faction Loyalty', 'social', 'counter', 5000, 2),
  stat('leadership', 'Leadership', 'social', 'counter', 5000, 3),
  stat('teamwork', 'Teamwork', 'social', 'counter', 5000, 3),
  stat('socialReputation', 'Social Reputation', 'social', 'counter', 5000, 2),
  stat('attendanceStreak', 'Attendance Streak', 'legacy', 'streak', 60, 1),
  stat('dailyStreak', 'Daily Streak', 'legacy', 'streak', 90, 1),
  stat('eventWins', 'Event Wins', 'legacy', 'counter', 25, 3),
  stat('legacyScore', 'Legacy Score', 'legacy', 'counter', 10000, 5),
  stat('heat', 'Heat', 'legacy', 'gauge', 100, 0, false),
  stat('wantedLevel', 'Wanted Level', 'legacy', 'gauge', 5, 0, false),
] as const;

const STAT_BY_KEY = new Map(GRID_STAT_DEFINITIONS.map((definition) => [definition.key, definition]));

export function createEmptyGridProgressionStats(): GridProgressionStats {
  return Object.fromEntries(GRID_STAT_DEFINITIONS.map(({ key }) => [key, 0])) as GridProgressionStats;
}

function cleanNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function statCeiling(definition: GridStatDefinition): number | null {
  if (definition.kind === 'percent' || definition.kind === 'gauge') return definition.softCap;
  return null;
}

export function sanitizeGridProgressionStats(input: Partial<GridProgressionStats>): GridProgressionStats {
  const stats = createEmptyGridProgressionStats();
  for (const definition of GRID_STAT_DEFINITIONS) {
    const value = cleanNumber(input[definition.key] ?? 0);
    const ceiling = statCeiling(definition);
    stats[definition.key] = ceiling === null ? value : Math.min(value, ceiling);
  }
  return stats;
}

function normalizedStatScore(definition: GridStatDefinition, value: number): number {
  if (!definition.rankingEnabled || definition.weight <= 0 || definition.softCap <= 0) return 0;
  return Math.min(1, cleanNumber(value) / definition.softCap);
}

export function computeGridCategoryScores(statsInput: Partial<GridProgressionStats>): GridCategoryScores {
  const stats = sanitizeGridProgressionStats(statsInput);
  const categories = Object.keys(GRID_CATEGORY_WEIGHTS) as GridStatCategory[];
  const scores = {} as GridCategoryScores;

  for (const category of categories) {
    const definitions = GRID_STAT_DEFINITIONS.filter(
      (definition) => definition.category === category && definition.rankingEnabled && definition.weight > 0,
    );
    const totalWeight = definitions.reduce((sum, definition) => sum + definition.weight, 0);
    const weighted = definitions.reduce(
      (sum, definition) => sum + normalizedStatScore(definition, stats[definition.key]) * definition.weight,
      0,
    );
    scores[category] = totalWeight > 0 ? Math.round((weighted / totalWeight) * 1000) : 0;
  }

  return scores;
}

export function computeGridRating(statsInput: Partial<GridProgressionStats>): number {
  const categoryScores = computeGridCategoryScores(statsInput);
  const weighted = (Object.keys(GRID_CATEGORY_WEIGHTS) as GridStatCategory[]).reduce(
    (sum, category) => sum + (categoryScores[category] / 1000) * GRID_CATEGORY_WEIGHTS[category],
    0,
  );
  return Math.round(weighted * 10000);
}

export function computeGridLevel(totalXp: number): number {
  return Math.floor(cleanNumber(totalXp) / 250) + 1;
}

const TITLE_RULES: ReadonlyArray<{ key: GridStatKey; title: string; threshold: number }> = [
  { key: 'exploration', title: 'The Cartographer', threshold: 0.5 },
  { key: 'territoryControl', title: 'District King', threshold: 0.5 },
  { key: 'signalFinds', title: 'Signal Hunter', threshold: 0.5 },
  { key: 'intel', title: 'Ciphermaster', threshold: 0.5 },
  { key: 'propertyValue', title: 'Land Baron', threshold: 0.5 },
  { key: 'scrimmageRating', title: 'Untouchable', threshold: 0.65 },
  { key: 'stealthRating', title: 'The Ghost', threshold: 0.65 },
  { key: 'rareFinds', title: 'Relic Hunter', threshold: 0.5 },
  { key: 'leadership', title: 'Field Commander', threshold: 0.6 },
  { key: 'legacyScore', title: 'Grid Legend', threshold: 0.75 },
];

export function deriveGridTitles(statsInput: Partial<GridProgressionStats>): {
  titles: string[];
  primaryTitle: string | null;
} {
  const stats = sanitizeGridProgressionStats(statsInput);
  const eligible = TITLE_RULES.flatMap((rule) => {
    const definition = STAT_BY_KEY.get(rule.key);
    if (!definition) return [];
    const score = normalizedStatScore(definition, stats[rule.key]);
    return score >= rule.threshold ? [{ title: rule.title, score }] : [];
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return {
    titles: eligible.map(({ title }) => title),
    primaryTitle: eligible[0]?.title ?? null,
  };
}

export function buildGridProgressionSnapshot(
  statsInput: Partial<GridProgressionStats>,
  totalXp = statsInput.xp ?? 0,
): GridProgressionSnapshot {
  const stats = sanitizeGridProgressionStats({ ...statsInput, xp: cleanNumber(totalXp) });
  const titleState = deriveGridTitles(stats);
  return {
    version: 1,
    totalXp: stats.xp,
    level: computeGridLevel(stats.xp),
    gridRating: computeGridRating(stats),
    stats,
    categoryScores: computeGridCategoryScores(stats),
    ...titleState,
  };
}

export function applyGridStatDelta(
  current: Partial<GridProgressionStats>,
  delta: Partial<GridProgressionStats>,
): GridProgressionStats {
  const base = sanitizeGridProgressionStats(current);
  const next: Partial<GridProgressionStats> = { ...base };
  for (const definition of GRID_STAT_DEFINITIONS) {
    const change = delta[definition.key];
    if (change === undefined) continue;
    next[definition.key] = base[definition.key] + (Number.isFinite(change) ? change : 0);
  }
  return sanitizeGridProgressionStats(next);
}

export function applyGridStatPatch(
  current: Partial<GridProgressionStats>,
  patch: Partial<GridProgressionStats>,
): GridProgressionStats {
  return sanitizeGridProgressionStats({ ...sanitizeGridProgressionStats(current), ...patch });
}
