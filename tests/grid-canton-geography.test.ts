import { describe, expect, it } from 'vitest';
import { getGridCityPackage } from '../lib/grid/cities/registry';
import { validateGridCityPackage } from '../lib/grid/core/city-package';
import { runCityValidation } from '../lib/grid/compiler/validate-package';
import { cantonRawGeography } from '../lib/grid/cities/canton/geography/raw-geography';
import { cantonDraftValidation } from '../lib/grid/cities/canton/geography/canton-draft-package';

describe('GRID Canton compiled geography', () => {
  it('populates the Canton registry from real source geography', () => {
    const pkg = getGridCityPackage('canton-oh');
    expect(pkg).toBeDefined();
    expect(pkg?.districts.length).toBeGreaterThan(0);
    expect(pkg?.territories).toHaveLength(20);
    expect(pkg?.properties).toHaveLength(11);
    expect(pkg?.landmarks).toHaveLength(6);
    expect(pkg?.compilerVersion).toBe('1.0.0');
    expect(pkg?.sourceSnapshotVersion).toBe('canton-downtown-slice-v1');
  });

  it('passes both legacy and compiler validation with zero ERROR issues', () => {
    const pkg = getGridCityPackage('canton-oh');
    expect(pkg).toBeDefined();
    if (!pkg) throw new Error('Canton package missing from registry');

    const legacy = validateGridCityPackage(pkg);
    expect(legacy.ok, legacy.errors.join('\n')).toBe(true);

    const validation = runCityValidation(pkg, cantonRawGeography);
    const errors = validation.issues.filter((issue) => issue.severity === 'ERROR');
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
    expect(cantonDraftValidation.ok).toBe(true);
  });

  it('returns byte-identical compiled geography arrays on repeated registry reads', () => {
    const first = getGridCityPackage('canton-oh');
    const second = getGridCityPackage('canton-oh');
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(JSON.stringify(first?.districts)).toBe(JSON.stringify(second?.districts));
    expect(JSON.stringify(first?.territories)).toBe(JSON.stringify(second?.territories));
    expect(JSON.stringify(first?.edges)).toBe(JSON.stringify(second?.edges));
    expect(JSON.stringify(first?.properties)).toBe(JSON.stringify(second?.properties));
    expect(JSON.stringify(first?.landmarks)).toBe(JSON.stringify(second?.landmarks));
  });
});
