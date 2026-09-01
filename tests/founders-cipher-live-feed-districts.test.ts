import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getDistrictActivity,
  seedDefaultSpectatorData,
} from '../lib/spectator-engine';
import {
  FOUNDER_CIPHER_CANONICAL_DISTRICTS,
  FAIR_QR_HUNT_DISTRICT_CONFIGS,
  getDefaultDistrictsForEvent,
  isFounderCipherOperation,
  isFairOperation,
} from '../lib/spectator-districts';
import {
  resetGameEngineStore,
  getOrCreateEventParticipation,
  createQuest,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';

describe("Founder's Cipher Live Feed District Fix & Canonical Source of Truth", () => {
  beforeEach(() => {
    resetGameEngineStore();
  });

  it('1. Founder’s Cipher renders exactly 3 district activity entries', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    expect(districts).toHaveLength(3);

    const defaultDistricts = getDefaultDistrictsForEvent('canton-weekend-1');
    expect(defaultDistricts).toHaveLength(3);

    expect(FOUNDER_CIPHER_CANONICAL_DISTRICTS).toHaveLength(3);
  });

  it('2. Family exists with canonical real-world identity (Arts District / downtown)', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    const family = districts.find((d) => d.path === 'family' || d.id === 'dist-family' || d.name.includes('Family'));

    expect(family).toBeDefined();
    expect(family?.name).toContain('Family');
    expect(family?.name).toContain('Arts District');
    expect(family?.landmark).toContain('Centennial Plaza');
  });

  it('3. Challenge exists with canonical real-world identity (Mother Goose Land / 9th St)', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    const challenge = districts.find((d) => d.path === 'challenge' || d.id === 'dist-challenge' || d.name.includes('Challenge'));

    expect(challenge).toBeDefined();
    expect(challenge?.name).toContain('Challenge');
    expect(challenge?.name).toContain('Mother Goose Land');
    expect(challenge?.landmark).toContain('Mother Goose Land');
  });

  it('4. Secret exists with canonical real-world identity (Monument Park / McKinley)', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    const secret = districts.find((d) => d.path === 'secret' || d.id === 'dist-secret' || d.name.includes('Secret'));

    expect(secret).toBeDefined();
    expect(secret?.name).toContain('Secret');
    expect(secret?.name).toContain('Monument Park');
    expect(secret?.landmark).toContain('McKinley National Memorial');
  });

  it('5. no fourth Founder’s Cipher district renders (legacy Hall of Fame and Central Market completely eliminated)', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    expect(districts).toHaveLength(3);

    const names = districts.map((d) => d.name.toLowerCase());
    const ids = districts.map((d) => d.id.toLowerCase());

    expect(names.some((n) => n.includes('hall of fame'))).toBe(false);
    expect(ids.some((id) => id.includes('hof'))).toBe(false);
    expect(names.some((n) => n.includes('central market'))).toBe(false);
    expect(ids.some((id) => id.includes('market'))).toBe(false);
  });

  it('6. West Lawn is not rendered as a district (it is the post-master-cipher final objective destination, never a player district)', () => {
    const districts = getDistrictActivity('canton-weekend-1');
    const names = districts.map((d) => d.name.toLowerCase());
    const ids = districts.map((d) => d.id.toLowerCase());

    expect(names.some((n) => n.includes('west lawn'))).toBe(false);
    expect(ids.some((id) => id.includes('west lawn') || id.includes('west-lawn'))).toBe(false);
    expect(names.some((n) => n.includes('frankenstein'))).toBe(false);
  });

  it('7. activity maps to the correct canonical path without cross-contamination', () => {
    const eventId = 'evt-path-activity-test';

    // Register 5 Family players
    for (let i = 1; i <= 5; i++) {
      getOrCreateEventParticipation(eventId, `plr-family-${i}`, 'family');
    }

    // Register 2 Challenge players
    for (let i = 1; i <= 2; i++) {
      getOrCreateEventParticipation(eventId, `plr-challenge-${i}`, 'challenge');
    }

    // Register 1 Secret player
    getOrCreateEventParticipation(eventId, 'plr-secret-1', 'secret');

    // Create 3 active quests for Family
    for (let i = 1; i <= 3; i++) {
      createQuest({
        eventId,
        title: `Family Quest ${i}`,
        slug: `fam-q-${i}`,
        description: 'Family objective',
        instructions: 'Do family task',
        proofRequirement: 'Submit photo proof',
        pointValue: 100,
        difficulty: 'easy',
        category: 'exploration',
        verificationType: 'photo',
        isFlash: false,
        status: 'active',
        sortOrder: i,
        startingPath: 'family',
      });
    }

    // Create 1 active quest for Challenge
    createQuest({
      eventId,
      title: 'Challenge Quest 1',
      slug: 'chal-q-1',
      description: 'Challenge objective',
      instructions: 'Do challenge task',
      proofRequirement: 'Submit photo proof',
      pointValue: 100,
      difficulty: 'hard',
      category: 'puzzle',
      verificationType: 'photo',
      isFlash: false,
      status: 'active',
      sortOrder: 10,
      startingPath: 'challenge',
    });

    const districts = getDistrictActivity(eventId);
    expect(districts).toHaveLength(3);

    const family = districts.find((d) => d.path === 'family');
    const challenge = districts.find((d) => d.path === 'challenge');
    const secret = districts.find((d) => d.path === 'secret');

    // Family activity reads ONLY Family players (5) and Family quests (3)
    expect(family?.agentCount).toBe(5);
    expect(family?.activeQuestsCount).toBe(3);
    expect(family?.activityLevel).toBe('HIGH');

    // Challenge activity reads ONLY Challenge players (2) and Challenge quests (1)
    expect(challenge?.agentCount).toBe(2);
    expect(challenge?.activeQuestsCount).toBe(1);
    expect(challenge?.activityLevel).toBe('MODERATE');

    // Secret activity reads ONLY Secret players (1) and Secret quests (0)
    expect(secret?.agentCount).toBe(1);
    expect(secret?.activeQuestsCount).toBe(0);
    expect(secret?.activityLevel).toBe('QUIET');
  });

  it('8. Fair QR Hunt remains unchanged with its 4 fairground zones', () => {
    expect(isFairOperation('fair-qr-hunt')).toBe(true);
    expect(isFounderCipherOperation('fair-qr-hunt')).toBe(false);

    const fairDistricts = getDistrictActivity('fair-qr-hunt');
    expect(fairDistricts).toHaveLength(4);

    const fairNames = fairDistricts.map((d) => d.name);
    expect(fairNames).toContain('Grandstand & Track Area');
    expect(fairNames).toContain('Midway & Carnival Plaza');
    expect(fairNames).toContain('Exhibition & Agri Pavilion');
    expect(fairNames).toContain('South Gate & Food Row');

    // Does NOT contain Founder's Cipher path districts
    expect(fairNames.some((n) => n.includes('Arts District'))).toBe(false);
    expect(fairNames.some((n) => n.includes('Mother Goose Land'))).toBe(false);
    expect(fairNames.some((n) => n.includes('Monument Park'))).toBe(false);
  });

  it('9. event-specific district configuration cannot fall back to the legacy 4-district array', () => {
    const rootDir = process.cwd();
    const componentSource = fs.readFileSync(
      path.join(rootDir, 'components', 'spectator', 'DistrictActivityView.tsx'),
      'utf8'
    );

    // DistrictActivityView fallback MUST NOT contain legacy 4 districts
    expect(componentSource).not.toContain('Downtown Arts Corridor');
    expect(componentSource).not.toContain('Central Market District');
    expect(componentSource).not.toContain('McKinley Monument Zone');
    expect(componentSource).not.toContain('Hall of Fame Village Zone');

    // getDistrictActivity() output MUST NOT contain legacy districts
    const activeDistricts = getDistrictActivity('canton-weekend-1');
    const districtNames = activeDistricts.map((d) => d.name);
    expect(districtNames).not.toContain('Downtown Arts Corridor');
    expect(districtNames).not.toContain('Central Market District');
    expect(districtNames).not.toContain('McKinley Monument Zone');
    expect(districtNames).not.toContain('Hall of Fame Village Zone');
    expect(activeDistricts).toHaveLength(3);

    // Spectator engine district function MUST NOT contain legacy 4-district definitions
    const engineSource = fs.readFileSync(path.join(rootDir, 'lib', 'spectator-engine.ts'), 'utf8');
    expect(engineSource).not.toContain('Central Market District');
    expect(engineSource).not.toContain('McKinley Monument Zone');
    expect(engineSource).not.toContain('Hall of Fame Village Zone');
    expect(engineSource).not.toContain('dist-hof');

    // Default districts for Founder's Cipher has exactly 3 items
    const defaults = getDefaultDistrictsForEvent();
    expect(defaults).toHaveLength(3);
  });
});
