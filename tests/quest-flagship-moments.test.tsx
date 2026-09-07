import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestCompleteEffect from '../components/game-effects/QuestCompleteEffect';

describe('Quest completion presentation', () => {
  it.each([false, true])('reveals the exact granted XP and entries (reduced motion: %s)', (reducedMotion) => {
    const html = renderToStaticMarkup(<QuestCompleteEffect
      moment={{ type: 'quest-complete', questTitle: 'The Signal', xpAwarded: 137, drawingEntriesAwarded: 2 }}
      onDismiss={() => {}}
      reducedMotion={reducedMotion}
    />);
    expect(html).toContain('+137');
    expect(html).toContain('+2');
    expect(html).toContain('cq-transition-reveal');
    expect(html).toContain('is-confirmed');
    expect(html).not.toContain('animate-ping');
    expect(html).not.toContain('animate-bounce');
  });

  it('does not invent entry tokens for an XP-only result', () => {
    const html = renderToStaticMarkup(<QuestCompleteEffect
      moment={{ type: 'quest-complete', questTitle: 'The Signal', xpAwarded: 0, drawingEntriesAwarded: 0 }}
      onDismiss={() => {}}
      reducedMotion
    />);
    expect(html).toContain('+0');
    expect(html).not.toContain('Entry Token');
  });
});
