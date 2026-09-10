// Canton Quests — Founder's Cipher Prelaunch Player Access Gate
//
// Replaces the old "Admin Field Test Mode" concept for the Founder's Cipher
// specifically. There is no special admin gameplay anymore: a private
// password, checked against the server-only FOUNDER_CIPHER_PRELAUNCH_PASSWORD
// environment variable, is the ONLY way to see real Founder's Cipher
// gameplay content before the event's real startTime. Once granted, the
// browser is treated exactly like a normal post-launch player — this module
// only ever answers "is prelaunch content visible to this request," never
// "should this request get special verification/reward treatment."
//
// The password itself is never persisted anywhere (not in the cookie, not in
// a database row). The cookie carries a short-lived token: an expiry
// timestamp signed with a key derived from the password (SHA-256 of the
// password, never the password itself), so forging or extending a token
// requires knowing the real password. No next/headers import here so this
// module stays safe to import from any context; the actual httpOnly/Secure
// cookie attributes are set by the route handler that owns the response.

import crypto from 'crypto';
import { QuestEvent } from './types';
import { isPreLaunchEvent, isKnownCantonLaunchSlug } from './launch-status';

export const FOUNDER_CIPHER_PRELAUNCH_COOKIE = 'cq_founder_cipher_prelaunch';

const TOKEN_VERSION = 'v1';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h — long enough for a rehearsal session, short enough to expire on its own if never cleaned up.

function getSigningKey(): string | null {
  const password = process.env.FOUNDER_CIPHER_PRELAUNCH_PASSWORD;
  if (!password) return null;
  return crypto.createHash('sha256').update(password).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Whether the given input matches the server-only prelaunch password.
 * Returns false (never throws) when the environment variable is unset —
 * an unconfigured password means the gate simply cannot be opened, not
 * that it falls open.
 */
export function verifyPrelaunchPassword(input?: string): boolean {
  const password = process.env.FOUNDER_CIPHER_PRELAUNCH_PASSWORD;
  if (!password || !input) return false;
  return timingSafeStringEqual(input.trim(), password);
}

function sign(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

/**
 * Mints a signed, tamper-resistant prelaunch access token. Only ever called
 * after verifyPrelaunchPassword has already succeeded on this same request —
 * this function does not itself check the password.
 */
export function createPrelaunchAccessToken(now: number = Date.now()): string {
  const key = getSigningKey();
  if (!key) throw new Error('FOUNDER_CIPHER_PRELAUNCH_PASSWORD is not configured.');
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Verifies a token's signature and expiry. Returns false for any malformed,
 * tampered, expired, or (if the password env var has since been unset)
 * unverifiable token — fail closed in every case.
 */
export function verifyPrelaunchAccessToken(token?: string | null, now: number = Date.now()): boolean {
  if (!token) return false;
  const key = getSigningKey();
  if (!key) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, expiresAtStr, signature] = parts;
  if (version !== TOKEN_VERSION) return false;

  const payload = `${version}.${expiresAtStr}`;
  const expectedSignature = sign(payload, key);
  if (!timingSafeStringEqual(signature, expectedSignature)) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || now > expiresAt) return false;

  return true;
}

function readCookieFromRequest(request: Request, cookieName: string): string | undefined {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name !== cookieName) continue;
    const value = part.slice(eqIdx + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * Whether this exact request already carries a valid, unexpired prelaunch
 * access token. Never trusts anything client-supplied beyond the cookie
 * itself — there is no query-string or header override.
 */
export function resolvePrelaunchAccessFromRequest(request: Request): boolean {
  const token = readCookieFromRequest(request, FOUNDER_CIPHER_PRELAUNCH_COOKIE);
  return verifyPrelaunchAccessToken(token);
}

/**
 * Server-authoritative Founder's Cipher prelaunch gate, shared by every
 * endpoint that exposes or mutates Founder's Cipher gameplay. Scoped
 * specifically to the Founder's Cipher launch context (isKnownCantonLaunchSlug)
 * — any other Operation's prelaunch state is reported as pre-launch with no
 * bypass available, since this password only ever unlocks the Founder's
 * Cipher.
 */
export function resolveFounderCipherPrelaunchAccess(
  request: Request,
  event?: QuestEvent | null,
  slug?: string | null,
  currentTime?: Date | string | number
): { isPreLaunch: boolean; hasPrelaunchAccess: boolean } {
  const isPreLaunch = isPreLaunchEvent(event, slug, currentTime);
  if (!isPreLaunch) return { isPreLaunch: false, hasPrelaunchAccess: false };
  if (!isKnownCantonLaunchSlug(slug)) return { isPreLaunch: true, hasPrelaunchAccess: false };
  return { isPreLaunch: true, hasPrelaunchAccess: resolvePrelaunchAccessFromRequest(request) };
}

/**
 * Convenience wrapper for endpoints that only need a yes/no "is this request
 * blocked" answer (quest submission, finale, district decode, secret code —
 * every Founder's Cipher mutation surface). `event` should be the specific
 * event this request concerns; its own `.slug` drives the Founder's-Cipher
 * scoping above.
 */
export function isFounderCipherPrelaunchBlocked(request: Request, event?: QuestEvent | null): boolean {
  const { isPreLaunch, hasPrelaunchAccess } = resolveFounderCipherPrelaunchAccess(request, event, event?.slug);
  return isPreLaunch && !hasPrelaunchAccess;
}
