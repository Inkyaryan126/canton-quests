import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertSafeTestSupabaseEnvironment,
  assertSafeTestSupabaseMutationTarget,
  classifyTestSupabaseUrl,
  TEST_SUPABASE_URL_ENV_KEYS,
} from '../lib/supabase-test-safety';

const productionUrl = 'https://hdavnmvlnfhcaqjqwrwo.supabase.co';

describe('automated test Supabase safety', () => {
  it('rejects the Canton Quests production project ref', () => {
    expect(() => classifyTestSupabaseUrl(`https://${'hdavnmvlnfhcaqjqwrwo'}.supabase.co`)).toThrow(
      /TEST SAFETY ABORT.*Canton Quests production Supabase/s,
    );
  });

  it('rejects the Canton Quests production hostname', () => {
    expect(() => classifyTestSupabaseUrl(productionUrl)).toThrow(/TEST SAFETY ABORT/);
  });

  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])(
    'allows local Supabase at %s',
    (url) => expect(classifyTestSupabaseUrl(url)).toEqual({ kind: 'local', url }),
  );

  it('rejects an unexpected remote Supabase project for mutation-capable tests', () => {
    expect(() => assertSafeTestSupabaseMutationTarget('https://another-project.supabase.co')).toThrow(
      /remote Supabase targets are denied by default/i,
    );
  });

  it('fails safely when a database integration target is missing or malformed', () => {
    expect(() => assertSafeTestSupabaseMutationTarget(undefined)).toThrow(/local Supabase URL is required/i);
    expect(() => assertSafeTestSupabaseMutationTarget('not-a-url')).toThrow(/malformed Supabase URL/i);
  });

  it.each(TEST_SUPABASE_URL_ENV_KEYS)(
    'cannot bypass the production block through %s',
    (key) => expect(() => assertSafeTestSupabaseEnvironment({ [key]: productionUrl })).toThrow(/TEST SAFETY ABORT/),
  );

  it('rejects production if another URL variable points local', () => {
    expect(() => assertSafeTestSupabaseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_URL: productionUrl,
    })).toThrow(/TEST SAFETY ABORT/);
  });

  it('does not let test-imported tooling reload the repository .env.local', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/qr-campaign-cli.ts'), 'utf8');
    expect(source).toMatch(/if \(!process\.env\.VITEST && process\.env\.NODE_ENV !== 'test'\)/);
    expect(source.indexOf("dotenv.config({ path: '.env.local' })")).toBeGreaterThan(source.indexOf('if (!process.env.VITEST'));
  });
});
