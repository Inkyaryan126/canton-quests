export type GridVisitorStanding = 'home' | 'visitor' | 'unassigned';

export interface GridVisitorEconomyPolicy {
  visitorInvestmentCapCredits: number;
  visitorPropertyLimit: number;
  visitorDeploymentAllowance: number;
  residencyThresholdPoints: number | null;
}

export interface GridVisitorEconomyFacts {
  targetCitySlug: string;
  homeCitySlug: string | null;
  localInvestmentCredits: number;
  ownedPropertyCount: number;
  deploymentsUsed: number;
  residencyPoints: number;
}

export interface GridVisitorEconomyProjection {
  standing: GridVisitorStanding;
  targetCitySlug: string;
  homeCitySlug: string | null;
  restrictionsApply: boolean;
  investmentCapCredits: number | null;
  investmentRemainingCredits: number | null;
  propertyLimit: number | null;
  propertySlotsRemaining: number | null;
  deploymentAllowance: number | null;
  deploymentsRemaining: number | null;
  residency: {
    points: number;
    threshold: number | null;
    eligible: boolean;
  };
}

export type GridVisitorAction =
  | { type: 'invest'; credits: number }
  | { type: 'acquire-property' }
  | { type: 'deploy' };

export type GridVisitorActionReason =
  | 'allowed'
  | 'investment-cap'
  | 'property-limit'
  | 'deployment-limit';

export interface GridVisitorActionDecision {
  allowed: boolean;
  reason: GridVisitorActionReason;
}

export interface GridCityWealthTransferRequest {
  sourceCitySlug: string;
  targetCitySlug: string;
  credits: number;
  influence: number;
  commandPoints: number;
}

export interface GridCityWealthTransferDecision {
  allowed: boolean;
  reason: 'same-city' | 'no-local-wealth' | 'cross-city-wealth-disabled';
}
