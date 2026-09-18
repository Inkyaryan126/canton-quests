import { validateGridAllianceRules } from '../core/alliance';
import type { GridAllianceRules } from '../core/alliance-types';
import type { GridCityPackage } from '../core/types';
import type { GridOnboardingSeasonPort } from './onboarding-season-port';

export interface GridAllianceSeasonContext {
  seasonId: string;
  status: 'active' | 'surge';
  rules: GridAllianceRules;
}

export async function resolveGridAllianceSeason(
  seasonPort: GridOnboardingSeasonPort,
  pkg: GridCityPackage,
): Promise<GridAllianceSeasonContext> {
  const rules = pkg.seasonTemplate.alliance;
  if (!rules) {
    throw new Error('Grid Alliance rules are not configured');
  }
  validateGridAllianceRules(rules);

  const season = await seasonPort.getCurrentSeason();
  if (!season) {
    throw new Error('Grid Alliance season was not found');
  }
  if (season.status !== 'active' && season.status !== 'surge') {
    throw new Error('Grid Alliances require an active or Surge season');
  }

  return {
    seasonId: season.seasonId,
    status: season.status,
    rules,
  };
}
