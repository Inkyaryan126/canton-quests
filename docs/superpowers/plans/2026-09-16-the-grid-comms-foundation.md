# THE GRID — Player Comms Foundation

**Date:** 2026-09-16  
**Lane:** isolated `grid-chat-system-20260916` worktree  
**Production state:** guarded by `GRID_CHAT_ENABLED`; disabled unless explicitly enabled

## Goal

Make The Grid feel like a multiplayer city by giving authenticated players a server-authoritative communications layer that can grow from a Canton city lobby into district, party/scrimmage, and direct channels.

The first implementation deliberately avoids precise-location chat. District channels can provide local context later without broadcasting a player's live GPS position.

## Channel model

- **City** — shared season-wide Canton communications.
- **District** — schema-supported neighborhood/zone channels; joining rules are the next expansion layer.
- **Party** — schema-supported private small-group/scrimmage channels; invitation rules are the next expansion layer.
- **Direct** — private one-to-one player channel.
- **System** — reserved for authoritative Commander/game notices.

All channels are season-scoped and carry a stable `scope_key` so creation is idempotent.

## Safety model

Safety is part of the foundation rather than a later UI patch:

- authenticated session player identity is authoritative for sends, blocks, and reports;
- direct-message creation involving a minor account is rejected;
- direct-message sending also re-checks current minor status so an old DM cannot bypass a later account-safety change;
- blocks are enforced when creating or sending direct messages;
- blocked senders are filtered from the blocker's shared-channel message feed;
- client retries use per-sender/channel nonces and cannot duplicate a message;
- an advisory transaction lock makes rate limiting resistant to concurrent-send races;
- initial limits are six messages per ten seconds and thirty per minute per player;
- reports support harassment, spam, safety, cheating, inappropriate content, and other;
- moderation supports hide, remove, restore, and dismiss actions;
- direct table access is revoked from `anon` and `authenticated`; application APIs use service-role-backed authoritative commands.

## Player API surface

- `GET /api/grid/chat/channels`
- `POST /api/grid/chat/direct`
- `GET /api/grid/chat/channels/:channelId/messages`
- `POST /api/grid/chat/channels/:channelId/messages`
- `PUT /api/grid/chat/channels/:channelId/read`
- `PUT /api/grid/chat/block`
- `POST /api/grid/chat/messages/:messageId/report`

Player mutations derive the acting player from `resolveAuthenticatedSession`; request bodies cannot impersonate a sender/reporter/blocker.

## Player UI

`/grid/chat` provides:

- responsive channel rail;
- city lobby and direct channel rendering;
- unread badges;
- message history;
- three-second polling while the initial architecture remains server-API-only;
- composer with idempotent client nonce;
- callsign-based direct-channel creation;
- block/report actions;
- a truthful COMMS NETWORK STANDBY screen while the feature flag is disabled.

Polling is intentional for the first safety boundary. A future realtime transport can replace polling without changing channel/message authority.

## GM moderation

`/admin/grid-chat` provides a GM report queue backed by:

- `GET /api/admin/grid/chat/reports`
- `POST /api/admin/grid/chat/reports/:reportId`

The canonical admin session is required. The browser never updates chat tables directly.

## Database acceptance

The migration was exercised against local PostgreSQL inside `BEGIN ... ROLLBACK` so the shared database remained unchanged. Verified behaviors include:

- city channel creation/join;
- direct channel creation;
- minor direct-message restriction;
- block enforcement;
- send idempotency;
- send rate limiting;
- report creation;
- GM moderation resolution;
- exact case-insensitive callsign resolution.

## Next comms phases

1. District channel join policy tied to approved Grid district identities, not GPS broadcasting.
2. Party/scrimmage channel ownership, invitations, kicks, and leave flow.
3. Realtime delivery transport (Supabase Realtime or a server event stream) while preserving server authority.
4. Notification preferences and mention handling.
5. Commander/system broadcasts.
6. Moderator escalation tools, player communication suspensions, and richer audit history.
7. Optional friends/contact layer before expanding direct-message discovery.
