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
  usePathname: () => '/start/secret',
}));

(globalThis as any).React = React;

import { SEED_QUESTS } from '../lib/seed-data';
import { WATCHER_HALLOWEEN_TEASE, getWatcherHalloweenTease } from '../lib/watchers';
import WatcherHalloweenTeaseCard from '../components/game-effects/WatcherHalloweenTeaseCard';
import FrankensteinPayoffCard from '../components/game-effects/FrankensteinPayoffCard';
import SecretLanding from '../components/landing/SecretLanding';

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Phase 3 — Seasonal Payoff: Frankenstein\'s Grave Quest Payoff', () => {
  const quest = SEED_QUESTS.find((q) => q.id === 'qst-frankenstein-west-lawn');

  it('quest definition exists and maintains real quest content', () => {
    expect(quest).toBeDefined();
    expect(quest?.id).toBe('qst-frankenstein-west-lawn');
    expect(quest?.slug).toBe('frankenstein-west-lawn');
    expect(quest?.title).toBe("Frankenstein's Quiet Signal");
    expect(quest?.category).toBe('secret');
    expect(quest?.verificationType).toBe('photo');
    expect(quest?.pointValue).toBe(200);
    expect(quest?.xpReward).toBe(200);
    expect(quest?.drawingEntryReward).toBe(1);
    expect(quest?.locationId).toBe('loc-west-lawn-frankenstein');
  });

  it('configures canonical completionTransmission carrying the Halloween Watcher intercept payoff', () => {
    expect(quest?.completionTransmission).toBeDefined();
    expect(quest?.completionTransmission?.type).toBe('PHOTO_MESSAGE');
    expect(quest?.completionTransmission?.headline).toBe('SIGNAL INTERCEPT // WATCHER W-01');
    expect(quest?.completionTransmission?.message).toContain('Record confirmed.');
    expect(quest?.completionTransmission?.message).toContain("I'm seeing another signature attached to the file");
    expect(quest?.completionTransmission?.message).toContain('You found the grave. We noticed, operative.');
    expect(quest?.completionTransmission?.message).toContain('WATCHER SIGNAL W-01: DORMANT // REACTIVATION: OCTOBER');
    expect(quest?.completionTransmission?.message).toContain("We'll be watching.");
    expect(quest?.completionTransmission?.cta).toBe('ACKNOWLEDGE SIGNAL');
  });

  it('configures canonical commanderTransmission briefing for West Lawn respectful cemetery protocol', () => {
    expect(quest?.commanderTransmission).toBeDefined();
    expect(quest?.commanderTransmission?.type).toBe('PHOTO_MESSAGE');
    expect(quest?.commanderTransmission?.headline).toBe('WEST LAWN ARCHIVE // PROTOCOL');
    expect(quest?.commanderTransmission?.message).toContain('West Lawn is active ground, but this is consecrated space');
    expect(quest?.commanderTransmission?.message).toContain('Stay on paved paths, observe from a respectful distance');
    expect(quest?.commanderTransmission?.cta).toBe('ACKNOWLEDGE PROTOCOL');
  });

  it('FrankensteinPayoffCard renders visibly using Phase 2 presentation primitives', () => {
    const html = renderToStaticMarkup(<FrankensteinPayoffCard />);
    // Uses TransmissionPanel (eyebrow + purple tone)
    expect(html).toContain('SEASONAL PAYOFF // WEST LAWN ARCHIVE');
    expect(html).toContain('border-purple-500/30');
    // Uses SystemStatusBadge / HudSystemState
    expect(html).toContain('cq-status-badge');
    expect(html).toContain('cq-hud-system-state');
    expect(html).toContain('PHOTO PROOF VERIFIED');
    // Uses CqTransition
    expect(html).toContain('cq-transition-reveal');
    // Displays the seasonal payoff content
    expect(html).toContain("Frankenstein&#x27;s Quiet Signal");
    expect(html).toContain('WATCHER SIGNAL W-01: DORMANT // REACTIVATION: OCTOBER');
    expect(html).toContain('OCTOBER HALLOWEEN EVENT');
  });

  it('FrankensteinPayoffCard source imports and composes Phase 2 primitives rather than bespoke styling', () => {
    const source = readSource('components/game-effects/FrankensteinPayoffCard.tsx');
    expect(source).toMatch(/import TransmissionPanel from '\.\/TransmissionPanel';/);
    expect(source).toMatch(/import SystemStatusBadge from '\.\/SystemStatusBadge';/);
    expect(source).toMatch(/import HudSystemState from '\.\/HudSystemState';/);
    expect(source).toMatch(/import CqTransition from '\.\/CqTransition';/);
    expect(source).toMatch(/<TransmissionPanel/);
    expect(source).toMatch(/tone="purple"/);
  });
});

describe('Phase 3 — Seasonal Payoff: Watchers Halloween Tease Foundation (lib/watchers.ts)', () => {
  it('exports canonical WATCHER_HALLOWEEN_TEASE constant and getWatcherHalloweenTease getter', () => {
    expect(WATCHER_HALLOWEEN_TEASE).toBeDefined();
    expect(getWatcherHalloweenTease()).toEqual(WATCHER_HALLOWEEN_TEASE);
  });

  it('defines the canonical W-01 signal metadata', () => {
    expect(WATCHER_HALLOWEEN_TEASE.signalId).toBe('W-01');
    expect(WATCHER_HALLOWEEN_TEASE.status).toBe('DORMANT');
    expect(WATCHER_HALLOWEEN_TEASE.reactivationWindow).toBe('OCTOBER');
    expect(WATCHER_HALLOWEEN_TEASE.eyebrow).toBe('CLASSIFIED INTERCEPT // WATCHER SIGNAL W-01');
    expect(WATCHER_HALLOWEEN_TEASE.headline).toBe('WATCHER FREQUENCY DORMANT // REACTIVATION: OCTOBER');
    expect(WATCHER_HALLOWEEN_TEASE.interceptMessage).toContain("You weren't the only one following the trail through Canton");
    expect(WATCHER_HALLOWEEN_TEASE.interceptMessage).toContain('When the autumn frost hits West Lawn, the frequency reopens');
    expect(WATCHER_HALLOWEEN_TEASE.footnote).toContain('WATCHER STATUS: FLAGGED [W-01]');
  });

  it('provides a structured transmission payload for the seasonal moment', () => {
    expect(WATCHER_HALLOWEEN_TEASE.transmission).toBeDefined();
    expect(WATCHER_HALLOWEEN_TEASE.transmission.type).toBe('PHOTO_MESSAGE');
    expect(WATCHER_HALLOWEEN_TEASE.transmission.headline).toBe('WATCHER SIGNAL W-01 // OCTOBER TEASE');
    expect(WATCHER_HALLOWEEN_TEASE.transmission.message).toContain("You found the grave. We noticed, operative.");
  });
});

describe('Phase 3 — WatcherHalloweenTeaseCard Component', () => {
  it('renders visibly using TransmissionPanel, SystemStatusBadge, HudSystemState, and CqTransition', () => {
    const html = renderToStaticMarkup(<WatcherHalloweenTeaseCard />);
    // TransmissionPanel with purple tone
    expect(html).toContain('border-purple-500/30');
    expect(html).toContain('CLASSIFIED INTERCEPT // WATCHER SIGNAL W-01');
    // SystemStatusBadge
    expect(html).toContain('cq-status-badge');
    expect(html).toContain('DORMANT // OCT');
    // HudSystemState
    expect(html).toContain('cq-hud-system-state');
    expect(html).toContain('NODE: WEST LAWN CEMETERY');
    expect(html).toContain('FLAGGED [W-01]');
    // CqTransition
    expect(html).toContain('cq-transition-reveal');
    // Canonical tease headline
    expect(html).toContain('WATCHER FREQUENCY DORMANT // REACTIVATION: OCTOBER');
  });

  it('source imports and uses Phase 2 presentation primitives', () => {
    const source = readSource('components/game-effects/WatcherHalloweenTeaseCard.tsx');
    expect(source).toMatch(/import TransmissionPanel from '\.\/TransmissionPanel';/);
    expect(source).toMatch(/import TransmissionLoader from '\.\/TransmissionLoader';/);
    expect(source).toMatch(/import VerificationResult from '\.\/VerificationResult';/);
    expect(source).toMatch(/import SystemStatusBadge from '\.\/SystemStatusBadge';/);
    expect(source).toMatch(/import HudSystemState from '\.\/HudSystemState';/);
    expect(source).toMatch(/import CqTransition from '\.\/CqTransition';/);
    expect(source).toMatch(/import \{ useReducedMotion \} from '@\/lib\/motion';/);
  });
});

describe('Phase 3 — SecretLanding Integration of Seasonal Primitives', () => {
  it('SecretLanding visibly embeds WatcherHalloweenTeaseCard and uses Phase 2 primitives', () => {
    const html = renderToStaticMarkup(<SecretLanding />);
    // Hero status pill now uses HudSystemState / SystemStatusBadge
    expect(html).toContain('cq-hud-system-state');
    expect(html).toContain('CLASSIFIED ENTRY // UNLISTED SIGNAL');
    // Initial coordinate decryption uses TransmissionPanel
    expect(html).toContain('FIELD SIGNAL INTERCEPT // UNLISTED DOSSIER #00');
    expect(html).toContain('INITIAL COORDINATE DECRYPTION');
    // Active classified dossiers use TransmissionPanel
    expect(html).toContain('DOSSIER 01 // MULTI-STEP');
    expect(html).toContain('DOSSIER 02 // HISTORIC NODE');
    expect(html).toContain('DOSSIER 03 // ROAMING NPC');
    // Seasonal Watchers Halloween Tease section is present
    expect(html).toContain('SEASONAL CLASSIFIED PAYOFF');
    expect(html).toContain('THE OCTOBER WATCHERS PREVIEW');
    expect(html).toContain('WATCHER FREQUENCY DORMANT // REACTIVATION: OCTOBER');
    expect(html).toContain('NODE: WEST LAWN CEMETERY');
  });

  it('SecretLanding source imports Phase 2 primitives and WatcherHalloweenTeaseCard', () => {
    const source = readSource('components/landing/SecretLanding.tsx');
    expect(source).toMatch(/import TransmissionPanel from '@\/components\/game-effects\/TransmissionPanel';/);
    expect(source).toMatch(/import SystemStatusBadge from '@\/components\/game-effects\/SystemStatusBadge';/);
    expect(source).toMatch(/import HudSystemState from '@\/components\/game-effects\/HudSystemState';/);
    expect(source).toMatch(/import VerificationResult from '@\/components\/game-effects\/VerificationResult';/);
    expect(source).toMatch(/import CqTransition from '@\/components\/game-effects\/CqTransition';/);
    expect(source).toMatch(/import WatcherHalloweenTeaseCard from '@\/components\/game-effects\/WatcherHalloweenTeaseCard';/);
  });
});
