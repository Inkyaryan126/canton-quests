import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import type { GridOnboardingSeasonPort } from '../lib/grid/server/onboarding-season-port';
import { resolveGridAllianceSeason } from '../lib/grid/server/alliance-season-service';

function seasonPort(status: string | null): GridOnboardingSeasonPort {
  return {
    getCurrentSeason: vi.fn().mockResolvedValue(
      status ? { seasonId: 'season-1', status } : null,
    ),
  };
}

describe('GRID Alliance season resolver', () => {
  it('returns configured rules only for a live playable season', async () => {
    const context = await resolveGridAllianceSeason(
      seasonPort('active'),
      cantonFoundingSeasonPackage,
    );
    expect(context.seasonId).toBe('season-1');
    expect(context.status).toBe('active');
    expect(context.rules).toEqual(
      cantonFoundingSeasonPackage.seasonTemplate.alliance,
    );
  });

  it('allows Surge but rejects non-playable season states', async () => {
    await expect(
      resolveGridAllianceSeason(seasonPort('surge'), cantonFoundingSeasonPackage),
    ).resolves.toMatchObject({ status: 'surge' });
    await expect(
      resolveGridAllianceSeason(seasonPort('scheduled'), cantonFoundingSeasonPackage),
    ).rejects.toThrow('active or Surge season');
    await expect(
      resolveGridAllianceSeason(seasonPort(null), cantonFoundingSeasonPackage),
    ).rejects.toThrow('season was not found');
  });

  it('fails closed when the city package has not opted into Alliances', async () => {
    const pkg = structuredClone(cantonFoundingSeasonPackage);
    delete pkg.seasonTemplate.alliance;
    await expect(resolveGridAllianceSeason(seasonPort('active'), pkg)).rejects.toThrow(
      'rules are not configured',
    );
  });
});
