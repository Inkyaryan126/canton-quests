export type GridStatCategory =
  | 'progression'
  | 'missions'
  | 'discovery'
  | 'territory'
  | 'economy'
  | 'competitive'
  | 'social'
  | 'legacy';

export type GridStatKind = 'counter' | 'rating' | 'percent' | 'streak' | 'gauge';

export type GridStatKey =
  | 'xp'
  | 'reputation'
  | 'missionScore'
  | 'missionsCompleted'
  | 'exploration'
  | 'locationsDiscovered'
  | 'signalFinds'
  | 'intel'
  | 'territoryControl'
  | 'territoriesCaptured'
  | 'territoriesDefended'
  | 'propertyValue'
  | 'propertiesOwned'
  | 'netWorth'
  | 'influence'
  | 'scrimmageRating'
  | 'scrimmageWins'
  | 'scrimmageLosses'
  | 'winStreak'
  | 'challengeRating'
  | 'defenseRating'
  | 'captureRating'
  | 'strategyRating'
  | 'speedRating'
  | 'accuracyRating'
  | 'stealthRating'
  | 'riskRating'
  | 'discoveryScore'
  | 'firstDiscoveries'
  | 'rareFinds'
  | 'collectionScore'
  | 'districtMastery'
  | 'cityMastery'
  | 'factionRank'
  | 'factionLoyalty'
  | 'leadership'
  | 'teamwork'
  | 'socialReputation'
  | 'bountyScore'
  | 'heat'
  | 'wantedLevel'
  | 'survivalStreak'
  | 'attendanceStreak'
  | 'dailyStreak'
  | 'eventWins'
  | 'seasonScore'
  | 'legacyScore';

export type GridProgressionStats = Record<GridStatKey, number>;

export interface GridStatDefinition {
  key: GridStatKey;
  label: string;
  category: GridStatCategory;
  kind: GridStatKind;
  softCap: number;
  weight: number;
  rankingEnabled: boolean;
}

export type GridCategoryScores = Record<GridStatCategory, number>;

export interface GridProgressionSnapshot {
  version: 1;
  totalXp: number;
  level: number;
  gridRating: number;
  stats: GridProgressionStats;
  categoryScores: GridCategoryScores;
  titles: string[];
  primaryTitle: string | null;
}
