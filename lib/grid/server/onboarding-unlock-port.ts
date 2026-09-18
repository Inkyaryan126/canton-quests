export interface GridOnboardingUnlockContext {
  cityId: string;
  seasonId: string;
  seasonStatus: string;
}

export interface GridOnboardingUnlockPort {
  getContext(playerId: string): Promise<GridOnboardingUnlockContext | null>;
}
