# Scanner-safe email confirmation

Supabase confirmation emails must link to the inert Canton Quests landing page:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=%2Fprofile
```

`GET /auth/confirm` only renders the confirmation screen. It must never call
`verifyOtp`, create a player, or establish a session. The token is consumed only
when the player presses **Confirm email address**, which sends a `POST` to
`/api/auth/confirm`.

Do not replace the template href with Supabase's direct verification URL or a
Canton Quests GET endpoint that verifies the token. Email security scanners,
link previews, and prefetchers routinely visit links before the recipient.

An invalid, expired, or already-used token returns the existing login/resend
guidance. Redirect destinations are accepted only as local absolute paths.
