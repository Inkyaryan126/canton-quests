import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLAYER_CARD_LAYOUT,
  getCallsignFontScale,
} from '../lib/player-card-layout';
import { resetGameEngineStore } from '../lib/game-engine';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import PlayerCard from '../components/PlayerCard';
import fs from 'node:fs';
import path from 'node:path';

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

    it('verifies Chosen Path occupies its own original guide-measured slot, separate from Motto', () => {
      expect(PLAYER_CARD_LAYOUT.chosenPath.left).toBe('51.17%');
      expect(PLAYER_CARD_LAYOUT.chosenPath.top).toBe('26.95%');
      expect(PLAYER_CARD_LAYOUT.chosenPath.width).toBe('45.02%');
      expect(PLAYER_CARD_LAYOUT.chosenPath.height).toBe('5.27%');
    });

    it('verifies Motto occupies its own slot directly below Chosen Path, not the old combined footprint', () => {
      expect(PLAYER_CARD_LAYOUT.motto.left).toBe('51.27%');
      expect(PLAYER_CARD_LAYOUT.motto.top).toBe('34.51%');
      expect(PLAYER_CARD_LAYOUT.motto.width).toBe('44.92%');
      expect(PLAYER_CARD_LAYOUT.motto.height).toBe('5.14%');
    });

    it('Chosen Path and Motto boxes do not overlap vertically', () => {
      const pathTop = parseFloat(PLAYER_CARD_LAYOUT.chosenPath.top);
      const pathHeight = parseFloat(PLAYER_CARD_LAYOUT.chosenPath.height);
      const mottoTop = parseFloat(PLAYER_CARD_LAYOUT.motto.top);
      expect(mottoTop).toBeGreaterThanOrEqual(pathTop + pathHeight);
    });

    it('verifies the 5 Player Level fill areas are pixel-measured interiors of the artwork\'s already-baked-in segment bar, not new boxes', () => {
      // player_card.png already draws one continuous outlined bar with 4
      // internal divider ticks (5 visual cells) — these coordinates are the
      // interior of each cell, inset from the artwork's own border/divider
      // pixels, so a fill color never covers or redraws the existing outline.
      expect(PLAYER_CARD_LAYOUT.playerLevel.segments).toHaveLength(5);
      PLAYER_CARD_LAYOUT.playerLevel.segments.forEach((segment) => {
        expect(segment.top).toBe('44.92%');
        expect(segment.height).toBe('2.54%');
      });
      expect(PLAYER_CARD_LAYOUT.playerLevel.segments[0].left).toBe('5.66%');
      expect(PLAYER_CARD_LAYOUT.playerLevel.segments[4].left).toBe('41.99%');
    });

    it('never draws a border/outline on .cq-card-level-segment — the 5-segment bar and its dividers are already baked into player_card.png', () => {
      const cssSource = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
      const ruleMatch = cssSource.match(/\.cq-card-level-segment\s*\{([^}]*)\}/);
      expect(ruleMatch).not.toBeNull();
      expect(ruleMatch![1]).not.toMatch(/\bborder(?!-radius)/);
    });

    it('verifies Player Signal coordinates are unchanged', () => {
      expect(PLAYER_CARD_LAYOUT.signal.left).toBe('52.93%');
      expect(PLAYER_CARD_LAYOUT.signal.top).toBe('43.62%');
      expect(PLAYER_CARD_LAYOUT.signal.width).toBe('30.86%');
      expect(PLAYER_CARD_LAYOUT.signal.height).toBe('5.53%');
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

  describe('2. Callsign Dynamic Scaling Logic', () => {
    it('assigns correct callsign scaling classes across short, medium, real-user, and longest names', () => {
      expect(getCallsignFontScale('ACE')).toBe('cq-callsign-lg'); // 3 chars
      expect(getCallsignFontScale('CantonCipher')).toBe('cq-callsign-md'); // 12 chars
      expect(getCallsignFontScale('dustinsigley126')).toBe('cq-callsign-sm'); // 15 chars
      expect(getCallsignFontScale('iron_explorer_99')).toBe('cq-callsign-sm'); // 16 chars
      expect(getCallsignFontScale('SUPER_LONG_EXPLORER_CALLSIGN_99')).toBe('cq-callsign-xs'); // 31 chars
    });
  });

  describe('3. Component Rendering & Real Production Stress Case', () => {
    it('renders real user "dustinsigley126" cleanly with all artwork overlay elements, including a saved Chosen Path and Motto in separate slots', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(PlayerCard, {
          displayName: 'dustinsigley126',
          chosenPath: 'family',
          motto: 'Trust the process.',
          avatarImage: '/canton-quests/1.png',
          cropZoom: 1,
          cropX: 50,
          cropY: 50,
          totalXp: 1250,
          completedQuests: 5,
          prizeEntries: 3,
          cityRank: 1,
          participatedQuestCount: 3,
          memberSinceDate: 'AUG 21, 2026',
          playerCode: 'CQ-8821',
        })
      );

      // Verify master art background is rendered
      expect(html).toContain('player_card.png');

      // Verify Callsign rendered with single line scaling class
      expect(html).toContain('cq-card-callsign cq-callsign-sm');
      expect(html).toContain('dustinsigley126');

      // Verify Chosen Path is rendered uppercase, in its own slot
      expect(html).toContain('cq-card-chosen-path');
      expect(html).toContain('FAMILY');
      expect(html).not.toContain('>family<');

      // Verify Motto is rendered in its own slot, distinct from Chosen Path
      expect(html).toContain('cq-card-motto');
      expect(html).toContain('Trust the process.');
      // The motto text never appears inside the chosen-path element, and
      // vice versa — they are two separate DOM nodes, not one merged field.
      const chosenPathBlock = html.slice(html.indexOf('cq-card-chosen-path'), html.indexOf('cq-card-motto'));
      expect(chosenPathBlock).toContain('FAMILY');
      expect(chosenPathBlock).not.toContain('Trust the process.');

      // Verify Player Level segments: 3 of 5 filled, in order
      const segmentMatches = html.match(/cq-card-level-segment[^"]*/g) || [];
      expect(segmentMatches).toHaveLength(5);
      const filledCount = segmentMatches.filter((cls) => cls.includes('is-filled')).length;
      expect(filledCount).toBe(3);
      expect(segmentMatches[0]).toContain('is-filled');
      expect(segmentMatches[2]).toContain('is-filled');
      expect(segmentMatches[3]).not.toContain('is-filled');

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

    it('renders an empty Chosen Path and Motto without fabricating placeholder text, and 0 participated quests as 0 filled segments', () => {
      const badges = [
        { name: 'Day 1 Champion', iconPath: '/canton-quests/badges/day1.png' },
        { name: 'Family Pathfinder', iconPath: '/canton-quests/badges/family.png' },
      ];

      const html = ReactDOMServer.renderToString(
        React.createElement(PlayerCard, {
          displayName: 'Explorer',
          avatarImage: '/canton-quests/2.png',
          totalXp: 0,
          completedQuests: 0,
          prizeEntries: 0,
          cityRank: null,
          participatedQuestCount: 0,
          featuredBadges: badges,
        })
      );

      // No path chosen yet — the slot renders blank, never the motto text.
      expect(html).toContain('cq-card-chosen-path');
      const chosenPathBlock = html.slice(html.indexOf('cq-card-chosen-path'), html.indexOf('cq-card-motto'));
      expect(chosenPathBlock).not.toMatch(/<span>/);

      expect(html).toContain('cq-card-motto');
      // No quote marks rendered when motto is empty/absent
      expect(html).not.toMatch(/&quot;[^&]/);

      const segmentMatches = html.match(/cq-card-level-segment[^"]*/g) || [];
      expect(segmentMatches).toHaveLength(5);
      expect(segmentMatches.some((cls) => cls.includes('is-filled'))).toBe(false);

      expect(html.match(/cq-card-badge-slot/g)).toHaveLength(6);
      expect(html).toContain('day1.png');
      expect(html).toContain('family.png');
      expect(html).toContain('Unranked');
    });

    it('caps Player Level segments at 5 filled even when participation exceeds available segments (no overflow)', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(PlayerCard, {
          displayName: 'Veteran',
          avatarImage: '/canton-quests/3.png',
          totalXp: 5000,
          completedQuests: 20,
          prizeEntries: 10,
          cityRank: 1,
          participatedQuestCount: 40,
        })
      );

      const segmentMatches = html.match(/cq-card-level-segment[^"]*/g) || [];
      expect(segmentMatches).toHaveLength(5);
      expect(segmentMatches.every((cls) => cls.includes('is-filled'))).toBe(true);
    });
  });
});
