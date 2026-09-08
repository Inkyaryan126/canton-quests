import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OperationEntry, { getOperationEntryLabel } from '../components/game-effects/OperationEntry';
import { SEED_EVENT } from '../lib/seed-data';
import type { QuestEvent } from '../lib/types';

const event = (overrides: Partial<QuestEvent> = {}): QuestEvent => ({
  ...SEED_EVENT,
  status: 'active',
  currentPhase: 'day_1',
  startTime: '2026-09-11T18:00:00Z',
  endTime: '2026-09-14T18:00:00Z',
  isPaused: false,
  ...overrides,
});

describe('Operation entry uses the actual mission lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each([
    ['draft', 'MISSION DRAFT'],
    ['ready', 'MISSION READY'],
    ['upcoming', 'MISSION UPCOMING'],
    ['active', 'MISSION ACTIVE'],
    ['ended', 'MISSION ENDED'],
  ] as const)('presents %s without implying a gameplay unlock', (status, label) => {
    expect(getOperationEntryLabel(event({ status }))).toBe(label);
  });

  it('honors actual timing for published and active operations', () => {
    expect(getOperationEntryLabel(event({ status: 'published', startTime: '2026-09-13T18:00:00Z' }))).toBe('MISSION PUBLISHED');
    expect(getOperationEntryLabel(event({ startTime: '2026-09-13T18:00:00Z' }))).toBe('MISSION UPCOMING');
    expect(getOperationEntryLabel(event({ endTime: '2026-09-11T18:00:00Z' }))).toBe('MISSION ENDED');
  });

  it('preserves finale and pause signals and never calls an ended operation active', () => {
    expect(getOperationEntryLabel(event({ currentPhase: 'finale' }))).toBe('MISSION FINALE');
    expect(getOperationEntryLabel(event({ isPaused: true }))).toBe('MISSION PAUSED');
    expect(getOperationEntryLabel(event({ status: 'ended', isPaused: true }))).toBe('MISSION ENDED');
  });

  it('renders the provided title without mutating event data', () => {
    const operation = Object.freeze(event());
    const before = JSON.stringify(operation);
    const markup = renderToStaticMarkup(
      <OperationEntry event={operation} loading={false} complete={false} onComplete={() => {}}>
        <p>Existing mission content</p>
      </OperationEntry>,
    );
    expect(markup).toContain('BRIEFING RECEIVED');
    expect(markup).toContain('MISSION ACTIVE');
    expect(markup).toContain('cq-hud-system-state');
    expect(markup).toContain('cq-transition-reveal');
    expect(JSON.stringify(operation)).toBe(before);
    expect(markup).toContain(renderToStaticMarkup(<h1>{operation.title}</h1>).slice(4, -5));
  });

  it('starts hydration with a static, reduced-motion-safe signal and an accessible skip', () => {
    const markup = renderToStaticMarkup(
      <OperationEntry event={null} loading complete={false} onComplete={() => {}}>
        <a href="#rules">Existing rules</a>
      </OperationEntry>,
    );
    expect(markup).toContain('data-reduced-motion="true"');
    expect(markup).toContain('ACQUIRING MISSION SIGNAL');
    expect(markup).toContain('[▓▓▓▓▓▓▓▓▓▓]');
    expect(markup).not.toContain('animate-pulse');
    expect(markup).toContain('transition:none');
    expect(markup).toContain('Skip startup');
    expect(markup).toContain('min-height:48px');
    expect(markup).toContain('hidden=""');
    expect(markup).not.toContain('MISSION ACTIVE');
  });

  it('removes startup entirely after handoff while retaining unmodified page children', () => {
    const children = <main><a href="/events/canton-weekend-1/quests">Quest list</a><p>Existing event rules</p></main>;
    const markup = renderToStaticMarkup(
      <OperationEntry event={event()} loading={false} complete onComplete={() => {}}>{children}</OperationEntry>,
    );
    expect(markup).toContain(renderToStaticMarkup(children));
    expect(markup).not.toContain('cq-operation-entry');
    expect(markup).not.toContain('hidden=');
    expect(markup).not.toContain('cq-transition-reveal');
  });
});
