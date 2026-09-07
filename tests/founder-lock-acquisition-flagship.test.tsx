import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

(globalThis as any).React = React;

import ThreeLocksFragmentEffect from '../components/game-effects/ThreeLocksFragmentEffect';
import {
  FOUNDER_LOCK_DEFINITIONS,
  FOUNDER_LOCK_LIST,
  getFounderLockDefinition,
  getFounderLockByCollectibleId,
  getFounderLockByPath,
  evaluateThreeLocksStatus,
} from '../lib/founders-cipher';
import { DOOR_HOTSPOTS, PATH_OPTIONS } from '../components/ThreePathSelector';
import ThreePathSelector from '../components/ThreePathSelector';
import FounderCipherShell from '../components/FounderCipherShell';
import { ThreeLocksFragmentMoment, ThreeLocksCompleteMoment } from '../lib/game-effects';

describe('Phase 3 Flagship — Founder Lock Acquisition (THE MARK / THE CODE / THE WORD)', () => {
  describe('Founder Lock Definitions & Canon', () => {
    it('defines THE MARK with Monument Park / Secret Path lineage', () => {
      const mark = FOUNDER_LOCK_DEFINITIONS.mark;
      expect(mark.romanNumeral).toBe('I');
      expect(mark.name).toBe('THE MARK');
      expect(mark.collectibleId).toBe('col-founder-mark');
      expect(mark.associatedPath).toBe('secret');
      expect(mark.districtName).toBe('Monument Park');
      expect(mark.hexColor).toBe('#a855f7'); // Violet
      expect(mark.reticleVariant).toBe('cryptic');
      expect(mark.particleMode).toBe('cryptic-glyphs');
      expect(mark.relicName).toBe('Granite Seal Matrix');
      expect(mark.inscription).toBe('THE DEAD KEEP IT AT WEST LAWN');
    });

    it('defines THE CODE with Mother Goose Land / Challenge Path lineage', () => {
      const code = FOUNDER_LOCK_DEFINITIONS.code;
      expect(code.romanNumeral).toBe('II');
      expect(code.name).toBe('THE CODE');
      expect(code.collectibleId).toBe('col-founder-code');
      expect(code.associatedPath).toBe('challenge');
      expect(code.districtName).toBe('Mother Goose Land');
      expect(code.hexColor).toBe('#ef4444'); // Crimson
      expect(code.reticleVariant).toBe('kinetic');
      expect(code.particleMode).toBe('kinetic-streaks');
      expect(code.relicName).toBe('Brass Tumbler Cylinder');
      expect(code.inscription).toBe('THE WORLD GAVE A MONSTER HIS NAME');
    });

    it('defines THE WORD with Arts District / Family Path lineage', () => {
      const word = FOUNDER_LOCK_DEFINITIONS.word;
      expect(word.romanNumeral).toBe('III');
      expect(word.name).toBe('THE WORD');
      expect(word.collectibleId).toBe('col-founder-word');
      expect(word.associatedPath).toBe('family');
      expect(word.districtName).toBe('Arts District');
      expect(word.hexColor).toBe('#f59e0b'); // Amber
      expect(word.reticleVariant).toBe('compass');
      expect(word.particleMode).toBe('gold-embers');
      expect(word.relicName).toBe('Harmonic Signal Core');
      expect(word.inscription).toBe('A NAME OUTLIVES THE MAN');
    });

    it('retrieves lock definition by collectible ID and by path', () => {
      expect(getFounderLockByCollectibleId('col-founder-mark')?.key).toBe('mark');
      expect(getFounderLockByCollectibleId('col-founder-code')?.key).toBe('code');
      expect(getFounderLockByCollectibleId('col-founder-word')?.key).toBe('word');

      expect(getFounderLockByPath('secret')?.key).toBe('mark');
      expect(getFounderLockByPath('challenge')?.key).toBe('code');
      expect(getFounderLockByPath('family')?.key).toBe('word');
    });

    it('evaluates three locks status accurately for all ownership combinations', () => {
      expect(evaluateThreeLocksStatus([])).toEqual({
        mark: false,
        code: false,
        word: false,
        count: 0,
        allOwned: false,
      });

      expect(evaluateThreeLocksStatus(['col-founder-mark'])).toEqual({
        mark: true,
        code: false,
        word: false,
        count: 1,
        allOwned: false,
      });

      expect(evaluateThreeLocksStatus(['col-founder-mark', 'col-founder-code'])).toEqual({
        mark: true,
        code: true,
        word: false,
        count: 2,
        allOwned: false,
      });

      expect(evaluateThreeLocksStatus(['col-founder-mark', 'col-founder-code', 'col-founder-word'])).toEqual({
        mark: true,
        code: true,
        word: true,
        count: 3,
        allOwned: true,
      });
    });
  });

  describe('ThreeLocksFragmentEffect Visual Character & Atmosphere', () => {
    it('renders THE MARK with distinct austere monumental character and inscription', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'mark',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE MARK',
        locksOwned: { mark: true, code: false, word: false },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={true} // renders stage="seated" immediately
        />
      );

      expect(html).toContain('THE MARK');
      expect(html).toContain('LOCK I');
      expect(html).toContain('MONUMENT PARK');
      expect(html).toContain('Granite Seal Matrix');
      expect(html).toContain('THE DEAD KEEP IT AT WEST LAWN');
      expect(html).toContain('1 OF 3 ENGAGED');
    });

    it('renders THE CODE with distinct kinetic mechanical character and inscription', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'code',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE CODE',
        locksOwned: { mark: false, code: true, word: false },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={true}
        />
      );

      expect(html).toContain('THE CODE');
      expect(html).toContain('LOCK II');
      expect(html).toContain('MOTHER GOOSE LAND');
      expect(html).toContain('Brass Tumbler Cylinder');
      expect(html).toContain('THE WORLD GAVE A MONSTER HIS NAME');
      expect(html).toContain('1 OF 3 ENGAGED');
    });

    it('renders THE WORD with distinct civic harmonic character and inscription', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'word',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE WORD',
        locksOwned: { mark: true, code: false, word: true },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={true}
        />
      );

      expect(html).toContain('THE WORD');
      expect(html).toContain('LOCK III');
      expect(html).toContain('ARTS DISTRICT');
      expect(html).toContain('Harmonic Signal Core');
      expect(html).toContain('A NAME OUTLIVES THE MAN');
      expect(html).toContain('2 OF 3 ENGAGED');
    });
  });

  describe('Two-Stage Acquisition Ceremony & Receptacle Tray', () => {
    it('renders Stage 1 authenticating state with scanning telemetry when reducedMotion is false', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'mark',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE MARK',
        locksOwned: { mark: true, code: false, word: false },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={false}
        />
      );

      expect(html).toContain('AUTHENTICATING RELIC...');
      expect(html).toContain('RELIC I // MONUMENT PARK ARCHIVE // THE STONE STAIR CIPHER');
    });

    it('renders the three-slot physical receptacle tray indicating newly seated vs standby slots', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'code',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE CODE',
        locksOwned: { mark: true, code: true, word: false },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={true}
        />
      );

      // All 3 slot headers are present
      expect(html).toContain('I');
      expect(html).toContain('II');
      expect(html).toContain('III');

      // Check slot status labels
      expect(html).toContain('SECURED'); // Mark was already owned
      expect(html).toContain('SEATED'); // Code was just seated
      expect(html).toContain('STANDBY'); // Word is still standby
      expect(html).toContain('2 OF 3 ENGAGED');
    });

    it('renders the convergence celebration when all three locks are assembled', () => {
      const completeMoment: ThreeLocksCompleteMoment = {
        type: 'three-locks-complete',
        headline: 'FOUNDER RECEPTACLE ASSEMBLED',
        primaryText: 'THREE LOCKS COMPLETE',
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={completeMoment}
          onDismiss={() => {}}
          reducedMotion={true}
        />
      );

      expect(html).toContain('THREE LOCKS COMPLETE');
      expect(html).toContain('CONVERGENCE ACHIEVED');
      expect(html).toContain('3 OF 3 FOUNDER LOCKS ASSEMBLED');
      expect(html).toContain('PROCEED TO MISSION CONTROL');
      expect(html).toContain('THE TRUTH CONVERGES WHERE THREE PATHS MEET');
      expect(html).toContain('3 OF 3 CONVERGED');
    });

    it('enforces accessibility standards (dialog role, aria-labelledby, min 48px touch target)', () => {
      const moment: ThreeLocksFragmentMoment = {
        type: 'three-locks-fragment',
        fragment: 'mark',
        headline: 'FOUNDER LOCK ACQUIRED',
        primaryText: 'THE MARK',
        locksOwned: { mark: true, code: false, word: false },
      };

      const html = renderToStaticMarkup(
        <ThreeLocksFragmentEffect
          moment={moment}
          onDismiss={() => {}}
          reducedMotion={true}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="cq-founder-lock-heading"');
      expect(html).toContain('aria-describedby="cq-founder-lock-desc"');
      expect(html).toContain('min-height: 48px');
    });
  });

  describe('Integration with ThreePathSelector & FounderCipherShell', () => {
    it('DOOR_HOTSPOTS maps each path door to its affiliated Founder Lock lineage', () => {
      const challenge = DOOR_HOTSPOTS.find((d) => d.id === 'challenge');
      const family = DOOR_HOTSPOTS.find((d) => d.id === 'family');
      const secret = DOOR_HOTSPOTS.find((d) => d.id === 'secret');

      expect(challenge?.founderLockBadge).toBe('Lock II · THE CODE');
      expect(challenge?.founderLockKey).toBe('code');

      expect(family?.founderLockBadge).toBe('Lock III · THE WORD');
      expect(family?.founderLockKey).toBe('word');

      expect(secret?.founderLockBadge).toBe('Lock I · THE MARK');
      expect(secret?.founderLockKey).toBe('mark');
    });

    it('ThreePathSelector renders Founder Lock badges on door pills', () => {
      const html = renderToStaticMarkup(<ThreePathSelector />);
      expect(html).toContain('Lock II · THE CODE');
      expect(html).toContain('Lock III · THE WORD');
      expect(html).toContain('Lock I · THE MARK');
      expect(html).toContain('cq-door-pill-lock');
    });

    it('FounderCipherShell renders the Founder Locks overview card and door affiliations', () => {
      const html = renderToStaticMarkup(
        <FounderCipherShell
          event={null}
          authenticatedPlayer={null}
          stage="upcoming"
          countdown={{ label: 'STARTS IN', value: '4 DAYS', subtext: 'SEPT 11' }}
        />
      );

      expect(html).toContain('Three Locks: The Mark · The Code · The Word');
      expect(html).toContain('3 AUTHORIZATION KEYS → 1 MASTER CIPHER CONVERGENCE');
      expect(html).toContain('I. THE MARK');
      expect(html).toContain('II. THE CODE');
      expect(html).toContain('III. THE WORD');
      expect(html).toContain('THE DEAD KEEP IT AT WEST LAWN');
      expect(html).toContain('THE WORLD GAVE A MONSTER HIS NAME');
      expect(html).toContain('A NAME OUTLIVES THE MAN');
    });
  });

  describe('Zero-Tailwind Rule 21 Enforcement', () => {
    it('ensures ThreeLocksFragmentEffect uses only scoped CSS / inline styles and zero prohibited Tailwind classes', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/ThreeLocksFragmentEffect.tsx'),
        'utf8'
      );

      // Check for common forbidden utility class patterns in JSX className attributes
      const forbiddenPatterns = [
        /\bclassName="[^"]*\b(w-\d+|h-\d+|rounded-3xl|bg-black\/90|max-w-md|p-4|p-6)\b[^"]*"/,
        /\bclassName="[^"]*\b(flex items-center justify-center)\b[^"]*"/,
        /\bclassName="[^"]*\b(space-y-6|border-stone-800)\b[^"]*"/,
      ];

      for (const pattern of forbiddenPatterns) {
        const match = fileContent.match(pattern);
        expect(
          match,
          `Found prohibited Tailwind utility class string "${match?.[0]}" in ThreeLocksFragmentEffect.tsx`
        ).toBeNull();
      }

      // Check that custom scoped .cq-founder-lock classes are defined
      expect(fileContent).toContain('.cq-founder-lock-overlay');
      expect(fileContent).toContain('.cq-founder-lock-modal');
      expect(fileContent).toContain('.cq-founder-receptacle-tray');
      expect(fileContent).toContain('.cq-founder-slot-cell');
    });
  });
});
