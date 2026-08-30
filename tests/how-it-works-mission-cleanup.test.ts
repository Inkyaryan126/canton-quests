/**
 * Canton Quests — /how-it-works Founder's Cipher content audit.
 *
 * /how-it-works must explain Canton Quests as a platform (create a Player
 * Identity, choose a Mission, complete quests, submit proof, earn Mission
 * XP/rewards, compete per that Mission's rules) — never a specific
 * Mission's briefing video, commander transmission, path/district
 * mechanics, or exact prize amounts. Those belong only inside the
 * Founder's Cipher Mission experience (app/events/[slug]/*,
 * components/landing/*).
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const howItWorksSource = readSource('app/how-it-works/page.tsx');

describe('/how-it-works — Founder\'s Cipher Mission content is gone', () => {
  it('no Mission Briefing video / Game Commander Briefing transmission', () => {
    expect(howItWorksSource).not.toMatch(/Mission Briefing/i);
    expect(howItWorksSource).not.toMatch(/Game Commander Briefing/i);
    expect(howItWorksSource).not.toMatch(/WATCH BRIEFING/i);
    expect(howItWorksSource).not.toMatch(/OFFICIAL VIDEO TRANSMISSION/i);
    expect(howItWorksSource).not.toContain('BriefingVideoModal');
    expect(howItWorksSource).not.toContain('isVideoModalOpen');
  });

  it('no Founder\'s Cipher cipher-mechanics content', () => {
    expect(howItWorksSource).not.toMatch(/PERMANENT CQ NUMBER/i);
    expect(howItWorksSource).not.toMatch(/FOLLOW THE TRAIL/i);
  });

  it('no Founder\'s-Cipher-specific fixed dollar prize amounts', () => {
    expect(howItWorksSource).not.toMatch(/\$500/);
    expect(howItWorksSource).not.toMatch(/\$100 \+ \$50 \+ \$50/);
    expect(howItWorksSource).not.toMatch(/\$200 champion/);
    expect(howItWorksSource).not.toMatch(/PUBLICLY VERIFIABLE PRIZE DRAWINGS/i);
  });

  it('no path-specific instructions, locks, or districts', () => {
    expect(howItWorksSource).not.toMatch(/Founder.s Three Locks/i);
    expect(howItWorksSource).not.toMatch(/Starting District/i);
    expect(howItWorksSource).not.toMatch(/Family \/ Challenge \/ Secret/i);
  });
});

describe('/how-it-works — generic platform guidance still renders', () => {
  it('explains the create-identity / choose-Mission / complete-quests / submit-proof loop', () => {
    expect(howItWorksSource).toContain('Create identity');
    expect(howItWorksSource).toContain('Choose a Mission');
    expect(howItWorksSource).toContain('Pick a quest');
    expect(howItWorksSource).toContain('Submit proof');
    expect(howItWorksSource).toMatch(/permanent Player Identity/i);
  });

  it('explains XP and that each Mission runs its own leaderboard, not a single citywide one', () => {
    expect(howItWorksSource).toContain('WHAT IS XP?');
    expect(howItWorksSource).toMatch(/each Mission leaderboard ranks Mission-scoped XP/i);
    expect(howItWorksSource).toMatch(/qualifying Quests, Entry Tokens, or other/i);
    expect(howItWorksSource).toMatch(/entries do not add XP/i);
  });

  it('lists the supported proof types generically (GPS, passphrase, QR, photo, video)', () => {
    expect(howItWorksSource).toContain('GPS Check-In');
    expect(howItWorksSource).toContain('QR Scan');
    expect(howItWorksSource).toContain('Photo Proof');
    expect(howItWorksSource).toContain('Video Proof');
  });

  it('describes drawing entries in Mission-agnostic terms, without implying every Mission shares one prize structure', () => {
    expect(howItWorksSource).toContain('XP IS NOT A TICKET');
    expect(howItWorksSource).toMatch(/Each Mission publishes its own exact/i);
    expect(howItWorksSource).not.toMatch(/\$\d/);
  });

  it('explains Player Identity without exposing account credentials as gameplay identity', () => {
    expect(howItWorksSource).toContain('ONE IDENTITY, MANY MISSIONS');
    expect(howItWorksSource).toMatch(/public callsign-style display name/i);
    expect(howItWorksSource).toMatch(/account credentials are not leaderboard copy/i);
  });

  it('distinguishes Missions, quests, and proof types in Mission-neutral language', () => {
    expect(howItWorksSource).toContain('WHAT YOU ENTER, WHAT YOU PLAY');
    expect(howItWorksSource).toMatch(/A Mission is the container/i);
    expect(howItWorksSource).toMatch(/A quest is the individual objective/i);
    expect(howItWorksSource).toMatch(/The evidence a quest requires/i);
  });

  it('accurately describes leaderboard winner logic from the implementation', () => {
    expect(howItWorksSource).toContain('HOW RANK IS DECIDED');
    expect(howItWorksSource).toMatch(/verified score ledger rows/i);
    expect(howItWorksSource).toMatch(/sorts highest XP first/i);
    expect(howItWorksSource).toMatch(/whoever reached that score first ranks higher/i);
    expect(howItWorksSource).toMatch(/the earlier latest scoring timestamp ranks\s+first/i);
    expect(howItWorksSource).toMatch(/Drawing entries are not a rank tie-breaker/i);
  });

  it('documents the Final Quest Number drawing algorithm without totalFinishers', () => {
    expect(howItWorksSource).toContain('FINAL QUEST NUMBER');
    expect(howItWorksSource).toContain('totalPlayers = qualified players');
    expect(howItWorksSource).toContain('totalValidEntries = valid drawing tickets');
    expect(howItWorksSource).toContain('totalCompletedQuests =');
    expect(howItWorksSource).toContain('(totalPlayers × totalValidEntries × totalCompletedQuests) × 311420151417215192019');
    expect(howItWorksSource).toMatch(/not the winning ticket/i);
    expect(howItWorksSource).toMatch(/N is the total valid tickets/i);
    expect(howItWorksSource).toMatch(/W is the number of digits in N/i);
    expect(howItWorksSource).toMatch(/With 356 tickets, W = 3/i);
    expect(howItWorksSource).toMatch(/809 is invalid because it exceeds 356/i);
    expect(howItWorksSource).toMatch(/092 is valid, so it points to ticket #92/i);
    expect(howItWorksSource).toMatch(/do not restart or reroll/i);
    expect(howItWorksSource).toMatch(/reverse the Final Quest Number and scan again/i);
    expect(howItWorksSource).toContain('(FinalQuestNumber mod totalValidEntries) + 1');
    expect(howItWorksSource).not.toContain('totalFinishers');
  });
});

describe('Founder\'s Cipher Mission-specific components still work in their own routes', () => {
  it('the real Game Commander Mission Briefing video still lives inside the Founder\'s Cipher Mission shell, untouched', () => {
    const shellSource = readSource('components/FounderCipherShell.tsx');
    expect(shellSource).toMatch(/Official Mission Briefing/i);
    expect(shellSource).toMatch(/Game Commander Mission Briefing/i);
    expect(shellSource).toContain('PLAY FULL BRIEFING');
  });

  it('BriefingVideoModal.tsx (the how-it-works page\'s former trigger) was deleted once confirmed to have zero remaining consumers', () => {
    // Only /how-it-works ever rendered <BriefingVideoModal>; the real
    // Founder's Cipher briefing lives in FounderCipherShell.tsx via its own
    // inline video, so removing it loses no working functionality. A
    // repo-wide search confirmed zero other callers before deletion — see
    // tests/command-center-dead-weight-cleanup.test.ts.
    expect(fs.existsSync(path.join(process.cwd(), 'components/BriefingVideoModal.tsx'))).toBe(false);
  });
});
