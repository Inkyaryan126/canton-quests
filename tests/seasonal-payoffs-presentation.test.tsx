import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/start/secret',
}));

vi.stubGlobal('React', React);

import FrankensteinPayoffCard from '../components/game-effects/FrankensteinPayoffCard';
import WatcherHalloweenTeaseCard from '../components/game-effects/WatcherHalloweenTeaseCard';

const questDetailSource = readFileSync(
  join(process.cwd(), 'app/events/[slug]/quests/[questId]/page.tsx'),
  'utf8',
);

describe("Frankenstein's grave payoff", () => {
  it('treats the verified West Lawn visit as a story payoff with respectful protocol intact', () => {
    const html = renderToStaticMarkup(<FrankensteinPayoffCard />);
    expect(html).toContain('WEST LAWN ARCHIVE');
    expect(html).toContain("Frankenstein&#x27;s Quiet Signal");
    expect(html).toContain('PHOTO PROOF VERIFIED');
    expect(html).toContain('respectful distance');
    expect(html).toContain('SIGNAL INTERRUPT');
  });

  it('composes the established Phase 2 presentation primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/game-effects/FrankensteinPayoffCard.tsx'),
      'utf8',
    );
    expect(source).toMatch(/<TransmissionPanel/);
    expect(source).toMatch(/<SystemStatusBadge/);
    expect(source).toMatch(/<HudSystemState/);
    expect(source).toMatch(/<CqTransition/);
  });
});

describe('Watchers Halloween tease', () => {
  it('presents a restrained in-world signal instead of promotional copy', () => {
    const html = renderToStaticMarkup(<WatcherHalloweenTeaseCard />);
    expect(html).toContain('WATCHER SIGNAL W-01');
    expect(html).toContain('DORMANT // REACTIVATION: OCTOBER');
    expect(html).toContain('NODE: WEST LAWN CEMETERY');
    expect(html).toContain('You weren&#x27;t the only one following the trail');
    expect(html).not.toContain('campaign');
    expect(html).not.toContain('advertisement');
  });

  it('uses the reduced-motion hook and shared transmission primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/game-effects/WatcherHalloweenTeaseCard.tsx'),
      'utf8',
    );
    expect(source).toMatch(/useReducedMotion/);
    expect(source).toMatch(/<TransmissionPanel/);
    expect(source).toMatch(/<TransmissionLoader/);
    expect(source).toMatch(/<VerificationResult/);
  });

  it('appears only in the verified completion state for the West Lawn quest', () => {
    expect(questDetailSource).toMatch(/import FrankensteinPayoffCard/);
    expect(questDetailSource).toMatch(/import WatcherHalloweenTeaseCard/);
    expect(questDetailSource).toMatch(/quest\.id === 'qst-frankenstein-west-lawn'/);
    expect(questDetailSource).toMatch(/isAlreadyCompleted[\s\S]*<FrankensteinPayoffCard/);
    expect(questDetailSource).toMatch(/<WatcherHalloweenTeaseCard/);
  });
});
