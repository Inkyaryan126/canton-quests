import { validateOfflineDefensePolicy } from '../core/offline-defense';
import type {
  GridOfflineDefensePolicyPort,
  GridOfflineDefensePolicyState,
  GridSetOfflineDefensePolicyCommand,
  GridSetOfflineDefensePolicyResult,
} from './offline-defense-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid offline defense requires ${label}`);
  }
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid offline defense requires a valid now timestamp');
  }
}

export async function getGridOfflineDefensePolicy(
  port: GridOfflineDefensePolicyPort,
  seasonId: string,
  playerId: string,
): Promise<GridOfflineDefensePolicyState | null> {
  requireNonBlank(seasonId, 'seasonId');
  requireNonBlank(playerId, 'playerId');

  return port.getPolicy(seasonId, playerId);
}

export async function setGridOfflineDefensePolicy(
  port: GridOfflineDefensePolicyPort,
  command: GridSetOfflineDefensePolicyCommand,
): Promise<GridSetOfflineDefensePolicyResult> {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.playerId, 'playerId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(command.now);
  validateOfflineDefensePolicy(command.policy);

  return port.setPolicy(command);
}
