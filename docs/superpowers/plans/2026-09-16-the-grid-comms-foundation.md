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

## Comms 2 — District + Party/Scrimmage Channels

Implemented after the Comms 1 checkpoint:

- District chat discovery and join by authoritative `grid_districts.id`.
- No GPS coordinates or precise player location are required or stored for district chat membership.
- Private party/scrimmage channel creation with an owner role.
- Callsign-based party invitations resolved server-side to player identity.
- Only owners and moderators may invite party members.
- Blocks are checked before party invitations are accepted.
- Private party creation/invitation is restricted for minor accounts in the first release.
- Party members may leave their own membership only.
- Owners cannot orphan an active party; after the final member leaves, the empty party is archived automatically.
- `/grid/chat` now exposes District, Party, and Direct as first-class communication actions.
- Party owners/moderators receive an Invite control; party members receive a controlled Leave action.

### Comms 2 database acceptance

Exercised against local PostgreSQL inside `BEGIN ... ROLLBACK`:

- district join succeeded;
- private party creation succeeded;
- owner invitation succeeded;
- regular-member invitation was rejected;
- minor private-party creation was rejected;
- blocked-player invitation was rejected;
- owner orphaning was rejected;
- regular member leave succeeded;
- final owner leave archived the empty party.

## Comms 3A — Party Lifecycle Management

Party/scrimmage channels now have a controlled lifecycle instead of becoming owner-locked dead ends:

- active roster view for any party member;
- owner promotion/demotion of moderators;
- owner or moderator removal of regular members;
- moderators cannot remove owners or other moderators;
- explicit ownership transfer to an active party member;
- previous owner becomes a moderator after ownership transfer;
- every lifecycle mutation remains session-bound and service-role authoritative.

Transactional PostgreSQL acceptance verified promotion, moderator removal scope, owner protection, ownership transfer, and final role state before rollback.

## Comms 3B — Commander / System Broadcasts

Official Grid transmissions now use a first-class system-message identity instead of a fake player account:

- `grid_chat_messages.sender_kind` distinguishes `player` and `system` messages;
- system messages have no `sender_player_id` and carry a bounded `sender_label` instead;
- the GM broadcast path fixes the public sender label to `COMMANDER` rather than trusting a request body;
- CITY // OPEN CHANNEL can receive an official broadcast even before any player has opened Comms;
- a later player join sees historical system transmissions;
- system broadcast retries are idempotent through a system-specific nonce index;
- nonce reuse with different message content is rejected;
- players cannot block or report official system messages in the UI;
- the database rejects direct attempts to report a system message;
- `/admin/grid-chat` now includes a Commander broadcast composer.

Transactional PostgreSQL acceptance verified first broadcast, duplicate retry, nonce collision rejection, player join after transmission, clean system sender identity, and report rejection before rollback.

## Comms 5 — Incremental Sync + Notification State

The initial safe polling transport has been hardened into a much lighter near-realtime sync loop without exposing chat tables directly to browsers:

- every message now receives a monotonic `sequence_no` cursor;
- existing rows are backfilled automatically when the migration is applied;
- initial channel open loads the latest page, then subsequent polls request only rows after the last sequence cursor;
- the cursor advances across filtered/blocked rows so a blocked sender cannot trap the client on the same page forever;
- active message sync runs approximately every 1.8 seconds while the heavier channel/unread refresh runs every 8 seconds;
- read receipts are only advanced while the document is visible, so a background tab does not silently consume unread messages;
- channel notification preference is persisted per membership and can be toggled from the channel header;
- unread counting moved into an authoritative database helper so system/Commander messages count correctly while the reader's own messages and blocked-player messages do not;
- notification preference changes require active channel membership and remain session-bound through the API.

### Comms 5 database acceptance

Applied the foundation, system-message migration, seeded a message before the sync migration, then applied Comms 5 inside `BEGIN ... ROLLBACK`:

- the pre-existing message received sequence `1`;
- the next Commander message received sequence `2`;
- unread count correctly included both another player's message and the Commander message;
- after blocking that player, only the Commander message remained unread;
- disabling channel alerts persisted on the membership row;
- a season player who had not joined the channel could not change its notification preference.

## Comms 6 — Consent-Based Party Invitations

Private party invitations now require the invited player's explicit consent instead of allowing an owner or moderator to add another player directly:

- invitations are stored separately from active channel membership with pending, accepted, declined, cancelled, and expired states;
- creating an invitation never inserts the invitee into `grid_chat_members`;
- invitations expire after 24 hours and duplicate pending invitations are rejected;
- only the invited player may accept or decline;
- acceptance rechecks season membership, minor restrictions, inviter authority, channel state, and two-way block state before membership is created;
- the old `grid_add_party_chat_member` force-add RPC is no longer executable by `service_role`;
- the invite table has RLS enabled and no direct `anon` or `authenticated` table privileges;
- all invite commands remain server-only and `security invoker`;
- `/grid/chat` surfaces pending Party Invites with explicit Accept and Decline actions;
- invite-response routes derive the invitee from the authenticated session and never accept a browser-supplied player id.

### Comms 6 database acceptance

The complete Comms migration chain plus Comms 6 was exercised against local PostgreSQL inside `BEGIN ... ROLLBACK`:

- the invite table was created with RLS enabled;
- browser roles had no table privileges while `service_role` retained the required server access;
- only the new invite, accept, and decline RPCs were executable by `service_role`;
- the retired force-add RPC was not executable by `service_role`;
- an invited player had zero party membership before acceptance and one active membership after acceptance;
- declining a separate invite created no party membership.

Supabase security advisors were also run against the existing local stack. They reported pre-existing security-definer views and an unrelated permissive event-registration policy outside the Grid Comms schema; this checkpoint did not modify those objects.
