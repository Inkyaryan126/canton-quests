import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLAYER_CARD_LAYOUT,
  getCallsignFontScale,
  getDistrictFontScale,
} from '../lib/player-card-layout';
import { resetGameEngineStore } from '../lib/game-engine';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import PlayerCard from '../components/PlayerCard';

describe('Canton Quests — Player Card Guide Calibration & Layout Verification', () => {
  beforeEach(() => {
    resetGameEngineStore();
  });

  describe('1. Exact Guide Coordinate Verification (Derived from player_card_guide.png)', () => {
    it('verifies intrinsic aspect ratio is strictly 2:3 (1024 x 1536)', () => {
      expect(PLAYER_CARD_LAYOUT.dimensions.naturalWidth).toBe(1024);
      expect(PLAYER_CARD_LAYOUT.dimensions.naturalHeight).toBe(1536);
      expect(PLAYER_CARD_LAYOUT.dimensions.aspectRatio).toBe('2 / 3');
    });

    it('verifies exact avatar circular opening coordinates', () => {
      expect(PLAYER_CARD_LAYOUT.avatar.left).toBe('3.61%');
      expect(PLAYER_CARD_LAYOUT.avatar.top).toBe('12.24%');
      expect(PLAYER_CARD_LAYOUT.avatar.width).toBe('36.23%');
      expect(PLAYER_CARD_LAYOUT.avatar.height).toBe('24.48%');
    });

    it('verifies exact callsign field coordinates', () => {
      expect(PLAYER_CARD_LAYOUT.callsign.left).toBe('42.97%');
      expect(PLAYER_CARD_LAYOUT.callsign.top).toBe('14.91%');
      expect(PLAYER_CARD_LAYOUT.callsign.width).toBe('53.32%');
      expect(PLAYER_CARD_LAYOUT.callsign.height).toBe('8.59%');
    });

    it('verifies exact starting path and district coordinates', () => {
      expect(PLAYER_CARD_LAYOUT.path.left).toBe('51.17%');
      expect(PLAYER_CARD_LAYOUT.path.top).toBe('26.95%');
      expect(PLAYER_CARD_LAYOUT.path.width).toBe('45.02%');
      expect(PLAYER_CARD_LAYOUT.path.height).toBe('5.27%');

      expect(PLAYER_CARD_LAYOUT.district.left).toBe('51.27%');
      expect(PLAYER_CARD_LAYOUT.district.top).toBe('34.51%');
      expect(PLAYER_CARD_LAYOUT.district.width).toBe('44.92%');
      expect(PLAYER_CARD_LAYOUT.district.height).toBe('5.14%');
    });

    it('verifies exact numeric 4-stat row coordinates', () => {
      expect(PLAYER_CARD_LAYOUT.totalXp.left).toBe('12.21%');
      expect(PLAYER_CARD_LAYOUT.totalXp.top).toBe('52.28%');
      expect(PLAYER_CARD_LAYOUT.totalXp.width).toBe('14.36%');

      expect(PLAYER_CARD_LAYOUT.questsComplete.left).toBe('34.67%');
      expect(PLAYER_CARD_LAYOUT.questsComplete.top).toBe('52.28%');
      expect(PLAYER_CARD_LAYOUT.questsComplete.width).toBe('14.45%');

      expect(PLAYER_CARD_LAYOUT.prizeEntries.left).toBe('58.20%');
      expect(PLAYER_CARD_LAYOUT.prizeEntries.top).toBe('52.28%');
      expect(PLAYER_CARD_LAYOUT.prizeEntries.width).toBe('14.55%');

      expect(PLAYER_CARD_LAYOUT.cityRank.left).toBe('82.03%');
      expect(PLAYER_CARD_LAYOUT.cityRank.top).toBe('52.21%');
      expect(PLAYER_CARD_LAYOUT.cityRank.width).toBe('14.55%');
    });

    it('verifies all 6 individual circular badge slot coordinates', () => {
      expect(PLAYER_CARD_LAYOUT.badges).toHaveLength(6);
      expect(PLAYER_CARD_LAYOUT.badges[0].left).toBe('4.49%');
      expect(PLAYER_CARD_LAYOUT.badges[1].left).toBe('19.43%');
      expect(PLAYER_CARD_LAYOUT.badges[2].left).toBe('35.16%');
      expect(PLAYER_CARD_LAYOUT.badges[3].left).toBe('50.59%');
      expect(PLAYER_CARD_LAYOUT.badges[4].left).toBe('66.21%');
      expect(PLAYER_CARD_LAYOUT.badges[5].left).toBe('81.54%');
    });

    it('verifies bottom metadata coordinates (Member Since, ID Code, Clearance)', () => {
      expect(PLAYER_CARD_LAYOUT.memberSince.left).toBe('9.77%');
      expect(PLAYER_CARD_LAYOUT.memberSince.top).toBe('76.43%');

      expect(PLAYER_CARD_LAYOUT.playerIdCode.left).toBe('9.77%');
      expect(PLAYER_CARD_LAYOUT.playerIdCode.top).toBe('82.23%');

      expect(PLAYER_CARD_LAYOUT.clearanceLevel.left).toBe('9.67%');
      expect(PLAYER_CARD_LAYOUT.clearanceLevel.top).toBe('88.02%');
    });
  });

  describe('2. Callsign & District Dynamic Scaling Logic', () => {
    it('assigns correct callsign scaling classes across short, medium, real-user, and longest names', () => {
      expect(getCallsignFontScale('ACE')).toBe('cq-callsign-lg'); // 3 chars
      expect(getCallsignFontScale('CantonCipher')).toBe('cq-callsign-md'); // 12 chars
      expect(getCallsignFontScale('dustinsigley126')).toBe('cq-callsign-sm'); // 15 chars
      expect(getCallsignFontScale('iron_explorer_99')).toBe('cq-callsign-sm'); // 16 chars
      expect(getCallsignFontScale('SUPER_LONG_EXPLORER_CALLSIGN_99')).toBe('cq-callsign-xs'); // 31 chars
    });

    it('assigns correct district scaling classes for all 3 starter paths and custom regions', () => {
      expect(getDistrictFontScale('Arts District')).toBe('cq-district-lg'); // Family (13 chars)
      expect(getDistrictFontScale('9th St Skate Park area')).toBe('cq-district-md'); // Challenge (22 chars)
      expect(getDistrictFontScale('West Lawn Cemetery / McKinley area')).toBe('cq-district-sm'); // Secret (34 chars)
    });
  });

  describe('3. Component Rendering & Real Production Stress Case', () => {
    it('renders real user "dustinsigley126" cleanly with all artwork overlay elements', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(PlayerCard, {
          displayName: 'dustinsigley126',
          startingPathLabel: 'CHALLENGE',
          startingDistrictName: '9th St Skate Park area',
          avatarImage: '/canton-quests/1.png',
          cropZoom: 1,
          cropX: 50,
          cropY: 50,
          totalXp: 1250,
          completedQuests: 5,
          prizeEntries: 3,
          cityRank: 1,
          memberSinceDate: 'AUG 21, 2026',
          playerCode: 'CQ-8821',
        })
      );

      // Verify master art background is rendered
      expect(html).toContain('player_card.png');

      // Verify Callsign rendered with single line scaling class
      expect(html).toContain('cq-card-callsign cq-callsign-sm');
      expect(html).toContain('dustinsigley126');

      // Verify starting path & district
      expect(html).toContain('cq-card-path');
      expect(html).toContain('CHALLENGE');
      expect(html).toContain('cq-card-district cq-district-md');
      expect(html).toContain('9th St Skate Park area');

      // Verify numeric stat row
      expect(html).toContain('1,250');
      expect(html).toContain('5');
      expect(html).toContain('3');
      expect(html).toContain('#1');

      // Verify bottom metadata
      expect(html).toContain('AUG 21, 2026');
      expect(html).toContain('CQ-8821');

      // Verify all 6 badge slots are rendered
      expect(html.match(/cq-card-badge-slot/g)).toHaveLength(6);
    });

    it('renders varying badge counts (0, 3, 6) preserving empty artwork rings', () => {
      const badges = [
        { name: 'Day 1 Champion', iconPath: '/canton-quests/badges/day1.png' },
        { name: 'Family Pathfinder', iconPath: '/canton-quests/badges/family.png' },
      ];

      const html = ReactDOMServer.renderToString(
        React.createElement(PlayerCard, {
          displayName: 'Explorer',
          startingPathLabel: 'FAMILY',
          startingDistrictName: 'Arts District',
          avatarImage: '/canton-quests/2.png',
          totalXp: 0,
          completedQuests: 0,
          prizeEntries: 0,
          cityRank: null,
          featuredBadges: badges,
        })
      );

      expect(html.match(/cq-card-badge-slot/g)).toHaveLength(6);
      expect(html).toContain('day1.png');
      expect(html).toContain('family.png');
      expect(html).toContain('Unranked');
    });
  });
});
