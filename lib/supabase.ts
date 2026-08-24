// Supabase Client Integration with dev-safe fallback

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
    supabaseAnonKey &&
    supabaseAnonKey.length > 20
);

export const isSupabaseAdminConfigured = Boolean(
  isSupabaseConfigured && serviceRoleKey && serviceRoleKey.length > 20
);

/**
 * Next.js's App Router patches the global `fetch` to cache requests by
 * default. Supabase-js's REST calls go through that same global fetch, so
 * without explicitly opting out, player reads (e.g. getPlayerByIdDB) can
 * silently serve a stale cached row after a write — even on routes marked
 * `dynamic = 'force-dynamic'`, since that only governs the route segment's
 * own default, not every fetch Next's cache layer sees. Force every
 * Supabase request to bypass the cache so writes are visible immediately.
 */
function uncachedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: 'no-store' });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: uncachedFetch },
    })
  : null;

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { fetch: uncachedFetch },
    })
  : null;
