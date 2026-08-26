// Canton Quests — Admin Security & Game Master Authorization Layer (Phase 5.1 Spectator Engine)

import { cookies } from 'next/headers';
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

/**
 * Canonical server-side admin session resolver for API routes — checks both
 * the x-admin-key/Authorization header (authorizeGameMasterRequest) and the
 * httpOnly admin session cookie (verifyAdminSecret), matching the pattern
 * already duplicated inline in app/api/admin/drawing/route.ts and
 * app/api/admin/live/route.ts. New/updated admin routes should call this
 * instead of re-implementing the same two checks locally.
 */
export function resolveAdminSessionFromRequest(request: Request): AdminSession {
  const headersObj: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headersObj[key] = val;
  });
  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) {
    return headerSession;
  }

  try {
    const cookieStore = cookies();
    const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (adminCookie && verifyAdminSecret(adminCookie)) {
      return { isAdmin: true, adminName: 'Game Master', role: 'admin' };
    }
  } catch {
    // Ignore when running outside Next.js request scope (e.g. direct unit-test invocation).
  }

  return { isAdmin: false, adminName: 'Guest', role: 'player' };
}
