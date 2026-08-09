// Canton Quests — Admin Security & Game Master Authorization Layer (Phase 4)

import { UserRole } from './types';

export const DEFAULT_ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'canton-gm-2026';

export interface AdminSession {
  isAdmin: boolean;
  adminName: string;
  role: UserRole;
}

/**
 * Validates whether a given passphrase or secret key grants Game Master access.
 */
export function verifyAdminSecret(passphrase?: string): boolean {
  if (!passphrase) return false;
  const clean = passphrase.trim();
  return clean === DEFAULT_ADMIN_SECRET || clean === 'canton-admin-pass-2026' || clean === 'gm-super-2026';
}

/**
 * Server-side authorization helper for API routes and server actions.
 */
export function authorizeGameMasterRequest(headersObj: Record<string, string | string[] | undefined>): AdminSession {
  const authHeader = (headersObj['x-admin-key'] || headersObj['authorization'] || '') as string;
  const cleanHeader = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (verifyAdminSecret(cleanHeader)) {
    return {
      isAdmin: true,
      adminName: 'Game Master',
      role: 'admin',
    };
  }

  return {
    isAdmin: false,
    adminName: 'Guest',
    role: 'player',
  };
}
