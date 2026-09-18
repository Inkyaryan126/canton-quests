import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { resolveSupabaseGridSeason } from '../lib/grid/server/supabase-grid-season';

describe('resolveSupabaseGridSeason', () => {
  it('resolves city + season by package slugs without loading the whole world projection', async () => {
    const citySingle = vi.fn().mockResolvedValue({ data: { id: 'city-1' }, error: null });
    const cityEq = vi.fn().mockReturnValue({ maybeSingle: citySingle });
    const citySelect = vi.fn().mockReturnValue({ eq: cityEq });

    const seasonSingle = vi.fn().mockResolvedValue({
      data: { id: 'season-1', status: 'active' },
      error: null,
    });
    const seasonSlugEq = vi.fn().mockReturnValue({ maybeSingle: seasonSingle });
    const seasonCityEq = vi.fn().mockReturnValue({ eq: seasonSlugEq });
    const seasonSelect = vi.fn().mockReturnValue({ eq: seasonCityEq });

    const from = vi.fn((table: string) =>
      table === 'grid_cities' ? { select: citySelect } : { select: seasonSelect },
    );

    await expect(
      resolveSupabaseGridSeason(cantonFoundingSeasonPackage, { from } as any),
    ).resolves.toEqual({ cityId: 'city-1', seasonId: 'season-1', status: 'active' });

    expect(cityEq).toHaveBeenCalledWith('slug', cantonFoundingSeasonPackage.city.slug);
    expect(seasonCityEq).toHaveBeenCalledWith('city_id', 'city-1');
    expect(seasonSlugEq).toHaveBeenCalledWith('slug', cantonFoundingSeasonPackage.seasonTemplate.slug);
  });

  it('returns null when city or season is not imported', async () => {
    const cityMissing = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        })),
      })),
    };
    await expect(resolveSupabaseGridSeason(cantonFoundingSeasonPackage, cityMissing as any)).resolves.toBeNull();
  });
});
