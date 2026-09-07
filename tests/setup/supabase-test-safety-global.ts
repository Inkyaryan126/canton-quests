import dotenv from 'dotenv';
import path from 'node:path';
import { assertSafeTestSupabaseEnvironment } from '../../lib/supabase-test-safety';

export default function setup() {
  // Vitest's `envDir` only feeds import.meta.env, not process.env, so the
  // opt-in local test database config must be loaded here explicitly. Both
  // files live under test-env/ only — never the repository root .env.local.
  const envDir = path.resolve(__dirname, '../../test-env');
  dotenv.config({ path: path.join(envDir, '.env.test.local') });
  dotenv.config({ path: path.join(envDir, '.env.test') });

  assertSafeTestSupabaseEnvironment(process.env);
}
