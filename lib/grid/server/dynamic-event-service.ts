import {
  instantiateGridDynamicEvent,
  projectGridDynamicEvent,
} from '../core/dynamic-events';
import type {
  GridDynamicEventInstance,
  GridDynamicEventTemplate,
} from '../core/dynamic-event-types';
import type {
  GridDynamicEventInsertResult,
  GridDynamicEventPort,
} from './dynamic-event-port';

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid dynamic event requires ${field}`);
  }
  return normalized;
}

function requireTimestamp(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Grid dynamic event requires valid ${field}`);
  }
  return value;
}

export async function listActiveGridDynamicEvents(
  port: GridDynamicEventPort,
  input: {
    citySlug: string;
    seasonSlug: string;
    now: string;
  },
): Promise<GridDynamicEventInstance[]> {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  const now = requireTimestamp(input.now, 'now');

  const instances = await port.listActive(citySlug, seasonSlug, now);

  return instances
    .filter((instance) => {
      if (instance.cityId !== citySlug) {
        throw new Error(
          `Grid dynamic event ${instance.instanceId} belongs to unexpected city ${instance.cityId}`,
        );
      }
      return projectGridDynamicEvent(instance, now).active;
    })
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.startsAt.localeCompare(right.startsAt) ||
        left.instanceId.localeCompare(right.instanceId),
    );
}

export async function startGridDynamicEvent(
  port: GridDynamicEventPort,
  template: GridDynamicEventTemplate,
  input: {
    instanceId: string;
    citySlug: string;
    seasonSlug: string;
    startsAt: string;
    idempotencyKey: string;
  },
): Promise<GridDynamicEventInsertResult> {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  const idempotencyKey = requireText(input.idempotencyKey, 'idempotencyKey');
  requireTimestamp(input.startsAt, 'startsAt');

  const instance = instantiateGridDynamicEvent(template, {
    instanceId: requireText(input.instanceId, 'instanceId'),
    cityId: citySlug,
    startsAt: input.startsAt,
  });

  const result = await port.insert({
    seasonSlug,
    instance,
    idempotencyKey,
  });

  if (
    result.instance.instanceId !== instance.instanceId ||
    result.instance.cityId !== instance.cityId
  ) {
    throw new Error('Grid dynamic event persistence returned mismatched identity');
  }

  return result;
}
