export const CANTON_QUESTS_PRODUCTION_SUPABASE_REF = 'hdavnmvlnfhcaqjqwrwo';
export const CANTON_QUESTS_PRODUCTION_SUPABASE_HOST = `${CANTON_QUESTS_PRODUCTION_SUPABASE_REF}.supabase.co`;

export const TEST_SUPABASE_URL_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'PUBLIC_SUPABASE_URL',
] as const;

function abort(message: string): never {
  throw new Error(`TEST SAFETY ABORT:\n${message}`);
}

export function classifyTestSupabaseUrl(rawUrl: string): { kind: 'local'; url: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    abort(`Malformed Supabase URL: ${rawUrl || '(empty)'}. Automated tests require a verified local target.`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const normalized = parsed.toString().toLowerCase();
  const isProduction =
    hostname === CANTON_QUESTS_PRODUCTION_SUPABASE_HOST ||
    hostname.startsWith(`${CANTON_QUESTS_PRODUCTION_SUPABASE_REF}.`) ||
    normalized.includes(CANTON_QUESTS_PRODUCTION_SUPABASE_REF);

  if (isProduction) {
    abort('Refusing to run automated tests against Canton Quests production Supabase.');
  }

  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    abort(`Remote Supabase targets are denied by default for automated tests (${hostname}). Use local Supabase instead.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    abort(`Unsupported local Supabase URL protocol: ${parsed.protocol}`);
  }

  return { kind: 'local', url: rawUrl };
}

export function assertSafeTestSupabaseMutationTarget(rawUrl?: string): { kind: 'local'; url: string } {
  if (!rawUrl?.trim()) abort('A local Supabase URL is required for database integration tests.');
  return classifyTestSupabaseUrl(rawUrl.trim());
}

export function configuredTestSupabaseUrls(
  env: Record<string, string | undefined> = process.env,
): Array<{ key: typeof TEST_SUPABASE_URL_ENV_KEYS[number]; url: string }> {
  return TEST_SUPABASE_URL_ENV_KEYS.flatMap((key) => {
    const url = env[key]?.trim();
    return url ? [{ key, url }] : [];
  });
}

export function assertSafeTestSupabaseEnvironment(
  env: Record<string, string | undefined> = process.env,
): void {
  for (const { url } of configuredTestSupabaseUrls(env)) classifyTestSupabaseUrl(url);
}
