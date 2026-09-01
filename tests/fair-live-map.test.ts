// Canton Quests — Stark County Fair Live Map & Mission Scoping Test Suite

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FAIR_SECTOR_ZONES, resolveFairZoneId } from '../components/FairLiveMap';
import FairLiveMap from '../components/FairLiveMap';
import FairLiveMapWrapper from '../components/FairLiveMapWrapper';

describe('Stark County Fair Live Map Configuration & Coordinates', () => {
  it('should export all 4 canonical Stark County Fairgrounds sector zones with accurate GPS bounds', () => {
    expect(FAIR_SECTOR_ZONES).toHaveLength(4);

    const grandstand = FAIR_SECTOR_ZONES.find((z) => z.id === 'grandstand');
    expect(grandstand).toBeDefined();
    expect(grandstand?.name).toBe('Grandstand & Track Area');
    expect(grandstand?.color).toBe('#ff3b3b');
    expect(grandstand?.lat).toBeCloseTo(40.8060, 4);
    expect(grandstand?.lng).toBeCloseTo(-81.3992, 4);
    expect(grandstand?.radius).toBe(110);

    const midway = FAIR_SECTOR_ZONES.find((z) => z.id === 'midway');
    expect(midway).toBeDefined();
    expect(midway?.name).toBe('Midway & Carnival Plaza');
    expect(midway?.color).toBe('#ffcf3f');
    expect(midway?.lat).toBeCloseTo(40.8042, 4);
    expect(midway?.lng).toBeCloseTo(-81.3975, 4);
    expect(midway?.radius).toBe(120);

    const exhibition = FAIR_SECTOR_ZONES.find((z) => z.id === 'exhibition');
    expect(exhibition).toBeDefined();
    expect(exhibition?.name).toBe('Exhibition & Agri Pavilion');
    expect(exhibition?.color).toBe('#00f0ff');
    expect(exhibition?.lat).toBeCloseTo(40.8025, 4);
    expect(exhibition?.lng).toBeCloseTo(-81.4012, 4);
    expect(exhibition?.radius).toBe(130);

    const foodRow = FAIR_SECTOR_ZONES.find((z) => z.id === 'food_row');
    expect(foodRow).toBeDefined();
    expect(foodRow?.name).toBe('South Gate & Food Row');
    expect(foodRow?.color).toBe('#10b981');
    expect(foodRow?.lat).toBeCloseTo(40.8014, 4);
    expect(foodRow?.lng).toBeCloseTo(-81.3988, 4);
    expect(foodRow?.radius).toBe(110);
  });

  it('should export FairLiveMap as a functional React component', () => {
    expect(typeof FairLiveMap).toBe('function');
  });

  it('should export FairLiveMapWrapper as a functional React component', () => {
    expect(typeof FairLiveMapWrapper).toBe('function');
  });

  it('correctly maps Signal numbers and keywords to fairground sectors', () => {
    expect(resolveFairZoneId('Agent scanned Signal 01 at Grandstand')).toBe('grandstand');
    expect(resolveFairZoneId('Track arena dispatch')).toBe('grandstand');
    expect(resolveFairZoneId('fair-core-03')).toBe('grandstand');

    expect(resolveFairZoneId('Agent claimed Signal 07 at Midway')).toBe('midway');
    expect(resolveFairZoneId('Carnival plaza flash drop')).toBe('midway');
    expect(resolveFairZoneId('fair-core-09')).toBe('midway');

    expect(resolveFairZoneId('Agent claimed Signal 12 at livestock barn')).toBe('exhibition');
    expect(resolveFairZoneId('Agri pavilion discovery')).toBe('exhibition');
    expect(resolveFairZoneId('fair-core-14')).toBe('exhibition');

    expect(resolveFairZoneId('Daily Bonus — Sept 4 secured')).toBe('food_row');
    expect(resolveFairZoneId('South Gate concession stand')).toBe('food_row');
    expect(resolveFairZoneId('fair-core-18')).toBe('food_row');

    expect(resolveFairZoneId(undefined)).toBe('midway');
    expect(resolveFairZoneId('')).toBe('midway');
  });

  it('verifies FairLiveMap includes reduced-motion accessibility overrides', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('animation: none !important');
    expect(source).toContain('display: none !important');
  });

  it('verifies Fair QR Hunt dashboard mounts FairLiveMapWrapper', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/events/fair-qr-hunt/page.tsx'), 'utf-8');
    expect(source).toContain("import FairLiveMapWrapper from '@/components/FairLiveMapWrapper'");
    expect(source).toContain('<FairLiveMapWrapper />');
  });

  it('verifies Cipher Mission dashboard mounts SectorMapWrapper in MAP tab', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/events/[slug]/page.tsx'), 'utf-8');
    expect(source).toContain("import SectorMapWrapper from '@/components/SectorMapWrapper'");
    expect(source).toContain('<SectorMapWrapper />');
    expect(source).toContain('<CantonMapWrapper');
  });

  it('verifies Spectator Watch page conditionally scopes to FairLiveMapWrapper or SectorMapWrapper', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/watch/page.tsx'), 'utf-8');
    expect(source).toContain("import FairLiveMapWrapper from '@/components/FairLiveMapWrapper'");
    expect(source).toContain("import SectorMapWrapper from '@/components/SectorMapWrapper'");
    expect(source).toContain("<FairLiveMapWrapper");
    expect(source).toContain("<SectorMapWrapper");
    expect(source).toContain("requestedEventSlug === 'fair-qr-hunt'");
  });
});
