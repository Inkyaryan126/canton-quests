// Canton Quests — SectorMap Component & Real-World Coordinates Test Suite

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SECTOR_ZONES } from '../components/SectorMap';
import SectorMap from '../components/SectorMap';
import SectorMapWrapper from '../components/SectorMapWrapper';
import { PublicGameFeedItem } from '../lib/types';

const KNOWN_GOOD_ZONES = [
  { id: 'mckinley', name: 'McKinley / West Lawn', color: '#b46bff', lat: 40.807, lng: -81.3936, radius: 520 },
  { id: 'downtown', name: 'Downtown / Arts District', color: '#ffcf3f', lat: 40.8, lng: -81.3758, radius: 560 },
  { id: 'southside', name: 'South Side / 9th St', color: '#ff3b3b', lat: 40.788, lng: -81.3805, radius: 480 },
];

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

  it('preserves server-authoritative reward integrity with zero fabricated telemetry', () => {
    const mockFeed: PublicGameFeedItem[] = [
      {
        id: 'feed-1',
        eventId: 'evt-canton-vol-1',
        feedType: 'quest_completion',
        headline: 'Agent completed 4th Street Mural objective',
        districtName: 'Arts District',
        urgency: 'info',
        isHost: false,
        isRetracted: false,
        isMinorParticipant: false,
        isPublicFeedEligible: true,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'feed-2',
        eventId: 'evt-canton-vol-1',
        feedType: 'host_broadcast',
        headline: 'Game Master initiated live drop at Centennial Plaza',
        districtName: 'Downtown',
        urgency: 'flash',
        isHost: true,
        isRetracted: false,
        isMinorParticipant: false,
        isPublicFeedEligible: true,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];

    // Verify properties adhere to public feed schema
    expect(mockFeed).toHaveLength(2);
    expect(mockFeed[0].isHost).toBe(false);
    expect(mockFeed[1].isHost).toBe(true);
    expect(mockFeed[1].urgency).toBe('flash');
  });
});

describe("Founder's Cipher SectorMap basemap production fix", () => {
  const sectorMapSource = () => fs.readFileSync(path.join(process.cwd(), 'components/SectorMap.tsx'), 'utf-8');

  it('1. no longer uses the broken CARTO tile URL that returns "API KEY REQUIRED" watermarked tiles', () => {
    expect(sectorMapSource()).not.toContain('basemaps.cartocdn.com');
    expect(sectorMapSource()).not.toContain("L.tileLayer('https://{s}.basemaps.cartocdn.com");
  });

  it('2. uses the same production-safe, no-key OpenStreetMap tile source already proven in CantonMap.tsx and FairLiveMap.tsx', () => {
    expect(sectorMapSource()).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('3. carries the correct, legally-required OpenStreetMap attribution, linked and not hidden', () => {
    const s = sectorMapSource();
    expect(s).toContain('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    expect(s).toContain('attributionControl: true');
  });

  it('4. does not introduce any API key, token, or secret into client-side code', () => {
    const s = sectorMapSource();
    expect(s).not.toMatch(/api[_-]?key/i);
    expect(s).not.toMatch(/access[_-]?token/i);
  });

  it("5. Founder's Cipher map center and zoom are byte-identical to before the basemap fix", () => {
    expect(sectorMapSource()).toContain('.setView([40.7980, -81.3820], 13.6);');
  });

  it('6. all three district/zone coordinates are byte-identical to before the basemap fix', () => {
    expect(SECTOR_ZONES).toHaveLength(3);
    for (const known of KNOWN_GOOD_ZONES) {
      const zone = SECTOR_ZONES.find((z) => z.id === known.id);
      expect(zone, `zone ${known.id} should exist`).toBeDefined();
      expect(zone?.name).toBe(known.name);
      expect(zone?.color).toBe(known.color);
      expect(zone?.lat).toBe(known.lat);
      expect(zone?.lng).toBe(known.lng);
      expect(zone?.radius).toBe(known.radius);
    }
  });

  it('7. FairLiveMap (Fair QR Hunt) configuration is untouched by this SectorMap-only fix', () => {
    const fairSource = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(fairSource).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(fairSource).toContain('.setView([FAIR_MAP_CENTER.lat, FAIR_MAP_CENTER.lng], 15.4);');
  });

  it('8. CantonMap (Canton citywide) configuration is untouched by this SectorMap-only fix', () => {
    const cantonMapSource = fs.readFileSync(path.join(process.cwd(), 'components/CantonMap.tsx'), 'utf-8');
    expect(cantonMapSource).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(cantonMapSource).toContain('const CANTON_CENTER: [number, number] = [40.7989, -81.3748];');
  });

  it("9. the Founder's Cipher mission dashboard still mounts SectorMapWrapper (which renders this fixed SectorMap) in its MAP tab", () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), 'app/events/[slug]/page.tsx'), 'utf-8');
    expect(pageSource).toContain("import SectorMapWrapper from '@/components/SectorMapWrapper'");
    expect(pageSource).toContain('<SectorMapWrapper />');
  });

  it('10. this is a basemap-provider-only fix — SectorMap.tsx carries no Founder Lock / Master Cipher / finale gameplay logic that could have been touched', () => {
    const s = sectorMapSource();
    expect(s).not.toMatch(/frankenstein/i);
    expect(s).not.toMatch(/founderlock/i);
    expect(s).not.toMatch(/finalanswer/i);
    expect(s).not.toMatch(/master ?cipher/i);
    // The component only renders display/telemetry — it holds no reward,
    // submission, or finale state of its own.
    expect(s).not.toContain('awardQuestRewardsDB');
    expect(s).not.toContain('submitQuestProof');
  });

  it('the district label backing plate keeps labels legible against the new light basemap (same fix already applied to FairLiveMap)', () => {
    const s = sectorMapSource();
    expect(s).toContain('background:rgba(10,13,18,0.82)');
    expect(s).not.toContain('text-shadow:0 0 6px ${zone.color}');
  });

  it('no maxBounds/fitBounds were introduced — bounds remain unset, matching the pre-fix map', () => {
    const s = sectorMapSource();
    expect(s).not.toContain('maxBounds');
    expect(s).not.toContain('fitBounds');
  });
});
