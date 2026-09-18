# Grid Passport Read Privacy Headers

Every response from the authenticated Passport endpoint — success, auth failure, disabled runtime, or server error — is explicitly marked `Cache-Control: private, no-store, max-age=0` and `Vary: Cookie`. This supplements dynamic rendering and the client's `cache: no-store` request so player-specific permanent history cannot be reused by shared caches.
