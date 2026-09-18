import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveGridScrimmageCityId } from '../lib/grid/server/scrimmage-city-resolver';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/scrimmages/route.ts'),
  'utf8',
);

describe('GRID scrimmage room creation API', () => {
  it('resolves a supported city slug server-side instead of trusting a city UUID from the browser', () => {
    expect(routeSource).toContain("typeof body.citySlug === 'string'");
    expect(routeSource).toContain('getGridCityPackage(citySlug)');
    expect(routeSource).toContain('resolveGridScrimmageCityId(citySlug)');
    expect(routeSource).not.toMatch(/body\.cityId/);
  });

  it('returns authenticated viewer context with a newly created host room', () => {
    expect(routeSource).toContain('playerId: session.player.id');
    expect(routeSource).toContain("role: 'host' as const");
  });

  it('resolves an imported Grid city id by slug', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'city-001' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const cityId = await resolveGridScrimmageCityId(
      ' canton-oh ',
      { from } as any,
    );

    expect(cityId).toBe('city-001');
    expect(from).toHaveBeenCalledWith('grid_cities');
    expect(select).toHaveBeenCalledWith('id');
    expect(eq).toHaveBeenCalledWith('slug', 'canton-oh');
  });

  it('fails closed when the requested city is not imported', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    await expect(
      resolveGridScrimmageCityId('canton-oh', { from } as any),
    ).rejects.toThrow('Grid scrimmage city is not imported');
  });

  it('requires trusted service-role configuration', async () => {
    await expect(
      resolveGridScrimmageCityId('canton-oh', null),
    ).rejects.toThrow(
      'Grid scrimmage city resolution requires Supabase service-role configuration',
    );
  });
});
