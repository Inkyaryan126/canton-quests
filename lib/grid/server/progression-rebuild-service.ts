import { createHash } from 'node:crypto';
import {
  GRID_CANONICAL_PROGRESSION_EVENT_POLICY,
  orderGridProgressionEvents,
  reduceGridProgressionEvents,
  type GridProgressionEvent,
  type GridProgressionEventPolicy,
} from '../core/progression-events';
import { buildGridProgressionSnapshot } from '../core/progression';
import type {
  GridProgressionEventReadPort,
  GridProgressionProjectionSource,
  GridProgressionProjectionWritePort,
  GridSeasonProgressionProjection,
} from './progression-rebuild-port';

export interface GridProgressionRebuildPorts {
  read: GridProgressionEventReadPort;
  write: GridProgressionProjectionWritePort;
}

export interface GridProgressionRebuildCommand {
  seasonId: string;
  playerId: string;
  policy?: GridProgressionEventPolicy;
}

export interface GridProgressionRebuildResult {
  season: GridSeasonProgressionProjection;
  lifetime: GridProgressionProjectionSource;
  seasonApplied: boolean;
  lifetimeApplied: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function sourceFingerprint(events: readonly GridProgressionEvent[]): string {
  const ordered = orderGridProgressionEvents(events);
  return sha256(ordered.map((event) => event.id).join('\n'));
}

function sourceLastEventAt(events: readonly GridProgressionEvent[]): string | null {
  const ordered = orderGridProgressionEvents(events);
  return ordered.length > 0 ? ordered[ordered.length - 1].createdAt : null;
}

function buildProjection(
  events: readonly GridProgressionEvent[],
  playerId: string,
  policy: GridProgressionEventPolicy,
): GridProgressionProjectionSource {
  const reduction = reduceGridProgressionEvents(events, playerId, policy);
  const actorEvents = orderGridProgressionEvents(events).filter(
    (event) => event.actorPlayerId === playerId,
  );

  return {
    playerId,
    sourceEventCount: reduction.sourceEventIds.length,
    sourceEventFingerprint: sourceFingerprint(actorEvents),
    policyFingerprint: sha256(stableJson(policy)),
    sourceLastEventAt: sourceLastEventAt(actorEvents),
    snapshot: buildGridProgressionSnapshot(reduction.stats),
  };
}

export async function rebuildGridPlayerProgression(
  ports: GridProgressionRebuildPorts,
  command: GridProgressionRebuildCommand,
): Promise<GridProgressionRebuildResult> {
  if (!command.seasonId.trim() || !command.playerId.trim()) {
    throw new Error('Grid progression rebuild requires seasonId and playerId');
  }

  const policy = command.policy ?? GRID_CANONICAL_PROGRESSION_EVENT_POLICY;
  const [seasonEvents, lifetimeEvents] = await Promise.all([
    ports.read.getSeasonPlayerEvents(command.seasonId, command.playerId),
    ports.read.getLifetimePlayerEvents(command.playerId),
  ]);

  const seasonBase = buildProjection(seasonEvents, command.playerId, policy);
  const lifetime = buildProjection(lifetimeEvents, command.playerId, policy);
  const season: GridSeasonProgressionProjection = {
    ...seasonBase,
    seasonId: command.seasonId,
  };

  const [seasonWrite, lifetimeWrite] = await Promise.all([
    ports.write.replaceSeasonProjection(season),
    ports.write.replaceLifetimeProjection(lifetime),
  ]);

  return {
    season,
    lifetime,
    seasonApplied: seasonWrite.applied,
    lifetimeApplied: lifetimeWrite.applied,
  };
}
