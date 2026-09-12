import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { getGridCityPackage, listGridCityPackages } from '../lib/grid/cities/registry';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

describe('Grid city package registry', () => {
  it('registers Canton as City #001 without putting Canton in Grid Core', () => {
    const pkg = getGridCityPackage('canton-oh');

    expect(pkg).toBe(cantonFoundingSeasonPackage);
    expect(pkg?.city.name).toBe('Canton');
    expect(pkg?.status).toBe('draft');
    expect(validateGridCityPackage(pkg!)).toEqual({ ok: true, errors: [] });
  });

  it('lists registered packages including Canton', () => {
    const list = listGridCityPackages();
    expect(list).toContain(cantonFoundingSeasonPackage);
  });

  it('returns undefined for an unknown city', () => {
    expect(getGridCityPackage('cleveland-oh')).toBeUndefined();
  });
});
