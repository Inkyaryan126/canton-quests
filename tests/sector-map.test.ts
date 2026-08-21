// Canton Quests — SectorMap Component & Real-World Coordinates Test Suite

import { describe, it, expect } from 'vitest';
import { SECTOR_ZONES } from '../components/SectorMap';
import SectorMap from '../components/SectorMap';
import SectorMapWrapper from '../components/SectorMapWrapper';

describe('Live Sector Map Component & Configuration', () => {
  it('should export all 3 canonical Canton, OH sector zones with accurate GPS bounds', () => {
    expect(SECTOR_ZONES).toHaveLength(3);

    const mckinley = SECTOR_ZONES.find((z) => z.id === 'mckinley');
    expect(mckinley).toBeDefined();
    expect(mckinley?.name).toBe('McKinley / West Lawn');
    expect(mckinley?.color).toBe('#b46bff');
    expect(mckinley?.lat).toBeCloseTo(40.8070, 4);
    expect(mckinley?.lng).toBeCloseTo(-81.3936, 4);
    expect(mckinley?.radius).toBe(520);

    const downtown = SECTOR_ZONES.find((z) => z.id === 'downtown');
    expect(downtown).toBeDefined();
    expect(downtown?.name).toBe('Downtown / Arts District');
    expect(downtown?.color).toBe('#ffcf3f');
    expect(downtown?.lat).toBeCloseTo(40.8000, 4);
    expect(downtown?.lng).toBeCloseTo(-81.3758, 4);
    expect(downtown?.radius).toBe(560);

    const southside = SECTOR_ZONES.find((z) => z.id === 'southside');
    expect(southside).toBeDefined();
    expect(southside?.name).toBe('South Side / 9th St');
    expect(southside?.color).toBe('#ff3b3b');
    expect(southside?.lat).toBeCloseTo(40.7880, 4);
    expect(southside?.lng).toBeCloseTo(-81.3805, 4);
    expect(southside?.radius).toBe(480);
  });

  it('should export SectorMap as a functional React component', () => {
    expect(typeof SectorMap).toBe('function');
  });

  it('should export SectorMapWrapper as a functional React component', () => {
    expect(typeof SectorMapWrapper).toBe('function');
  });
});
