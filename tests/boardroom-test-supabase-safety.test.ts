import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { safeEnvironmentForValidationCommand } from '../lib/boardroom/supervisor';

describe('Boardroom test validation Supabase safety', () => {
  it('sanitizes inherited Supabase credentials before every npm test validation', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://hdavnmvlnfhcaqjqwrwo.supabase.co';
    process.env.SUPABASE_URL = 'https://another-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-placeholder';
    const env = safeEnvironmentForValidationCommand('npm test -- boardroom');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('routes npm test through the same Vitest global setup guard', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const vitestConfig = fs.readFileSync(path.join(process.cwd(), 'vitest.config.ts'), 'utf8');
    expect(packageJson.scripts.test).toBe('vitest run');
    expect(vitestConfig).toContain("globalSetup: ['./tests/setup/supabase-test-safety-global.ts']");
  });
});
