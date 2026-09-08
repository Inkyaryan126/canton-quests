import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import QuestCompleteEffect from '../components/game-effects/QuestCompleteEffect';
import QuestStartEffect from '../components/game-effects/QuestStartEffect';
import QuestMomentReveal from '../components/game-effects/QuestMomentReveal';

const QUEST_COMPLETE_SRC = readFileSync(
  join(process.cwd(), 'components/game-effects/QuestCompleteEffect.tsx'),
  'utf8'
);
const QUEST_START_SRC = readFileSync(
  join(process.cwd(), 'components/game-effects/QuestStartEffect.tsx'),
  'utf8'
);
const QUEST_PAGE_SRC = readFileSync(
  join(process.cwd(), 'app/events/[slug]/quests/[questId]/page.tsx'),
  'utf8'
);

describe('Phase 3 — Quest-start & quest-completion flagship moments', () => {
  describe('QuestCompleteEffect — reduced-motion (immediate, exact reward figures)', () => {
    it.each([
      { label: 'a normal completion', xpAwarded: 137, drawingEntriesAwarded: 2 },
      { label: 'a lucky-bonus completion (server already folded the bonus into the total)', xpAwarded: 163, drawingEntriesAwarded: 4 },
    ])('reveals the exact server-granted XP and entries for $label', ({ xpAwarded, drawingEntriesAwarded }) => {
      const html = renderToStaticMarkup(
        <QuestCompleteEffect
          moment={{ type: 'quest-complete', questTitle: 'The Signal', xpAwarded, drawingEntriesAwarded }}
          onDismiss={() => {}}
          reducedMotion
        />
      );
      expect(html).toContain(`+${xpAwarded}`);
      expect(html).toContain(`+${drawingEntriesAwarded}`);
      expect(html).toContain('cq-transition-reveal');
      expect(html).toContain('is-confirmed');
      expect(html).not.toContain('animate-ping');
      expect(html).not.toContain('animate-bounce');
    });

    it('does not invent an entry-token row for an XP-only result', () => {
      const html = renderToStaticMarkup(
        <QuestCompleteEffect
          moment={{ type: 'quest-complete', questTitle: 'The Signal', xpAwarded: 0, drawingEntriesAwarded: 0 }}
          onDismiss={() => {}}
          reducedMotion
        />
      );
      expect(html).toContain('+0');
      expect(html).not.toContain('Prize Drawing Ticket');
    });
  });

  describe('QuestCompleteEffect — animated count-up (non-reduced-motion) never invents a different number', () => {
    it.each([
      { label: 'a normal completion', xpAwarded: 137 },
      { label: 'a lucky-bonus completion', xpAwarded: 163 },
    ])('starts the count-up from 0 toward the real awarded XP for $label, without the old raw motion utilities', ({ xpAwarded }) => {
      const html = renderToStaticMarkup(
        <QuestCompleteEffect
          moment={{ type: 'quest-complete', questTitle: 'The Signal', xpAwarded, drawingEntriesAwarded: 1 }}
          onDismiss={() => {}}
          reducedMotion={false}
        />
      );
      // renderToStaticMarkup never runs effects, so this only captures the
      // pre-animation frame — the count-up interval itself is verified by
      // source inspection below to target the exact same moment.xpAwarded.
      expect(html).toContain('+0');
      expect(html).toContain('cq-transition-reveal');
      expect(html).not.toContain('animate-ping');
      expect(html).not.toContain('animate-bounce');
    });

    it('drives the count-up interval off moment.xpAwarded — never a derived or rounded-differently figure', () => {
      expect(QUEST_COMPLETE_SRC).toContain('const targetXp = moment.xpAwarded;');
      expect(QUEST_COMPLETE_SRC).toContain('setDisplayXp(current)');
    });
  });

  describe('QuestCompleteEffect — Phase 2 primitive integration', () => {
    it('uses the shared QuestMomentReveal/CqTransition reveal and SystemStatusBadge, not bespoke motion', () => {
      expect(QUEST_COMPLETE_SRC).toContain("import QuestMomentReveal from './QuestMomentReveal'");
      expect(QUEST_COMPLETE_SRC).toContain("import SystemStatusBadge from './SystemStatusBadge'");
      expect(QUEST_COMPLETE_SRC).toContain('<QuestMomentReveal');
      expect(QUEST_COMPLETE_SRC).toContain('<SystemStatusBadge status="confirmed"');
    });

    it('plays through the Phase 2 cqSoundManager instead of the legacy proceduralSoundEngine', () => {
      expect(QUEST_COMPLETE_SRC).toContain("import { cqSoundManager } from '@/lib/audio'");
      expect(QUEST_COMPLETE_SRC).toContain("cqSoundManager.play('quest_complete')");
      expect(QUEST_COMPLETE_SRC).not.toContain('proceduralSoundEngine');
    });
  });

  describe('QuestStartEffect', () => {
    it('renders an armed HUD system-state banner naming the quest', () => {
      const html = renderToStaticMarkup(<QuestStartEffect questTitle="The Signal" />);
      expect(html).toContain('cq-hud-system-state');
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-armed');
      expect(html).toContain('QUEST SIGNAL ACQUIRED');
      expect(html).toContain('The Signal');
      expect(html).toContain('cq-transition-reveal');
    });

    it('plays the quest_start cue via the Phase 2 sound manager', () => {
      expect(QUEST_START_SRC).toContain("import { cqSoundManager } from '@/lib/audio'");
      expect(QUEST_START_SRC).toContain("cqSoundManager.play('quest_start')");
    });
  });

  describe('QuestMomentReveal', () => {
    it('collapses to an instant, fully-visible reveal under an app-level reducedMotion flag', () => {
      const html = renderToStaticMarkup(
        <QuestMomentReveal reducedMotion>
          <p>Tactical Content</p>
        </QuestMomentReveal>
      );
      expect(html).toContain('cq-transition-reveal');
      expect(html).toContain('data-reduced-motion="true"');
      expect(html).toContain('opacity:1');
      expect(html).toContain('Tactical Content');
    });
  });

  describe('Real call-site integration on the quest detail page', () => {
    it('renders QuestStartEffect for an attemptable quest, keyed per quest so it replays on navigation between quests', () => {
      expect(QUEST_PAGE_SRC).toContain("import QuestStartEffect from '@/components/game-effects/QuestStartEffect'");
      expect(QUEST_PAGE_SRC).toContain('<QuestStartEffect key={quest.id}');
      expect(QUEST_PAGE_SRC).toContain('!isAlreadyCompleted && !isAlreadyPending && !isLocked');
    });

    it('still routes quest completion through the existing triggerQuestRewardSequence / QuestCompleteEffect machinery', () => {
      expect(QUEST_PAGE_SRC).toContain('triggerQuestRewardSequence({');
      expect(QUEST_PAGE_SRC).toContain('xpAwarded: result.awardedPoints,');
    });
  });
});
