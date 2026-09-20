// Canton Quests — Admin Security & Game Master Authorization Layer (Phase 5.1 Spectator Engine)

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { UserRole } from './types';

export const ADMIN_COOKIE_NAME = 'cg_admin_session';

// Local, development-only ephemeral session token TTL (12 hours).
const LOCAL_GM_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// Generated once per process, held only in server memory, and never derived
// from ADMIN_SECRET_KEY or any hardcoded passphrase. This lets a local Boss
// Panel launch mint a signed session cookie without ever writing a secret
// value into the cookie itself. It intentionally does not survive a process
// restart, keeping the token ephemeral.
const localGameMasterSigningKey = crypto.randomBytes(32);

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

function signLocalGameMasterPayload(payloadB64: string): string {
  return crypto.createHmac('sha256', localGameMasterSigningKey).update(payloadB64).digest('base64url');
}

/**
 * Mints a development-only, ephemeral, signed Game Master session token.
 *
 * The token carries no secret material — only an issued-at/expiry payload —
 * so it is safe to place in a cookie. It is signed with a per-process random
 * key (see localGameMasterSigningKey) that is never persisted or derived
 * from ADMIN_SECRET_KEY or any hardcoded fallback passphrase. This exists so
 * a local Boss Panel launch can authenticate without writing ADMIN_SECRET_KEY
 * or a fallback passphrase into the cookie.
 *
 * Returns null in production: this primitive is fail-closed outside of
 * local development regardless of how it is invoked.
 */
export function createLocalGameMasterSessionToken(): string | null {
  if (process.env.NODE_ENV === 'production') return null;

  const now = Date.now();
  const payload = { iat: now, exp: now + LOCAL_GM_SESSION_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signLocalGameMasterPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a token minted by createLocalGameMasterSessionToken.
 *
 * Fails closed in production and on any malformed, unsigned, mis-signed, or
 * expired token. Never throws.
 */
export function verifyLocalGameMasterSessionToken(token?: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  try {
    const expectedSignature = signLocalGameMasterPayload(payloadB64);
    const actual = Buffer.from(signature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (actual.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(actual, expected)) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      iat?: number;
      exp?: number;
    };
    if (typeof payload.exp !== 'number') return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
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
 * httpOnly admin session cookie, accepting either a local ephemeral session
 * token (verifyLocalGameMasterSessionToken) or a raw passphrase
 * (verifyAdminSecret), matching the pattern already duplicated inline in
 * app/api/admin/drawing/route.ts and app/api/admin/live/route.ts.
 * New/updated admin routes should call this instead of re-implementing the
 * same checks locally.
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
    if (adminCookie && (verifyLocalGameMasterSessionToken(adminCookie) || verifyAdminSecret(adminCookie))) {
      return { isAdmin: true, adminName: 'Game Master', role: 'admin' };
    }
  } catch {
    // Ignore when running outside Next.js request scope (e.g. direct unit-test invocation).
  }

  return { isAdmin: false, adminName: 'Guest', role: 'player' };
}
