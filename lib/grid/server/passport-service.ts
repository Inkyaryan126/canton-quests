import { projectGridPassport } from '../core/passport';
import type { GridPassportProjection } from '../core/passport-types';
import type { GridPassportPersistencePort } from './passport-port';

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Grid Passport rebuild requires ' + field);
  return normalized;
}

export async function rebuildGridPassport(
  port: GridPassportPersistencePort,
  playerId: string,
  rebuiltAt: string,
): Promise<GridPassportProjection> {
  const normalizedPlayerId = requireValue(playerId, 'playerId');
  if (!Number.isFinite(Date.parse(rebuiltAt))) {
    throw new Error('Grid Passport rebuild requires a valid rebuiltAt timestamp');
  }

  const events = await port.listCareerEvents(normalizedPlayerId);
  const projection = projectGridPassport(events);
  await port.saveProjection(normalizedPlayerId, projection, rebuiltAt);
  return projection;
}
