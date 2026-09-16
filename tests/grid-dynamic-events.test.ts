import { describe, expect, it } from 'vitest';
import {
  gridDynamicEventAppliesTo,
  instantiateGridDynamicEvent,
  projectGridDynamicEvent,
  projectGridDynamicEventStack,
  validateGridDynamicEventTemplate,
} from '../lib/grid/core/dynamic-events';
import type {
  GridDynamicEventInstance,
  GridDynamicEventTemplate,
} from '../lib/grid/core/dynamic-event-types';

const economicBoom: GridDynamicEventTemplate = {
  id: 'economic-boom',
  kind: 'economic-boom',
  durationMinutes: 120,
  priority: 10,
  target: { type: 'city', ids: [] },
  modifiers: [
    { key: 'credits-income', operation: 'add-bps', value: 1_000 },
    { key: 'development-cost', operation: 'add-bps', value: -500 },
    { key: 'featured', operation: 'set-flag', value: true },
  ],
  tags: ['economy', 'citywide'],
};

describe('Grid dynamic events', () => {
  it('instantiates an immutable scheduled event from a city-agnostic template', () => {
    const instance = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'boom-001',
      cityId: 'city-001',
      startsAt: '2026-09-16T18:00:00Z',
    });

    expect(instance.startsAt).toBe('2026-09-16T18:00:00.000Z');
    expect(instance.endsAt).toBe('2026-09-16T20:00:00.000Z');
    expect(instance.target).not.toBe(economicBoom.target);
    expect(instance.modifiers).not.toBe(economicBoom.modifiers);

    instance.target.ids.push('mutated');
    instance.tags.push('mutated');
    expect(economicBoom.target.ids).toEqual([]);
    expect(economicBoom.tags).toEqual(['economy', 'citywide']);
  });

  it('uses start-inclusive and end-exclusive timing boundaries', () => {
    const instance = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'boom-002',
      cityId: 'city-001',
      startsAt: '2026-09-16T18:00:00Z',
    });
    expect(projectGridDynamicEvent(instance, '2026-09-16T17:59:59Z').status)
      .toBe('scheduled');
    expect(projectGridDynamicEvent(instance, '2026-09-16T18:00:00Z').status)
      .toBe('active');
    expect(projectGridDynamicEvent(instance, '2026-09-16T19:59:59Z').status)
      .toBe('active');
    expect(projectGridDynamicEvent(instance, '2026-09-16T20:00:00Z').status)
      .toBe('ended');
  });

  it('applies citywide events across entity types but never across cities', () => {
    const instance = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'boom-003',
      cityId: 'city-001',
      startsAt: '2026-09-16T18:00:00Z',
    });

    expect(gridDynamicEventAppliesTo(instance, {
      cityId: 'city-001',
      type: 'territory',
      id: 'territory-a',
    })).toBe(true);
    expect(gridDynamicEventAppliesTo(instance, {
      cityId: 'city-002',
      type: 'territory',
      id: 'territory-a',
    })).toBe(false);
  });
  it('matches scoped events only to the declared target ids', () => {
    const scoped = instantiateGridDynamicEvent(
      {
        ...economicBoom,
        id: 'landmark-crisis',
        kind: 'landmark-crisis',
        target: { type: 'landmark', ids: ['landmark-a', 'landmark-b'] },
      },
      {
        instanceId: 'crisis-001',
        cityId: 'city-001',
        startsAt: '2026-09-16T18:00:00Z',
      },
    );

    expect(gridDynamicEventAppliesTo(scoped, {
      cityId: 'city-001',
      type: 'landmark',
      id: 'landmark-a',
    })).toBe(true);
    expect(gridDynamicEventAppliesTo(scoped, {
      cityId: 'city-001',
      type: 'landmark',
      id: 'landmark-c',
    })).toBe(false);
    expect(gridDynamicEventAppliesTo(scoped, {
      cityId: 'city-001',
      type: 'property',
      id: 'landmark-a',
    })).toBe(false);
  });
  it('stacks active modifiers deterministically and lets higher priority own flags', () => {
    const low = instantiateGridDynamicEvent(
      {
        ...economicBoom,
        id: 'low',
        priority: 10,
        modifiers: [
          { key: 'credits-income', operation: 'add-bps', value: 500 },
          { key: 'bonus-cache', operation: 'add-flat', value: 2 },
          { key: 'featured', operation: 'set-flag', value: false },
        ],
      },
      {
        instanceId: 'low-event',
        cityId: 'city-001',
        startsAt: '2026-09-16T18:00:00Z',
      },
    );
    const high = instantiateGridDynamicEvent(
      {
        ...economicBoom,
        id: 'high',
        priority: 20,
        modifiers: [
          { key: 'credits-income', operation: 'add-bps', value: 750 },
          { key: 'bonus-cache', operation: 'add-flat', value: 3 },
          { key: 'featured', operation: 'set-flag', value: true },
        ],
      },
      {
        instanceId: 'high-event',
        cityId: 'city-001',
        startsAt: '2026-09-16T18:00:00Z',
      },
    );

    const stack = projectGridDynamicEventStack(
      [low, high],
      '2026-09-16T18:30:00Z',
      {
        cityId: 'city-001',
        type: 'territory',
        id: 'territory-a',
      },
    );

    expect(stack.activeEventIds).toEqual(['high-event', 'low-event']);
    expect(stack.additiveBps).toEqual({ 'credits-income': 1_250 });
    expect(stack.additiveFlat).toEqual({ 'bonus-cache': 5 });
    expect(stack.flags).toEqual({ featured: true });
  });

  it('ignores scheduled, ended, and nonmatching events when stacking', () => {
    const scheduled = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'scheduled',
      cityId: 'city-001',
      startsAt: '2026-09-16T22:00:00Z',
    });
    const ended = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'ended',
      cityId: 'city-001',
      startsAt: '2026-09-16T12:00:00Z',
    });
    const otherCity = instantiateGridDynamicEvent(economicBoom, {
      instanceId: 'other-city',
      cityId: 'city-002',
      startsAt: '2026-09-16T18:00:00Z',
    });

    const stack = projectGridDynamicEventStack(
      [scheduled, ended, otherCity],
      '2026-09-16T19:00:00Z',
      {
        cityId: 'city-001',
        type: 'property',
        id: 'property-a',
      },
    );

    expect(stack).toEqual({
      activeEventIds: [],
      additiveBps: {},
      additiveFlat: {},
      flags: {},
    });
  });

  it('rejects malformed targets, duplicate modifiers, and blank tags', () => {
    expect(() =>
      validateGridDynamicEventTemplate({
        ...economicBoom,
        target: { type: 'city', ids: ['not-allowed'] },
      }),
    ).toThrow(/citywide dynamic event targets must not include ids/);

    expect(() =>
      validateGridDynamicEventTemplate({
        ...economicBoom,
        target: { type: 'territory', ids: [] },
      }),
    ).toThrow(/require at least one id/);

    expect(() =>
      validateGridDynamicEventTemplate({
        ...economicBoom,
        target: { type: 'territory', ids: ['a', 'a'] },
      }),
    ).toThrow(/duplicate dynamic event target id/);

    expect(() =>
      validateGridDynamicEventTemplate({
        ...economicBoom,
        modifiers: [
          { key: 'credits-income', operation: 'add-bps', value: 1 },
          { key: 'credits-income', operation: 'add-bps', value: 2 },
        ],
      }),
    ).toThrow(/duplicate dynamic event modifier/);
    expect(() =>
      validateGridDynamicEventTemplate({
        ...economicBoom,
        tags: ['economy', ' '],
      }),
    ).toThrow(/dynamic event tag cannot be blank/);
  });

  it('rejects invalid timestamps and unsafe accumulated modifiers', () => {
    expect(() =>
      instantiateGridDynamicEvent(economicBoom, {
        instanceId: 'bad-time',
        cityId: 'city-001',
        startsAt: 'not-a-date',
      }),
    ).toThrow(/startsAt must be a valid timestamp/);

    const first: GridDynamicEventInstance = {
      ...instantiateGridDynamicEvent(economicBoom, {
        instanceId: 'overflow-a',
        cityId: 'city-001',
        startsAt: '2026-09-16T18:00:00Z',
      }),
      modifiers: [
        {
          key: 'overflow',
          operation: 'add-flat',
          value: Number.MAX_SAFE_INTEGER,
        },
      ],
    };
    const second: GridDynamicEventInstance = {
      ...first,
      instanceId: 'overflow-b',
      modifiers: [{ key: 'overflow', operation: 'add-flat', value: 1 }],
    };

    expect(() =>
      projectGridDynamicEventStack(
        [first, second],
        '2026-09-16T18:30:00Z',
        {
          cityId: 'city-001',
          type: 'territory',
          id: 'territory-a',
        },
      ),
    ).toThrow(/exceeds safe integer range/);
  });
});
