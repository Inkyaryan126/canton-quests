import type { GridPlatformRuntime } from './runtime';

export type GridLaunchIntentSource = 'universal-link' | 'custom-scheme';

export interface GridLaunchIntent {
  source: GridLaunchIntentSource;
  path: string;
  query: Record<string, string[]>;
  fragment: string | null;
}

export type GridLaunchIntentRejection =
  | 'EMPTY_URL'
  | 'URL_TOO_LONG'
  | 'INVALID_URL'
  | 'UNTRUSTED_HOST'
  | 'UNSUPPORTED_SCHEME'
  | 'OUTSIDE_GRID'
  | 'INVALID_PATH';

export type GridLaunchIntentResult =
  | { ok: true; intent: GridLaunchIntent }
  | { ok: false; reason: GridLaunchIntentRejection };

export interface GridLaunchIntentConfig {
  trustedHosts: readonly string[];
  customSchemes?: readonly string[];
  basePath?: string;
  maxUrlLength?: number;
}

function normalizeBasePath(value: string | undefined): string {
  const base = value?.trim() || '/grid';
  if (!base.startsWith('/')) throw new Error('Grid launch basePath must start with /');
  const normalized = base.length > 1 ? base.replace(/\/+$/, '') : base;
  if (normalized.includes('..')) throw new Error('Grid launch basePath cannot contain ..');
  return normalized;
}
function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

function normalizeScheme(value: string): string {
  return value.trim().toLowerCase().replace(/:$/, '');
}

function isGridPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function safePath(pathname: string): boolean {
  if (!pathname.startsWith('/')) return false;
  if (pathname.includes('\\')) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  return !decoded.split('/').some((segment) => segment === '..' || segment === '.');
}

function queryRecord(searchParams: URLSearchParams): Record<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const [key, value] of searchParams.entries()) {
    const values = grouped.get(key) ?? [];
    values.push(value);
    grouped.set(key, values);
  }
  const result: Record<string, string[]> = {};
  for (const key of [...grouped.keys()].sort()) result[key] = grouped.get(key)!;
  return result;
}
export function parseGridLaunchIntent(
  rawUrl: string,
  config: GridLaunchIntentConfig,
): GridLaunchIntentResult {
  const input = rawUrl.trim();
  if (!input) return { ok: false, reason: 'EMPTY_URL' };
  if (input.length > (config.maxUrlLength ?? 4096)) {
    return { ok: false, reason: 'URL_TOO_LONG' };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }

  const basePath = normalizeBasePath(config.basePath);
  const protocol = normalizeScheme(url.protocol);
  const trustedHosts = new Set(config.trustedHosts.map(normalizeHost));
  const customSchemes = new Set((config.customSchemes ?? []).map(normalizeScheme));
  let source: GridLaunchIntentSource;
  let path: string;

  if (protocol === 'https') {
    if (!trustedHosts.has(normalizeHost(url.hostname))) {
      return { ok: false, reason: 'UNTRUSTED_HOST' };
    }
    source = 'universal-link';
    path = url.pathname;
  } else if (customSchemes.has(protocol)) {
    source = 'custom-scheme';
    const baseHost = basePath.replace(/^\//, '').toLowerCase();
    if (url.hostname && normalizeHost(url.hostname) === baseHost) {
      path = `${basePath}${url.pathname === '/' ? '' : url.pathname}`;
    } else if (!url.hostname && isGridPath(url.pathname, basePath)) {
      path = url.pathname;
    } else {
      return { ok: false, reason: 'OUTSIDE_GRID' };
    }
  } else {
    return { ok: false, reason: 'UNSUPPORTED_SCHEME' };
  }

  if (!safePath(path)) return { ok: false, reason: 'INVALID_PATH' };
  if (!isGridPath(path, basePath)) return { ok: false, reason: 'OUTSIDE_GRID' };

  return {
    ok: true,
    intent: {
      source,
      path,
      query: queryRecord(url.searchParams),
      fragment: url.hash ? url.hash.slice(1) : null,
    },
  };
}
export async function resolveInitialGridLaunchIntent(
  runtime: GridPlatformRuntime,
  config: GridLaunchIntentConfig,
): Promise<GridLaunchIntentResult | null> {
  if (!runtime.supports('deep-links')) return null;
  const rawUrl = await runtime.requireDeepLinks().getInitialUrl();
  return rawUrl ? parseGridLaunchIntent(rawUrl, config) : null;
}
