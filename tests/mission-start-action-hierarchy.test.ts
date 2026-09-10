// Canton Quests — Emergency Launch Blocker: First-Time Mission Flow
//
// A real downtown field test on production found that after entering the
// Mission, a player landed on a hub with many competing systems (paths,
// transmissions, city pulse, cipher panels, tabs) and could not tell how to
// actually start playing, where the first quest was, or how to submit
// proof. A first pass reordered the existing panels; a second, larger pass
// (this one) radically simplified the surface itself: ONE SCREEN = ONE
// OBVIOUS JOB.
//
// Root causes fixed:
//  1. The hub wrapped its entire dashboard in FounderCipherShell — a
//     ~500-line marketing/landing shell (hero video, commander briefing, a
//     prize callout, a duplicate "Live Mission Control" nav grid, the
//     giant three-doors graphic, a four-steps explainer, a locations
//     showcase, and a full prize presentation) appropriate for a first
//     visit, not for someone already mid-mission. The active-play hub no
//     longer uses it; that wrapper is preserved unchanged for the
//     legitimate pre-entry marketing gates (not logged in / no path yet).
//  2. The dashboard exposed 5 tabs (Quests/Map/Scores/Rewards/Safety) plus
//     ~9 stacked secondary systems above them. Consolidated to 3 secondary
//     tabs — ALL QUESTS / MAP / MISSION INTEL — with the previously-tabbed
//     Scores/Rewards/Safety content, and the previously-stacked city
//     pulse/live status/secret code/player identity/cipher panels/XP stat
//     grid, all folded into Mission Intel. Nothing was deleted.
//  3. MISSION_BRIEFING only fired from inside the Cold Open transmission's
//     onFinished callback — a player who'd already seen the Cold Open (or
//     for whom shouldAutoShowTransmission returned false) never saw the
//     briefing. Now it fires independently, and the actual "how to play"
//     copy lives directly on the mission panel itself (never only inside a
//     dismissable overlay).
//  4. The recommended-quest link, the mobile start bar, and the flash-quest
//     alert built hrefs directly from the quest id without preserving
//     ?fieldTest=1, unlike components/QuestCard.tsx.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const HUB_SOURCE = readSource('app/events/[slug]/page.tsx');
const QUEST_DETAIL_SOURCE = readSource('app/events/[slug]/quests/[questId]/page.tsx');

describe('Mission hub — the active-play surface no longer wraps in the marketing shell', () => {
  it('the fully-entered isCipher hub render no longer uses FounderCipherShell', () => {
    // Locate the final isCipher render branch (after the GATE 1/2/3
    // pre-entry branches, which legitimately keep the marketing shell) by
    // anchoring on the "Radical simplification" comment that documents it.
    const activeHubBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('// Radical simplification: the active-play hub'),
      HUB_SOURCE.indexOf('function EventHubSession')
    );
    expect(activeHubBlock).not.toContain('<FounderCipherShell');
    expect(activeHubBlock).toContain('<main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:py-8">{dashboardCore}</main>');
  });

  it('FounderCipherShell is still used, unchanged, for the legitimate pre-entry marketing gates', () => {
    const preEntryUsages = (HUB_SOURCE.match(/<FounderCipherShell/g) || []).length;
    // Pre-launch marketing screen, Gate 1 (auth required), Gate 3 (path
    // selector) — three legitimate pre-entry uses, none of them the active
    // gameplay hub.
    expect(preEntryUsages).toBe(3);
  });
});

describe('Mission hub — the primary action panel is the entire "what do I do" surface', () => {
  it('renders a single, clearly-marked mission panel', () => {
    expect(HUB_SOURCE).toContain('data-testid="mission-start-panel"');
    expect((HUB_SOURCE.match(/data-testid="mission-start-panel"/g) || []).length).toBe(1);
  });

  it('the panel shows quest-completion count, the next assignment, and one dominant CTA', () => {
    expect(HUB_SOURCE).toContain('quests complete');
    expect(HUB_SOURCE).toContain('Next Assignment');
    expect(HUB_SOURCE).toContain("{hasStartedMission ? 'CONTINUE MISSION →' : 'START FIRST QUEST →'}");
    expect(HUB_SOURCE).toContain("data-testid={hasStartedMission ? 'continue-quest-cta' : 'start-first-quest-cta'}");
  });

  it('a zero-progress player sees the plain-language Founder\'s Cipher briefing directly on the page, not only inside a transmission overlay', () => {
    expect(HUB_SOURCE).toContain(
      "Canton is hiding pieces of a message. Go to real locations. Find what each quest asks for. Submit what you discover."
    );
    // Guarded so a returning player doesn't see onboarding copy again.
    expect(HUB_SOURCE).toMatch(/\{!hasStartedMission && isCipher && \(/);
  });

  it('once a path is chosen, only a small PATH badge remains — no giant doors graphic inside the panel', () => {
    const panelBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="mission-start-panel"'),
      HUB_SOURCE.indexOf('Live Pop-Up Quest Alert Banner')
    );
    expect(panelBlock).toContain('PATH: {playerChosenPath}');
    expect(panelBlock).not.toContain('cq-three-doors');
    expect(panelBlock).not.toContain('DOOR_HOTSPOTS');
  });

  it('there is no leftover duplicate of the old buried "Start This Quest" card or the old hero copy', () => {
    expect(HUB_SOURCE).not.toContain('You are playing as');
    expect(HUB_SOURCE).not.toContain('Start This Quest →');
    expect(HUB_SOURCE).not.toContain('Create your callsign');
    expect(HUB_SOURCE).not.toContain('Choose a quest');
  });
});

describe('Mission hub — secondary navigation is 3 items, not 5, and secondary systems live behind Mission Intel', () => {
  it('DashboardTab is exactly quests | map | intel', () => {
    expect(HUB_SOURCE).toContain("type DashboardTab = 'quests' | 'map' | 'intel';");
    expect(HUB_SOURCE).toContain("const VALID_TABS: DashboardTab[] = ['quests', 'map', 'intel'];");
  });

  it('the secondary nav bar reads ALL QUESTS / MAP / MISSION INTEL', () => {
    expect(HUB_SOURCE).toMatch(/All Quests \(\{quests\.length\}\)/);
    expect(HUB_SOURCE).toContain('Mission Intel');
  });

  it('city pulse, live status, secret code redemption, player identity, cipher panels, XP stats, leaderboard, collectibles, and rules all moved into the Mission Intel tab', () => {
    const intelBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="mission-intel-tab"'),
      HUB_SOURCE.indexOf('const mobileStartBar')
    );
    for (const marker of [
      '<CityPulseStrip',
      '<LiveCityStatusPanel',
      'Have a secret code?',
      '<PlayerIdentityBar',
      '<CipherFragmentsPanel',
      '<MasterCipherStatusCard',
      'Your XP Score',
      '<Leaderboard',
      'Agent Digital Collectibles Vault',
      'Canton Quests Real-World Field Guidelines',
    ]) {
      expect(intelBlock, `expected ${marker} inside the Mission Intel tab`).toContain(marker);
    }
  });

  it('none of the moved systems still render unconditionally above the tab bar', () => {
    const preTabBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="mission-start-panel"'),
      HUB_SOURCE.indexOf('data-testid="mission-secondary-nav"')
    );
    for (const marker of ['<CityPulseStrip', '<LiveCityStatusPanel', '<PlayerIdentityBar', '<CipherFragmentsPanel', '<MasterCipherStatusCard']) {
      expect(preTabBlock, `expected ${marker} NOT to render above the tab bar anymore`).not.toContain(marker);
    }
  });
});

describe('MISSION_BRIEFING — fires independently of Cold Open playback', () => {
  it('defines one shared showBriefingIfUnseen and calls it directly when the Cold Open will not play, not only from its onFinished callback', () => {
    const effectBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('const showBriefingIfUnseen = () => {'),
      HUB_SOURCE.indexOf("}, [entryReady, eventSlug, authenticatedPlayer, participation]);", HUB_SOURCE.indexOf('const showBriefingIfUnseen'))
    );
    const alreadyViewedBranch = effectBlock.slice(
      effectBlock.indexOf("if (!shouldAutoShowTransmission('cipher_cold_open', 'video-1', pid)) {"),
      effectBlock.indexOf('const entry = getCommanderTransmissionForTrigger')
    );
    expect(alreadyViewedBranch).toContain('showBriefingIfUnseen();');
    expect(effectBlock).toContain('onFinished: showBriefingIfUnseen,');
  });
});

describe('Quest-navigation links on the hub use one shared buildQuestHref helper', () => {
  it('defines one shared buildQuestHref helper with no query-string threading (access is cookie-based, not query-based)', () => {
    expect(HUB_SOURCE).toContain(
      "const buildQuestHref = (questId: string) => `/events/${eventSlug}/quests/${questId}`;"
    );
  });

  it('the recommended-quest CTA, the mobile start bar, and the flash-quest alert all use buildQuestHref instead of a raw quest URL', () => {
    expect(HUB_SOURCE).toMatch(/href=\{buildQuestHref\(recommendedQuest\.id\)\}/);
    expect(HUB_SOURCE).toContain('href={buildQuestHref(recommendedQuest.id)}\n      label={hasStartedMission');
    expect(HUB_SOURCE).toMatch(/href=\{buildQuestHref\(activeFlashQuests\[0\]\.id\)\}/);
  });
});

describe('Quest detail page — GO HERE / DO THIS / SUBMIT is the core page, nothing optional in between', () => {
  it('exposes a labeled "Go here" location panel with a map-directions action', () => {
    expect(QUEST_DETAIL_SOURCE).toContain('Go here');
    expect(QUEST_DETAIL_SOURCE).toContain('Open Map Directions');
  });

  it('exposes a labeled "Do this" panel showing the player-facing instructions, nothing more', () => {
    expect(QUEST_DETAIL_SOURCE).toContain('Do this');
    expect(QUEST_DETAIL_SOURCE).toContain('{quest.instructions}');
  });

  it('the Go here / Do this grid is immediately followed by the submission section — no jump button, because nothing optional sits between them anymore', () => {
    expect(QUEST_DETAIL_SOURCE).not.toContain('jump-to-submit-cta');
    expect(QUEST_DETAIL_SOURCE).not.toContain('SUBMIT YOUR PROOF');
    const briefingToSubmit = QUEST_DETAIL_SOURCE.slice(
      QUEST_DETAIL_SOURCE.indexOf('Go here'),
      QUEST_DETAIL_SOURCE.indexOf('Locked Prerequisite Warning')
    );
    // Between the Go-here/Do-this grid and the locked/completed/pending/
    // active submission ternary, only the grid's own closing tags and the
    // section wrapper may appear — no transmission, reward, or notes block.
    expect(briefingToSubmit).not.toContain('CommanderTransmission');
    expect(briefingToSubmit).not.toContain('QuestRewardBreakdown');
    expect(briefingToSubmit).not.toContain('accessNotes');
  });

  it('the submission control section itself is unambiguously labeled, with no explanatory copy about how to use the page', () => {
    expect(QUEST_DETAIL_SOURCE).toMatch(/Submit\s*\n\s*<\/h2>/);
    expect(QUEST_DETAIL_SOURCE).not.toContain('Complete the mission objective, then submit verification using the control below.');
  });

  it('rewards are small secondary text placed after the submission ternary, not a grid cell competing with Go here / Do this', () => {
    const afterSubmit = QUEST_DETAIL_SOURCE.slice(
      QUEST_DETAIL_SOURCE.indexOf('Everything below is optional context'),
      QUEST_DETAIL_SOURCE.indexOf('<GameFeedbackModal')
    );
    expect(afterSubmit).toContain('Reward: +{quest.pointValue} XP');
    // Transmissions, bonus reward breakdown, and access/safety notes all
    // moved here too — after submission, never before it.
    expect(afterSubmit).toContain('quest.sectorIntroTransmission');
    expect(afterSubmit).toContain('quest.commanderTransmission');
    expect(afterSubmit).toContain('accessNotes');
    expect(afterSubmit).toContain('rewardSummary.hasBonusContent');
  });

  it('quest-completion next-action navigation uses the shared buildQuestHref helper, with no query-string threading', () => {
    expect(QUEST_DETAIL_SOURCE).toMatch(
      /const buildQuestHref = useCallback\(\s*\n\s*\(targetQuestId: string\) => `\/events\/\$\{eventSlug\}\/quests\/\$\{targetQuestId\}`,\s*\n\s*\[eventSlug\]/
    );
    expect((QUEST_DETAIL_SOURCE.match(/unlockedQuestUrl: nextInChain \? buildQuestHref\(nextInChain\.id\) : undefined/g) || []).length).toBe(4);
  });

  it('after completion, a dominant NEXT QUEST action leads with BACK TO MISSION as secondary', () => {
    const completedBlock = QUEST_DETAIL_SOURCE.slice(
      QUEST_DETAIL_SOURCE.indexOf('/* COMPLETED STATE */'),
      QUEST_DETAIL_SOURCE.indexOf('qst-frankenstein-west-lawn')
    );
    expect(completedBlock).toContain('data-testid="next-quest-cta"');
    expect(completedBlock).toContain('NEXT QUEST →');
    expect(completedBlock).toContain('data-testid="back-to-mission-cta"');
    expect(completedBlock).toContain('BACK TO MISSION');
    expect(completedBlock).toContain('href={buildQuestHref(nextQuestAfterThis.id)}');
    expect(completedBlock).toContain('href={backToHubHref}');
  });

  it('the next-quest suggestion prefers this quest\'s own chain successor, falling back to the next unlocked incomplete quest', () => {
    expect(QUEST_DETAIL_SOURCE).toContain(
      "const chainSuccessor = allEventQuests.find((q) => q.prerequisiteQuestId === quest.id && q.status === 'active');"
    );
    expect(QUEST_DETAIL_SOURCE).toContain('const nextQuestAfterThis = chainSuccessor || nextUnlockedIncomplete;');
  });
});
