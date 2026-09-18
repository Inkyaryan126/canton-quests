import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonAlliance } from '../lib/grid/cities/canton/founding-season-alliance';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { validateGridAllianceRules } from '../lib/grid/core/alliance';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

describe('Canton Founding Season Alliance tuning', () => {
  it('opts the city package into the shared Alliance rules contract', () => {
    expect(cantonFoundingSeasonPackage.seasonTemplate.alliance).toEqual(
      cantonFoundingSeasonAlliance,
    );
    expect(() => validateGridAllianceRules(cantonFoundingSeasonAlliance)).not.toThrow();
    expect(validateGridCityPackage(cantonFoundingSeasonPackage).errors).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^alliance\./)]),
    );
  });

  it('keeps Founding Season Alliances deliberately small and costly to sprawl', () => {
    expect(cantonFoundingSeasonAlliance.maxMembers).toBe(6);
    expect(cantonFoundingSeasonAlliance.leaveCooldownSeconds).toBe(86_400);
    expect(cantonFoundingSeasonAlliance.influencePoolCap).toBe(
      cantonFoundingSeasonPackage.seasonTemplate.balance.startingInfluence *
        cantonFoundingSeasonAlliance.maxMembers,
    );
    expect(cantonFoundingSeasonAlliance.largeAllianceThreshold).toBeLessThan(
      cantonFoundingSeasonAlliance.maxMembers,
    );
    expect(
      cantonFoundingSeasonAlliance.disconnectedComponentUpkeepInfluencePerTick,
    ).toBeGreaterThan(0);
    expect(
      cantonFoundingSeasonAlliance.largeAllianceSurchargeInfluencePerMemberPerTick,
    ).toBeGreaterThan(0);
  });
});
