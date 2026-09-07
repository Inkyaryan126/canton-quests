import { assertSafeTestSupabaseEnvironment } from '../../lib/supabase-test-safety';

export default function setup() {
  assertSafeTestSupabaseEnvironment(process.env);
}
