import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ThreeLocksCompleteMoment, ThreeLocksFragmentMoment } from '../lib/game-effects';

vi.stubGlobal('React', React);

import ThreeLocksFragmentEffect from '../components/game-effects/ThreeLocksFragmentEffect';

describe('Founder Lock acquisition flagship', () => {
  it.each([
    ['mark', 'THE MARK', 'LOCK I'],
    ['code', 'THE CODE', 'LOCK II'],
    ['word', 'THE WORD', 'LOCK III'],
  ] as const)('gives %s a distinct seated lock ceremony', (fragment, name, ordinal) => {
    const moment: ThreeLocksFragmentMoment = {
      type: 'three-locks-fragment', fragment, headline: 'FOUNDER LOCK ACQUIRED',
      primaryText: name, locksOwned: { mark: fragment === 'mark', code: fragment === 'code', word: fragment === 'word' },
    };
    const html = renderToStaticMarkup(<ThreeLocksFragmentEffect moment={moment} onDismiss={() => {}} reducedMotion />);
    expect(html).toContain(name);
    expect(html).toContain(ordinal);
    expect(html).toContain('SEATED');
    expect(html).toContain('1 OF 3 ENGAGED');
  });

  it('uses a restrained authentication stage before seating when motion is enabled', () => {
    const moment: ThreeLocksFragmentMoment = {
      type: 'three-locks-fragment', fragment: 'mark', headline: 'FOUNDER LOCK ACQUIRED',
      primaryText: 'THE MARK', locksOwned: { mark: true, code: false, word: false },
    };
    const html = renderToStaticMarkup(<ThreeLocksFragmentEffect moment={moment} onDismiss={() => {}} reducedMotion={false} />);
    expect(html).toContain('AUTHENTICATING RELIC');
  });

  it('elevates the all-three state without changing ownership rules', () => {
    const moment: ThreeLocksCompleteMoment = {
      type: 'three-locks-complete', headline: 'FOUNDER RECEPTACLE ASSEMBLED', primaryText: 'THREE LOCKS COMPLETE',
    };
    const html = renderToStaticMarkup(<ThreeLocksFragmentEffect moment={moment} onDismiss={() => {}} reducedMotion />);
    expect(html).toContain('THREE LOCKS COMPLETE');
    expect(html).toContain('CONVERGENCE ACHIEVED');
    expect(html).toContain('3 OF 3 CONVERGED');
  });

  it('is an accessible dialog with a 48px action and scoped CQ styling', () => {
    const moment: ThreeLocksFragmentMoment = {
      type: 'three-locks-fragment', fragment: 'code', headline: 'FOUNDER LOCK ACQUIRED',
      primaryText: 'THE CODE', locksOwned: { mark: false, code: true, word: false },
    };
    const html = renderToStaticMarkup(<ThreeLocksFragmentEffect moment={moment} onDismiss={() => {}} reducedMotion />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('min-height: 48px');
    expect(html).toContain('cq-founder-lock-overlay');
  });
});
