# Grid Passport Read Side

Expose only authenticated permanent Passport state. The adapter reads `grid_player_profiles` only; the service validates stored JSON before returning a sanitized versioned history. Seasonal wallets, ownership, contest state, and raw event rows are outside this endpoint.
