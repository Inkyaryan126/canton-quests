export interface GridIncomeActionSeason {
  seasonId: string;
  seasonStatus: string;
}

export interface GridIncomeActionPort {
  getCurrentSeason(): Promise<GridIncomeActionSeason | null>;
}
