import { describe, expect, it, vi } from 'vitest';
import type { GridDynamicEventInstance } from '../lib/grid/core/dynamic-event-types';
import type { GridDynamicEventPort } from '../lib/grid/server/dynamic-event-port';
import {
  listActiveGridDynamicEvents,
  startGridDynamicEvent,
} from '../lib/grid/server/dynamic-event-service';

const template = {
  id: 'district-boom',
  kind: 'economic-boom' as const,
  durationMinutes: 30,
  priority: 4,
  target: { type: 'district' as const, ids: ['arts'] },
  modifiers: [{ key: 'income', operation: 'add-bps' as const, value: 1000 }],
  tags: ['economy'],
};

function instance(overrides: Partial<GridDynamicEventInstance> = {}): GridDynamicEventInstance {
  return {
    instanceId: 'event-1',
    templateId: 'district-boom',
    cityId: 'canton-oh',
    kind: 'economic-boom',
    priority: 4,
    startsAt: '2026-09-18T04:00:00.000Z',
    endsAt: '2026-09-18T04:30:00.000Z',
    target: { type: 'district', ids: ['arts'] },
    modifiers: [{ key: 'income', operation: 'add-bps', value: 1000 }],
    tags: ['economy'],
    ...overrides,
  };
}

function fakePort(): GridDynamicEventPort {
  return {
    listActive: vi.fn(async () => []),
    insert: vi.fn(async ({ instance }) => ({ instance, duplicate: false })),
  };
}

describe('Grid dynamic event service', () => {
  it('instantiates validated templates before persistence', async () => {
    const port = fakePort();

    const result = await startGridDynamicEvent(port, template, {
      instanceId: 'event-1',
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      startsAt: '2026-09-18T04:00:00.000Z',
      idempotencyKey: 'ops:event-1',
    });

    expect(result.duplicate).toBe(false);
    expect(result.instance.endsAt).toBe('2026-09-18T04:30:00.000Z');
    expect(port.insert).toHaveBeenCalledWith({
      seasonSlug: 'founding-season',
      idempotencyKey: 'ops:event-1',
      instance: expect.objectContaining({
        instanceId: 'event-1',
        cityId: 'canton-oh',
        templateId: 'district-boom',
      }),
    });
  });

  it('returns only active events in deterministic priority order', async () => {
    const port = fakePort();
    vi.mocked(port.listActive).mockResolvedValue([
      instance({ instanceId: 'low', priority: 1 }),
      instance({ instanceId: 'ended', priority: 9, endsAt: '2026-09-18T04:05:00.000Z' }),
      instance({ instanceId: 'high', priority: 8 }),
    ]);

    const result = await listActiveGridDynamicEvents(port, {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      now: '2026-09-18T04:10:00.000Z',
    });

    expect(result.map((event) => event.instanceId)).toEqual(['high', 'low']);
  });

  it('fails closed if persistence returns an event from another city', async () => {
    const port = fakePort();
    vi.mocked(port.listActive).mockResolvedValue([
      instance({ cityId: 'akron-oh' }),
    ]);

    await expect(
      listActiveGridDynamicEvents(port, {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        now: '2026-09-18T04:10:00.000Z',
      }),
    ).rejects.toThrow(/unexpected city/);
  });

  it('rejects invalid command identity before touching persistence', async () => {
    const port = fakePort();

    await expect(
      startGridDynamicEvent(port, template, {
        instanceId: 'event-1',
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        startsAt: '2026-09-18T04:00:00.000Z',
        idempotencyKey: '   ',
      }),
    ).rejects.toThrow(/idempotencyKey/);

    expect(port.insert).not.toHaveBeenCalled();
  });
});
