import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Never let Vite/Vitest load the production .env.local at repository root.
  envDir: path.resolve(__dirname, 'test-env'),
  test: {
    globalSetup: ['./tests/setup/supabase-test-safety-global.ts'],
    environment: 'node',
    globals: true,
    pool: 'forks',
    fileParallelism: false,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
