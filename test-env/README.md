# Automated test database safety

`npm test` loads Supabase configuration only from this directory. It never
loads the repository root `.env.local`, which contains production runtime
credentials.

Most unit tests need no Supabase environment and use the in-memory engine. For
database integration tests, run `npx supabase start`, copy
`.env.test.example` to `.env.test.local`, and replace the placeholders with
the local API URL and keys printed by `npx supabase status`. The target must be
localhost or `127.0.0.1`.

The production project ref `hdavnmvlnfhcaqjqwrwo` is permanently forbidden.
All other remote Supabase projects are also rejected for automated tests.

`TEST SAFETY ABORT` means a test process saw a malformed or remote database
target, or a database integration helper lacked its required local target.
Fix the local test setup; never point tests at production or weaken the guard.

Boardroom validation uses the same `npm test` command and global guard. It
also removes Supabase credentials inherited from the Boardroom parent process
before starting test validation.
