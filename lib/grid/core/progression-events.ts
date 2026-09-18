import { applyGridStatDelta, createEmptyGridProgressionStats } from './progression';
import type { GridProgressionStats, GridStatKey } from './progression-types';

export interface GridProgressionEvent {
  id: string;
  seasonId: string | null;
  actorPlayerId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GridProgressionPayloadCondition {
  payloadPath: readonly string[];
  equals: string | number | boolean | null;
}

export interface GridProgressionPayloadDelta {
  stat: GridStatKey;
  payloadPath: readonly string[];
  multiplier?: number;
}

export interface GridProgressionEventRule {
  id: string;
  eventType: string;
  when?: readonly GridProgressionPayloadCondition[];
  delta?: Partial<GridProgressionStats>;
  payloadDeltas?: readonly GridProgressionPayloadDelta[];
}

export interface GridProgressionEventPolicy {
  version: 1;
  rules: readonly GridProgressionEventRule[];
}

export interface GridProgressionEventReduction {
  stats: GridProgressionStats;
  sourceEventIds: string[];
  appliedEventIds: string[];
  ignoredEventIds: string[];
}

/**
 * Canonical zero-magic-number facts that can be derived directly from immutable
 * Grid events. Tuned XP/reputation/score awards belong in an explicit season policy.
 */
export const GRID_CANONICAL_PROGRESSION_EVENT_POLICY: GridProgressionEventPolicy = {
  version: 1,
  rules: [
    {
      id: 'neutral-territory-capture-count',
      eventType: 'grid:territory_claimed',
      delta: { territoriesCaptured: 1 },
    },
    {
      id: 'contest-territory-capture-count',
      eventType: 'grid:contest_session_round_resolved',
      when: [{ payloadPath: ['territoryCaptured'], equals: true }],
      delta: { territoriesCaptured: 1 },
    },
  ],
};

function payloadValue(payload: Record<string, unknown>, path: readonly string[]): unknown {
  let value: unknown = payload;
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function matchesRule(event: GridProgressionEvent, rule: GridProgressionEventRule): boolean {
  if (event.eventType !== rule.eventType) return false;
  return (rule.when ?? []).every(
    (condition) => payloadValue(event.payload, condition.payloadPath) === condition.equals,
  );
}

function effectiveDelta(
  event: GridProgressionEvent,
  rule: GridProgressionEventRule,
): Partial<GridProgressionStats> {
  const delta: Partial<GridProgressionStats> = { ...(rule.delta ?? {}) };

  for (const source of rule.payloadDeltas ?? []) {
    const raw = payloadValue(event.payload, source.payloadPath);
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) continue;

    const multiplier = source.multiplier ?? 1;
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      throw new Error(`invalid progression multiplier for rule ${rule.id}`);
    }

    const value = raw * multiplier;
    if (!Number.isFinite(value) || value < 0) continue;
    delta[source.stat] = (delta[source.stat] ?? 0) + value;
  }

  return delta;
}

function hasPositiveDelta(delta: Partial<GridProgressionStats>): boolean {
  return Object.values(delta).some(
    (value) => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
}

function compareEvents(a: GridProgressionEvent, b: GridProgressionEvent): number {
  const time = a.createdAt.localeCompare(b.createdAt);
  return time !== 0 ? time : a.id.localeCompare(b.id);
}

export function orderGridProgressionEvents(
  events: readonly GridProgressionEvent[],
): GridProgressionEvent[] {
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) throw new Error(`duplicate Grid progression event id: ${event.id}`);
    seen.add(event.id);
  }
  return [...events].sort(compareEvents);
}

export function reduceGridProgressionEvents(
  events: readonly GridProgressionEvent[],
  playerId: string,
  policy: GridProgressionEventPolicy = GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
): GridProgressionEventReduction {
  const ordered = orderGridProgressionEvents(events).filter(
    (event) => event.actorPlayerId === playerId,
  );

  let stats = createEmptyGridProgressionStats();
  const appliedEventIds: string[] = [];
  const ignoredEventIds: string[] = [];

  for (const event of ordered) {
    let eventApplied = false;
    for (const rule of policy.rules) {
      if (!matchesRule(event, rule)) continue;
      const delta = effectiveDelta(event, rule);
      if (!hasPositiveDelta(delta)) continue;
      stats = applyGridStatDelta(stats, delta);
      eventApplied = true;
    }

    if (eventApplied) appliedEventIds.push(event.id);
    else ignoredEventIds.push(event.id);
  }

  return {
    stats,
    sourceEventIds: ordered.map((event) => event.id),
    appliedEventIds,
    ignoredEventIds,
  };
}
