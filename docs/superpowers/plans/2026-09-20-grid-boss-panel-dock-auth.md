# Boss Panel Dock Auto-Auth

## Goal
Make the macOS Dock launcher open the local Boss Panel directly without requiring a second Game Master login step.

## Security shape
- Local development only.
- Requires localhost hostname.
- Uses a short-lived one-time random launch token.
- Stores only the SHA-256 token hash in git-common Builder OS state.
- Consumes the token after one successful use.
- Does not place the Game Master passphrase in the Dock app, URL, or token file.

## Flow
1. Dock app finds the canonical Grid worktree and starts port 3019 if needed.
2. Dock app writes a two-minute token hash to Builder OS coordination storage.
3. Browser opens the local launch route with the raw random token.
4. Launch route validates localhost + development + one-time token.
5. Route sets the existing httpOnly admin cookie and redirects to /admin/grid-builder.

## Verification
- Focused Builder OS tests.
- TypeScript.
- Local HTTP redirect/cookie flow on a dedicated test port.
- Browser proof that the final page is the live Empire Panel rather than the locked screen.
