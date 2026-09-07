import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HudSystemState from '../components/game-effects/HudSystemState';
import HudTransition from '../components/game-effects/HudTransition';
import CityScanOverlay from '../components/game-effects/CityScanOverlay';
import RewardTokenEffect from '../components/game-effects/RewardTokenEffect';
import LazyHudParticles from '../components/game-effects/LazyHudParticles';

describe('field terminal presentation', () => {
  it.each(['armed', 'scanning', 'confirmed', 'denied'] as const)('announces %s with text and an independent visual marker', state => {
    const html = renderToStaticMarkup(<HudSystemState state={state} label="Field status" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain('Field status');
    expect(html).toContain('aria-hidden="true"');
  });

  it('makes section content available immediately even with reduced motion', () => {
    const html = renderToStaticMarkup(<HudTransition reducedMotion><button>Continue</button></HudTransition>);
    expect(html).toContain('data-reduced-motion="true"');
    expect(html).toContain('<button>Continue</button>');
    expect(html).not.toContain('aria-hidden');
  });

  it('uses the shared state in the real city scan without inventing targets or progress', () => {
    const html = renderToStaticMarkup(<CityScanOverlay moment={{ type: 'city-scan', targetCount: 0 }} onDismiss={() => {}} />);
    expect(html).toContain('data-state="scanning"');
    expect(html).not.toContain('12');
    expect(html).not.toContain('45%');
  });

  it('uses a confirmed receipt for exactly the supplied rewards, including zero', () => {
    const html = renderToStaticMarkup(<RewardTokenEffect moment={{ type: 'reward-token', kind: 'entry-token', headline: 'Entry received', entryCount: 2, xpAmount: 0 }} onDismiss={() => {}} reducedMotion />);
    expect(html).toContain('data-state="confirmed"');
    expect(html).toContain('+0');
    expect(html).toContain('+2');
    expect(html).toContain('ENTRY TOKENS RECEIVED');
    expect(html).toContain('CONTINUE');
  });

  it('does not render particle work on the server or in reduced motion', () => {
    expect(renderToStaticMarkup(<LazyHudParticles />)).toBe('');
    expect(renderToStaticMarkup(<LazyHudParticles reducedMotion />)).toBe('');
  });
});
