export type GridVisitorEconomyEvidenceFact =
  | 'localInvestmentCredits'
  | 'ownedPropertyCount'
  | 'deploymentsUsed'
  | 'residencyPoints';

export interface GridVisitorEconomyEvidence {
  targetCitySlug: string;
  homeCitySlug: string | null;
  localInvestmentCredits: number | null;
  ownedPropertyCount: number | null;
  deploymentsUsed: number | null;
  residencyPoints: number | null;
}

export interface GridVisitorEconomyEvidencePort {
  readEvidence(
    playerId: string,
    targetCitySlug: string,
  ): Promise<GridVisitorEconomyEvidence>;
}
