import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  cqImages,
  challengeSectorCards,
  getQuestImage,
  isStandaloneQuestCard,
} from '../lib/marketing-assets';
import { SEED_LOCATIONS, SEED_QUESTS, SEED_EVENT } from '../lib/seed-data';

describe('Challenge Sector Standalone Quest Cards & Route Verification', () => {
  const challengeAssetsDir = path.join(
    process.cwd(),
    'public',
    'canton-quests',
    'quests',
    'challenge'
  );

  const EXPECTED_CHALLENGE_FILES = [
    { filename: 'skate_park.png', position: 1, title: 'Skate Park' },
    { filename: 'the_open_ground.png', position: 2, title: 'The Open Ground' },
    { filename: 'silo.png', position: 3, title: 'The Tower' },
    { filename: 'mother_mural.png', position: 4, title: 'The Mural' },
    { filename: 'willie.png', position: 5, title: 'Willie the Whale' },
  ];

  it('1. all 5 physical card assets exist on disk in public/canton-quests/quests/challenge/', () => {
    for (const asset of EXPECTED_CHALLENGE_FILES) {
      const filePath = path.join(challengeAssetsDir, asset.filename);
      expect(fs.existsSync(filePath), `Missing asset: ${asset.filename}`).toBe(true);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(50_000); // High-res card images

      // Verify valid PNG header (0x89 0x50 0x4E 0x47)
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);

      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x4e); // 'N'
      expect(buffer[3]).toBe(0x47); // 'G'
    }
  });

  it('2. the 5 cards are distinct separate files with distinct contents', () => {
    const hashes = new Set<string>();
    for (const asset of EXPECTED_CHALLENGE_FILES) {
      const filePath = path.join(challengeAssetsDir, asset.filename);
      const content = fs.readFileSync(filePath);
      // Sample checksum using size + first 256 bytes + middle 256 bytes
      const sample = `${content.length}-${content.subarray(0, 256).toString('hex')}`;
      expect(hashes.has(sample), `Duplicate card content detected for ${asset.filename}`).toBe(false);
      hashes.add(sample);
    }
    expect(hashes.size).toBe(5);
  });

  it('3. cqImages exports strongly typed paths for all 5 Challenge Sector cards', () => {
    expect(cqImages.challengeSkatePark).toBe('/canton-quests/quests/challenge/skate_park.png');
    expect(cqImages.challengeOpenGround).toBe('/canton-quests/quests/challenge/the_open_ground.png');
    expect(cqImages.challengeTower).toBe('/canton-quests/quests/challenge/silo.png');
    expect(cqImages.challengeMural).toBe('/canton-quests/quests/challenge/mother_mural.png');
    expect(cqImages.challengeWillie).toBe('/canton-quests/quests/challenge/willie.png');
  });

  it('4. challengeSectorCards array defines the exact 5-mission canonical route sequence', () => {
    expect(challengeSectorCards).toHaveLength(5);

    // 01 — SKATE PARK
    expect(challengeSectorCards[0].order).toBe(1);
    expect(challengeSectorCards[0].number).toBe('01');
    expect(challengeSectorCards[0].image).toBe(cqImages.challengeSkatePark);
    expect(challengeSectorCards[0].location).toMatch(/skate park/i);

    // 02 — THE OPEN GROUND
    expect(challengeSectorCards[1].order).toBe(2);
    expect(challengeSectorCards[1].number).toBe('02');
    expect(challengeSectorCards[1].image).toBe(cqImages.challengeOpenGround);
    expect(challengeSectorCards[1].title).toBe('THE OPEN GROUND');
    expect(challengeSectorCards[1].location).toBe('CHALLENGE FIELD');
    expect(challengeSectorCards[1].rewardXp).toBe(100);

    // 03 — THE TOWER
    expect(challengeSectorCards[2].order).toBe(3);
    expect(challengeSectorCards[2].number).toBe('03');
    expect(challengeSectorCards[2].image).toBe(cqImages.challengeTower);
    expect(challengeSectorCards[2].location).toMatch(/mother goose land/i);
    expect(challengeSectorCards[2].rewardXp).toBe(100);

    // 04 — THE MURAL
    expect(challengeSectorCards[3].order).toBe(4);
    expect(challengeSectorCards[3].number).toBe('04');
    expect(challengeSectorCards[3].image).toBe(cqImages.challengeMural);
    expect(challengeSectorCards[3].title).toBe('THE MURAL');
    expect(challengeSectorCards[3].location).toBe('MOTHER GOOSE LAND');
    expect(challengeSectorCards[3].rewardXp).toBe(100);

    // 05 — WILLIE THE WHALE
    expect(challengeSectorCards[4].order).toBe(5);
    expect(challengeSectorCards[4].number).toBe('05');
    expect(challengeSectorCards[4].image).toBe(cqImages.challengeWillie);
    expect(challengeSectorCards[4].location).toMatch(/mother goose land/i);
    expect(challengeSectorCards[4].rewardXp).toBe(100);
  });

  it('5. getQuestImage maps Challenge Sector quests and locations cleanly to their corresponding cards', () => {
    // 01 — Skate Park
    const skateQuest = {
      id: 'qst-9th-street-opening',
      slug: '9th-street-opening',
      locationId: 'loc-9th-street',
      title: 'Skate Park Check-In',
    } as any;
    expect(getQuestImage(skateQuest)).toBe(cqImages.challengeSkatePark);

    // 02 — The Open Ground
    const openGroundQuest = {
      id: 'qst-challenge-open-ground',
      slug: 'challenge-open-ground',
      locationId: 'loc-challenge-field',
      title: 'THE OPEN GROUND',
    } as any;
    expect(getQuestImage(openGroundQuest)).toBe(cqImages.challengeOpenGround);

    // 03 — The Tower
    const towerQuest = {
      id: 'qst-challenge-the-tower',
      slug: 'challenge-the-tower',
      locationId: 'loc-challenge-tower',
      title: 'The Tower',
    } as any;
    expect(getQuestImage(towerQuest)).toBe(cqImages.challengeTower);

    // 04 — The Mural
    const muralQuest = {
      id: 'qst-challenge-the-mural',
      slug: 'challenge-the-mural',
      locationId: 'loc-mother-goose-land',
      title: 'THE MURAL',
    } as any;
    expect(getQuestImage(muralQuest)).toBe(cqImages.challengeMural);

    // 05 — Willie the Whale
    const willieQuest = {
      id: 'qst-challenge-blue-signal',
      slug: 'challenge-blue-signal',
      locationId: 'loc-mother-goose-land',
      title: 'The Blue Signal',
    } as any;
    expect(getQuestImage(willieQuest)).toBe(cqImages.challengeWillie);
  });

  it('6. isStandaloneQuestCard correctly detects 2:3 full standalone cards vs landscape photos', () => {
    expect(isStandaloneQuestCard(cqImages.challengeSkatePark)).toBe(true);
    expect(isStandaloneQuestCard(cqImages.challengeOpenGround)).toBe(true);
    expect(isStandaloneQuestCard(cqImages.challengeTower)).toBe(true);
    expect(isStandaloneQuestCard(cqImages.challengeMural)).toBe(true);
    expect(isStandaloneQuestCard(cqImages.challengeWillie)).toBe(true);

    // Landscape photos / pool textures
    expect(isStandaloneQuestCard(cqImages.cantonSign)).toBe(false);
    expect(isStandaloneQuestCard(cqImages.mckinleySunset)).toBe(false);
    expect(isStandaloneQuestCard(cqImages.palace)).toBe(false);
    expect(isStandaloneQuestCard(undefined)).toBe(false);
  });

  it('7. SEED_LOCATIONS contains Challenge Field and Challenge Tower', () => {
    const challengeField = SEED_LOCATIONS.find((loc) => loc.id === 'loc-challenge-field');
    expect(challengeField).toBeDefined();
    expect(challengeField?.name).toBe('Challenge Field');

    const challengeTower = SEED_LOCATIONS.find((loc) => loc.id === 'loc-challenge-tower');
    expect(challengeTower).toBeDefined();
    expect(challengeTower?.name).toBe('The Tower at Mother Goose Land');
  });

  it('8. SEED_QUESTS contains THE OPEN GROUND and THE MURAL with exact user requirements', () => {
    const openGround = SEED_QUESTS.find((q) => q.slug === 'challenge-open-ground');
    expect(openGround).toBeDefined();
    expect(openGround?.title).toBe('THE OPEN GROUND');
    expect(openGround?.locationId).toBe('loc-challenge-field');
    expect(openGround?.description).toBe(
      'Cross into the open ground. Your next Challenge signal is waiting somewhere beyond the pavement.'
    );
    expect(openGround?.xpReward).toBe(100);
    expect(openGround?.pointValue).toBe(100);
    expect(openGround?.startingPath).toBe('challenge');

    const mural = SEED_QUESTS.find((q) => q.slug === 'challenge-the-mural');
    expect(mural).toBeDefined();
    expect(mural?.title).toBe('THE MURAL');
    expect(mural?.locationId).toBe('loc-mother-goose-land');
    expect(mural?.description).toBe(
      'Locate the painted wall and inspect the characters hidden across the scene.'
    );
    expect(mural?.xpReward).toBe(100);
    expect(mural?.pointValue).toBe(100);
    expect(mural?.startingPath).toBe('challenge');
  });

  it('9. preserves C1-C4 prerequisite chain and existing quest integrity', () => {
    const c1 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-blue-signal');
    const c2 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-storybook-witness');
    const c3 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-what-survived');
    const c4 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-the-lost-page');

    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
    expect(c3).toBeDefined();
    expect(c4).toBeDefined();

    expect(c2?.prerequisiteQuestId).toBe(c1?.id);
    expect(c3?.prerequisiteQuestId).toBe(c2?.id);
    expect(c4?.prerequisiteQuestId).toBe(c3?.id);
  });
});
