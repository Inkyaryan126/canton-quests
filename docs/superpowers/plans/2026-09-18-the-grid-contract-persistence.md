# Grid Contract Persistence Plan

1. Keep the existing 70000 base schema and RPC as the authoritative transition.
2. Expose the missing server persistence boundary without changing the Contract
   core or client contracts.
3. Add the 90000 migration with a stable reward delivery key and unique
   contract/reward identity, preserving RLS and service-role-only access.
4. Verify the focused Contract tests, TypeScript, and whitespace diff.

Production migration application and reward-worker deployment are outside this
lane and remain unverified until an approved environment runs them.
