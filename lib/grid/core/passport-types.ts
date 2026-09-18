export const GRID_PASSPORT_VERSION = 1 as const;

export interface GridPassportEventBase {
  id: string;
  occurredAt: string;
}

export type GridPassportEvent =
  | (GridPassportEventBase & {
      type: 'city-entered';
      citySlug: string;
    })
  | (GridPassportEventBase & {
      type: 'home-city-set';
      citySlug: string;
    })
  | (GridPassportEventBase & {
      type: 'city-rank-recorded';
      citySlug: string;
      rank: number;
    })
  | (GridPassportEventBase & {
      type: 'championship-earned';
      citySlug: string;
      seasonSlug: string;
      achievementId: string;
      label: string;
    })
  | (GridPassportEventBase & {
      type: 'territory-control-recorded';
      citySlug: string;
      seasonSlug: string;
      territorySlug: string;
    })
  | (GridPassportEventBase & {
      type: 'landmark-achievement-earned';
      citySlug: string;
      achievementId: string;
      label: string;
    })
  | (GridPassportEventBase & {
      type: 'alliance-championship-earned';
      citySlug: string;
      seasonSlug: string;
      achievementId: string;
      label: string;
    })
  | (GridPassportEventBase & {
      type: 'seasonal-trophy-earned';
      citySlug: string;
      seasonSlug: string;
      achievementId: string;
      label: string;
    })
  | (GridPassportEventBase & {
      type: 'rare-cosmetic-earned';
      cosmeticId: string;
      label: string;
    })
  | (GridPassportEventBase & {
      type: 'reputation-earned';
      amount: number;
      reason: string;
      citySlug?: string;
    });

export interface GridPassportCityRank {
  citySlug: string;
  currentRank: number;
  peakRank: number;
  updatedAt: string;
}

export interface GridPassportAchievement {
  achievementId: string;
  label: string;
  citySlug: string;
  seasonSlug: string | null;
  earnedAt: string;
}

export interface GridPassportCosmetic {
  cosmeticId: string;
  label: string;
  earnedAt: string;
}

export interface GridPassportProjection {
  version: typeof GRID_PASSPORT_VERSION;
  homeCitySlug: string | null;
  citiesEntered: string[];
  cityRanks: GridPassportCityRank[];
  championships: GridPassportAchievement[];
  peakRank: number | null;
  lifetimeTerritoriesControlled: number;
  landmarkAchievements: GridPassportAchievement[];
  allianceChampionships: GridPassportAchievement[];
  seasonalTrophies: GridPassportAchievement[];
  rareCosmetics: GridPassportCosmetic[];
  nationalReputation: number;
  processedEventCount: number;
  lastUpdatedAt: string | null;
}
