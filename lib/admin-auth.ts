// Canton Quests — Admin Security & Game Master Authorization Layer (Phase 5.1 Spectator Engine)

import { UserRole } from './types';

export const ADMIN_COOKIE_NAME = 'cg_admin_session';

export interface AdminSession {
  isAdmin: boolean;
  adminName: string;
  role: UserRole;
}

/**
 * Validates whether a given passphrase or secret key grants Game Master access.
 * Server-side evaluation.
 */
export function verifyAdminSecret(passphrase?: string): boolean {
  if (!passphrase) return false;
  const clean = passphrase.trim();
  const envSecret = process.env.ADMIN_SECRET_KEY;

  if (envSecret) {
    return clean === envSecret;
  }

  // In development and test environments, allow standard test passphrases when ADMIN_SECRET_KEY is not set.
  if (process.env.NODE_ENV !== 'production') {
    return clean === 'canton-gm-2026' || clean === 'canton-admin-pass-2026' || clean === 'gm-super-2026';
  }

  return false;
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
