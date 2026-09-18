import { createHash } from 'node:crypto';
import type { GridWorldRevisionPort } from './world-revision-port';

export interface GridWorldRevisionSignal {
  available: boolean;
  revision: string | null;
  changedAt: string | null;
  seasonStatus: string | null;
  recommendedPollMs: number;
}

const ACTIVE_POLL_MS = 5_000;
const IDLE_POLL_MS = 30_000;

function requireSlug(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Grid world revision requires ${label}`);
  return trimmed;
}

function requireTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Grid world revision encountered invalid ${label}`);
  }
}

function opaqueRevision(parts: string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('base64url').slice(0, 24);
}

export async function readGridWorldRevision(
  port: GridWorldRevisionPort,
  citySlug: string,
  seasonSlug: string,
): Promise<GridWorldRevisionSignal> {
  const city = requireSlug(citySlug, 'citySlug');
  const season = requireSlug(seasonSlug, 'seasonSlug');
  const state = await port.readRevisionState(city, season);

  if (!state) {
    return {
      available: false,
      revision: null,
      changedAt: null,
      seasonStatus: null,
      recommendedPollMs: IDLE_POLL_MS,
    };
  }

  requireTimestamp(state.seasonUpdatedAt, 'seasonUpdatedAt');
  if (state.latestEventAt) requireTimestamp(state.latestEventAt, 'latestEventAt');

  const changedAt = state.latestEventAt ?? state.seasonUpdatedAt;
  const recommendedPollMs = ['active', 'surge'].includes(state.seasonStatus)
    ? ACTIVE_POLL_MS
    : IDLE_POLL_MS;

  return {
    available: true,
    revision: opaqueRevision([
      state.seasonId,
      state.seasonStatus,
      state.seasonUpdatedAt,
      state.latestEventId ?? '',
      state.latestEventAt ?? '',
    ]),
    changedAt,
    seasonStatus: state.seasonStatus,
    recommendedPollMs,
  };
}
