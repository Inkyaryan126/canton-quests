import type {
  GridDynamicEventEntityRef,
  GridDynamicEventInstance,
  GridDynamicEventModifier,
  GridDynamicEventProjection,
  GridDynamicEventStackProjection,
  GridDynamicEventTemplate,
} from './dynamic-event-types';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} cannot be blank`);
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid timestamp`);
  return parsed;
}
function validateModifier(modifier: GridDynamicEventModifier): void {
  requireNonBlank(modifier.key, 'dynamic event modifier key');
  if (modifier.operation === 'set-flag') return;
  if (!Number.isSafeInteger(modifier.value)) {
    throw new Error(
      `dynamic event modifier ${modifier.key} value must be a safe integer`,
    );
  }
}

export function validateGridDynamicEventTemplate(
  template: GridDynamicEventTemplate,
): void {
  requireNonBlank(template.id, 'dynamic event template id');
  requirePositiveSafeInteger(
    template.durationMinutes,
    `${template.id}.durationMinutes`,
  );
  requireNonNegativeSafeInteger(template.priority, `${template.id}.priority`);

  if (template.target.type === 'city' && template.target.ids.length > 0) {
    throw new Error('citywide dynamic event targets must not include ids');
  }
  if (template.target.type !== 'city' && template.target.ids.length === 0) {
    throw new Error(
      `${template.target.type} dynamic event targets require at least one id`,
    );
  }
  const targetIds = new Set<string>();
  for (const id of template.target.ids) {
    requireNonBlank(id, 'dynamic event target id');
    if (targetIds.has(id)) {
      throw new Error(`duplicate dynamic event target id: ${id}`);
    }
    targetIds.add(id);
  }

  const modifierKeys = new Set<string>();
  for (const modifier of template.modifiers) {
    validateModifier(modifier);
    const identity = `${modifier.operation}:${modifier.key}`;
    if (modifierKeys.has(identity)) {
      throw new Error(`duplicate dynamic event modifier: ${identity}`);
    }
    modifierKeys.add(identity);
  }

  for (const tag of template.tags ?? []) {
    requireNonBlank(tag, 'dynamic event tag');
  }
}

export function instantiateGridDynamicEvent(
  template: GridDynamicEventTemplate,
  input: { instanceId: string; cityId: string; startsAt: string },
): GridDynamicEventInstance {
  validateGridDynamicEventTemplate(template);
  requireNonBlank(input.instanceId, 'dynamic event instance id');
  requireNonBlank(input.cityId, 'dynamic event city id');
  const startsAtMs = parseTimestamp(input.startsAt, 'startsAt');
  const durationMs = template.durationMinutes * 60_000;
  if (!Number.isSafeInteger(durationMs)) {
    throw new Error('dynamic event duration exceeds safe millisecond range');
  }
  const endsAtMs = startsAtMs + durationMs;
  if (!Number.isFinite(endsAtMs)) {
    throw new Error('dynamic event end timestamp is invalid');
  }

  return {
    instanceId: input.instanceId,
    templateId: template.id,
    cityId: input.cityId,
    kind: template.kind,
    priority: template.priority,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    target: {
      type: template.target.type,
      ids: [...template.target.ids],
    },
    modifiers: template.modifiers.map((modifier) => ({ ...modifier })),
    tags: [...(template.tags ?? [])],
  };
}

export function projectGridDynamicEvent(
  instance: GridDynamicEventInstance,
  now: string,
): GridDynamicEventProjection {
  const nowMs = parseTimestamp(now, 'now');
  const startsAtMs = parseTimestamp(instance.startsAt, 'instance.startsAt');
  const endsAtMs = parseTimestamp(instance.endsAt, 'instance.endsAt');

  const status =
    nowMs < startsAtMs
      ? 'scheduled'
      : nowMs >= endsAtMs
        ? 'ended'
        : 'active';

  return {
    instanceId: instance.instanceId,
    templateId: instance.templateId,
    status,
    active: status === 'active',
    startsAt: instance.startsAt,
    endsAt: instance.endsAt,
  };
}

export function gridDynamicEventAppliesTo(
  instance: GridDynamicEventInstance,
  entity: GridDynamicEventEntityRef,
): boolean {
  if (instance.cityId !== entity.cityId) return false;
  if (instance.target.type === 'city') return true;
  if (instance.target.type !== entity.type) return false;
  return instance.target.ids.includes(entity.id);
}
function addSafe(
  record: Record<string, number>,
  key: string,
  value: number,
): void {
  const next = (record[key] ?? 0) + value;
  if (!Number.isSafeInteger(next)) {
    throw new Error(`dynamic event modifier ${key} exceeds safe integer range`);
  }
  record[key] = next;
}

export function projectGridDynamicEventStack(
  instances: GridDynamicEventInstance[],
  now: string,
  entity: GridDynamicEventEntityRef,
): GridDynamicEventStackProjection {
  const active = instances
    .filter((instance) => projectGridDynamicEvent(instance, now).active)
    .filter((instance) => gridDynamicEventAppliesTo(instance, entity))
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.instanceId.localeCompare(right.instanceId),
    );

  const additiveBps: Record<string, number> = {};
  const additiveFlat: Record<string, number> = {};
  const flags: Record<string, boolean> = {};
  for (const instance of active) {
    for (const modifier of instance.modifiers) {
      if (modifier.operation === 'add-bps') {
        addSafe(additiveBps, modifier.key, modifier.value);
        continue;
      }
      if (modifier.operation === 'add-flat') {
        addSafe(additiveFlat, modifier.key, modifier.value);
        continue;
      }
      if (
        modifier.operation === 'set-flag' &&
        !(modifier.key in flags)
      ) {
        flags[modifier.key] = modifier.value;
      }
    }
  }

  return {
    activeEventIds: active.map((instance) => instance.instanceId),
    additiveBps,
    additiveFlat,
    flags,
  };
}
