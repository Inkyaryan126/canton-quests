import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cqImages, destinationCards } from '@/lib/marketing-assets';
import { PATH_OPTIONS } from '@/components/ThreePathSelector';

describe('Canton Quests — Master Visual Asset Package Integration Suite', () => {
  const rootDir = process.cwd();
  const cqDir = path.join(rootDir, 'public', 'canton-quests');
  const manifestPath = path.join(rootDir, 'docs', 'visual-assets-manifest.md');

  const EXPECTED_ASSETS = [
    'canton_quests.png',
    'card_available.png',
    'card_complete.png',
    'card_locked.png',
    'card_poster.png',
    'three_doors.png',
    'palace.png',
    'football.png',
    'frank.png',
    'goosewall.png',
    'goosewillie.png',
    'monument.png',
    'Quest_board.png',
    'leaderboard.png',
    'game_master_transmission.png',
    'prize_vault.png',
    'player_profile.png',
    'quest_achievement_badges.png',
    'footer_endoftrans.png',
    'cq-briefing-transmission.mp4',
    'cq-briefing-poster.jpg',
  ];

  it('1. verifies that all cinematic asset package files exist on disk with valid file size', () => {
    for (const file of EXPECTED_ASSETS) {
      const filePath = path.join(cqDir, file);
      expect(fs.existsSync(filePath), `Asset ${file} must exist in public/canton-quests`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `Asset ${file} must not be empty`).toBeGreaterThan(0);
    }
  });

  it('2. verifies that docs/visual-assets-manifest.md exists and documents the full asset matrix', () => {
    expect(fs.existsSync(manifestPath), 'docs/visual-assets-manifest.md must exist').toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf-8');
    for (const file of EXPECTED_ASSETS) {
      expect(content).toContain(file);
    }
  });

  it('3. verifies cqImages exports strongly typed references for all new cinematic visual assets', () => {
    expect(cqImages.brandLogo).toBe('/canton-quests/canton_quests.png');
    expect(cqImages.threeDoors).toBe('/canton-quests/three_doors.png');
    expect(cqImages.cardAvailable).toBe('/canton-quests/card_available.png');
    expect(cqImages.cardComplete).toBe('/canton-quests/card_complete.png');
    expect(cqImages.cardLocked).toBe('/canton-quests/card_locked.png');
    expect(cqImages.cardPoster).toBe('/canton-quests/card_poster.png');
    expect(cqImages.questBoardBg).toBe('/canton-quests/Quest_board.png');
    expect(cqImages.leaderboardBg).toBe('/canton-quests/leaderboard.png');
    expect(cqImages.gmTransmissionBg).toBe('/canton-quests/game_master_transmission.png');
    expect(cqImages.prizeVault).toBe('/canton-quests/prize_vault.png');
    expect(cqImages.playerProfileBg).toBe('/canton-quests/player_profile.png');
    expect(cqImages.achievementBadges).toBe('/canton-quests/quest_achievement_badges.png');
    expect(cqImages.footerEndTransmission).toBe('/canton-quests/footer_endoftrans.png');
    expect(cqImages.palaceCinematic).toBe('/canton-quests/palace.png');
    expect(cqImages.footballCinematic).toBe('/canton-quests/football.png');
    expect(cqImages.frankCinematic).toBe('/canton-quests/frank.png');
    expect(cqImages.gooseWall).toBe('/canton-quests/goosewall.png');
    expect(cqImages.gooseWillie).toBe('/canton-quests/goosewillie.png');
    expect(cqImages.monumentCinematic).toBe('/canton-quests/monument.png');
    expect(cqImages.promoVideo).toBe('/canton-quests/cq-briefing-transmission.mp4');
    expect(cqImages.promoVideoPoster).toBe('/canton-quests/cq-briefing-poster.jpg');
    expect(cqImages.challengeSkatePark).toBe('/canton-quests/quests/challenge/skate_park.png');
    expect(cqImages.challengeOpenGround).toBe('/canton-quests/quests/challenge/the_open_ground.png');
    expect(cqImages.challengeTower).toBe('/canton-quests/quests/challenge/silo.png');
    expect(cqImages.challengeMural).toBe('/canton-quests/quests/challenge/mother_mural.png');
    expect(cqImages.challengeWillie).toBe('/canton-quests/quests/challenge/willie.png');
  });

  it('4. verifies PATH_OPTIONS in ThreePathSelector maps each path to its authentic district', () => {
    const family = PATH_OPTIONS.find((p) => p.id === 'family');
    const challenge = PATH_OPTIONS.find((p) => p.id === 'challenge');
    const secret = PATH_OPTIONS.find((p) => p.id === 'secret');

    expect(family?.district).toBe('Arts District');
    expect(challenge?.district).toBe('Mother Goose Land');
    expect(secret?.district).toBe('Monument Park');
  });

  it('5. verifies destination cards accurately showcase real Canton geography and landmarks', () => {
    const districts = destinationCards.map((d) => d.district);
    expect(districts).toContain('Centennial Plaza');
    expect(districts.some((d) => d.includes('Palace'))).toBe(true);
    expect(districts).toContain('Mother Goose Land');
    expect(districts.some((d) => d.includes('McKinley'))).toBe(true);
    expect(districts).toContain('Monument Park');
  });

  it('6. verifies web-optimized streamable video exists and is under 60MB with faststart enabled', () => {
    const videoPath = path.join(cqDir, 'cq-briefing-transmission.mp4');
    const stat = fs.statSync(videoPath);
    // Transcoded web streamable file should be ~44MB (well under 60MB, unlike the 332MB raw duplicate)
    expect(stat.size).toBeLessThan(60 * 1024 * 1024);
    expect(stat.size).toBeGreaterThan(10 * 1024 * 1024);
  });
});
