# CANTON QUESTS — BUILD THE NEW PLAYER PROFILE + DYNAMIC PLAYER CARD SYSTEM

## MISSION

Build a completely redesigned authenticated Canton Quests Player Profile / Player Command Center using the new visual assets that are already present in the project.

This should replace the feeling of a generic website profile with a personalized game identity page.

The finished experience should make the player feel:

"CANTON QUESTS KNOWS WHO I AM, WHERE I START, WHAT I'VE DONE, AND WHAT I SHOULD DO NEXT."

Do not merely add a profile card to the existing page.

Redesign the authenticated player experience around it.

Production:
https://divinedesigndestinations.com

Repo:
`/Users/inkyaryan126/Desktop/canton-quests`

---

# FIRST: AUDIT THE PROVIDED ASSETS

Inspect the actual files inside the repo before implementing anything.

The user has placed new Player Card assets in the project, visible under approximately:

`public/canton-quests/`

Known visible files include:

- `player_card_guide...`
- `player_card.png`
- `1.png`
- `2.png`
- `3.png`
- `4.png`
- `5.png`
- `6.png`
- `7.png`
- `8.png`

There may be other related assets.

DO NOT assume filenames, extensions, or paths beyond what actually exists.

Run file discovery and inspect:

- dimensions
- alpha/transparency
- intended positioning
- visual guide
- card artwork
- avatar artwork
- other relevant CQ UI assets

The user's guide image is the SOURCE OF TRUTH for where dynamic information belongs on the card.

Do not redraw or replace their player card design unless technically necessary.

---

# PLAYER CARD DESIGN INTENT

The card artwork itself should remain visually intact.

Dynamic HTML/CSS/UI content should be positioned into the designated empty regions of the artwork.

The blank card includes labeled areas for concepts such as:

- PLAYER PHOTO
- CALLSIGN
- STARTING PATH
- STARTING DISTRICT
- PLAYER LEVEL
- PLAYER SIGNAL
- TOTAL XP
- QUESTS COMPLETE
- PRIZE ENTRIES
- CITY RANK
- BADGES
- MEMBER SINCE
- PLAYER ID CODE
- CLEARANCE LEVEL

Use the ACTUAL guide to determine final field positions.

Do not invent filled-in example data.

Everything displayed must come from the authenticated player's real account/game data.

---

# IMPORTANT TERMINOLOGY

The game uses:

BADGES

Do not call them:

- achievements
- achievements & badges
- trophies unless there is a separate real trophy system

Use existing badge system/database as authoritative source.

---

# PLAYER PHOTO / AVATAR SYSTEM

Players must be able to choose between:

## OPTION A
UPLOAD YOUR PHOTO

## OPTION B
CHOOSE A CQ AVATAR

The user has already prepared circular avatar images in the project folder.

Known visible preset avatar files:

- 1.png
- 2.png
- 3.png
- 4.png
- 5.png
- 6.png
- 7.png
- 8.png

Inspect them.

Use them as the initial official preset avatar library unless repo contents indicate a better canonical mapping.

Do not regenerate avatars.

---

# AVATAR PICKER UX

Provide a clean selection interface:

CHOOSE YOUR PLAYER IMAGE

[ Upload My Photo ]

or

CHOOSE A CQ OPERATIVE

[ avatar grid ]

Each avatar should preview cleanly.

Selected avatar should have a clear CQ-style selected state.

Provide:

- preview
- save
- cancel
- change photo/avatar later

Persist the selection.

Recommended stable architecture:

`avatar_source`
- upload
- preset

`avatar_preset_id`
- stable identifier such as preset-01

`avatar_storage_path`
- only for player uploads

These are conceptual names; first audit existing schema.

Reuse current profile/avatar fields if equivalent fields already exist.

DO NOT create duplicate sources of truth.

---

# USER PHOTO UPLOAD

If a player uploads their own photo:

- authenticate request
- validate MIME type server-side
- images only
- sensible size limit
- prevent malicious upload types
- generate safe internal filename/path
- never expose service-role credentials
- enforce ownership/RLS
- do not allow one player to replace another player's image

Use Supabase Storage if appropriate.

Audit existing storage buckets/policies first.

Do not make original private uploads universally enumerable.

---

# PHOTO POSITIONING

The card's photo area is circular.

The user has intentionally prepared preset avatars as circles.

For uploaded photos:

provide a simple crop/position UI suitable for the circular photo frame.

Allow:

- zoom
- x/y reposition
- preview

The result shown on the player card must fit cleanly inside the designated circular photo area.

No stretching.

No distorted aspect ratio.

---

# PLAYER CARD RENDERING

Implement the card responsively.

The card artwork can function as the visual base layer.

Dynamic player values should be overlaid in their designated regions.

Do not rasterize player values permanently into one image just to display the profile.

The browser version should remain live/dynamic.

Use responsive positioning based on the card's intrinsic coordinate system.

A recommended implementation is:

- relative aspect-ratio wrapper
- full-size card artwork underneath
- absolutely positioned dynamic fields using percentage-based coordinates
- player image clipped to circular designated photo opening
- badge slots populated dynamically

Avoid hardcoded desktop-only pixel placement.

It must scale proportionally across phones.

---

# PLAYER DATA

Use authoritative existing CQ systems.

Display where available:

## CALLSIGN

Actual player callsign.

This should be one of the strongest pieces of text on the card.

## STARTING PATH

Existing starting path identity:

FAMILY
CHALLENGE
SECRET

## STARTING DISTRICT

Current intended mapping:

FAMILY
→ Arts District

CHALLENGE
→ 9th Street Skate Park / Challenge area

SECRET
→ West Lawn Cemetery / McKinley area

Audit existing canonical data before hardcoding.

Do not invent Canton geography.

Starting district is a recommended starting point, NOT a restriction.

## PLAYER LEVEL

First determine whether a real player-level system currently exists.

If yes:
use authoritative level logic.

If not:
do NOT fabricate levels.

Either:
- omit value gracefully
or
- implement a properly defined XP-derived level system only if there is an existing project specification supporting it.

Report what was chosen.

## PLAYER SIGNAL

Use meaningful state.

Examples:
ACTIVE
FIELD MODE
etc.

Do not create misleading network/status information.

For normal authenticated active player:

ACTIVE

is acceptable if semantically correct.

## TOTAL XP

Use the authoritative score ledger / existing XP calculation.

Do not recalculate XP using a competing system.

## QUESTS COMPLETE

Use verified/completed quest state.

Prefer useful presentation:

`7 / 15`

if total available event quests is authoritative.

## PRIZE ENTRIES

Use the real drawing-entry ledger.

DO NOT assume:

quest count = prize entries

even if normally correlated.

The prize ledger is authoritative.

## CITY RANK

Use the same leaderboard ranking source/logic used by the actual leaderboard.

No duplicate ranking algorithm.

## MEMBER SINCE

Use the player's actual creation/join timestamp.

Use sensible compact formatting.

## PLAYER ID CODE

Determine whether a legitimate existing public-safe player ID/code exists.

DO NOT expose:

- Supabase auth UUID
- database primary key
- email
- secret token

If CQ already has a public player code, use it.

Otherwise create a safe deterministic/public player identifier only if appropriate and document architecture.

Never use secrets.

## CLEARANCE LEVEL

First audit whether CQ actually has a meaningful clearance/title system.

If one exists, use it.

If not, DO NOT fabricate fake authority levels.

This field can instead display an existing player title/flair if that matches current product semantics.

Report the decision.

---

# BADGES

The user's actual badge artwork is ROUND.

The Player Card now has circular badge positions.

Use the existing badge system and existing badge artwork.

Audit:

- badge definitions
- badge unlock rules
- badge images
- database relationships
- unlocked achievements/badges code if legacy naming still exists internally

Player-facing copy must say:

BADGES

Populate the card's badge row with unlocked badges.

If the player has more badges than the visible card slots:

- display a sensible selected subset
- allow the player to manage which badges appear
OR
- use most recently earned / highest-priority badges

Preferred feature:

## FEATURED BADGES

Allow the player to choose which earned badges appear on their Player Card.

They can only feature badges they actually own.

If there are 6 visible slots, allow up to 6 featured badges.

If fewer are selected, fill from recent earned badges where sensible.

Locked/unearned badges should never appear as though the player owns them.

---

# FEATURED BADGE IDEA

Add a subtle interaction:

EDIT BADGES

Player can choose their card's displayed badges from all badges they have earned.

This gives people meaningful personalization without changing game scoring.

Persist their selected badge IDs if schema supports it cleanly.

This is encouraged but must not destabilize launch-critical systems.

---

# PLAYER PROFILE / COMMAND CENTER PAGE

The card should be prominent near the top.

But this page should be MUCH MORE than the card.

Recommended mobile hierarchy:

1. PLAYER CARD
2. COMMANDER'S NEXT MOVE
3. YOUR STARTING DISTRICT
4. AVAILABLE QUESTS IN YOUR DISTRICT
5. NEARBY / RECOMMENDED QUESTS
6. EXPLORE OTHER DISTRICTS
7. DISTRICT PROGRESS
8. BADGE COLLECTION
9. RECENT FIELD ACTIVITY
10. PROFILE / PRIVACY CONTROLS

Do not bury gameplay under huge decorative content.

---

# COMMANDER'S NEXT MOVE

Add a personalized next-action module.

Example:

COMMANDER'S NEXT MOVE

PALACE SIGNAL

+150 XP

0.3 MI
only if actual geolocation/distance is available.

[ VIEW QUEST ]

Recommendation precedence:

1. available incomplete quest in starting district
2. nearby incomplete quest if legitimate location data is available
3. another useful available quest

No fake distance.

No fabricated availability.

---

# YOUR STARTING DISTRICT

Prominent section:

YOUR STARTING DISTRICT

Show:

- district
- path
- available quest count
- completed quest count
- CTA

Explicitly explain:

YOUR STARTING DISTRICT IS YOUR LAUNCH POINT.
THE ENTIRE CITY REMAINS OPEN.

Starting path must never lock players out of other quests.

---

# AVAILABLE QUESTS — STARTING DISTRICT

Show current quests in that player's recommended starting district first.

Each quest card should expose useful game information:

- title
- XP
- proof type
- completion state
- availability
- thumbnail if appropriate
- distance if real
- CTA

Completed quest cards should clearly show completion.

---

# EXPLORE OTHER DISTRICTS

Show the other two paths/districts.

Example:

EXPLORE CANTON

CHALLENGE
3 quests available
[ EXPLORE ]

SECRET
4 quests available
[ EXPLORE ]

All quests remain open according to game rules.

---

# DISTRICT PROGRESS — NEW IDEA

Add a compact progress visualization showing how much of Canton the player has explored.

Example:

DISTRICT PROGRESS

FAMILY
3 / 5

CHALLENGE
1 / 5

SECRET
0 / 5

This should use actual quest/location data.

No invented numbers.

This can become a powerful motivation mechanic because a player can immediately see which district they have barely explored.

---

# BADGE COLLECTION

Below the gameplay areas, provide a broader badge collection.

Show:

- earned badges
- badge names
- brief requirements/meaning
- date earned where available
- featured/unfeatured state

Locked badges may be shown only if current CQ design intentionally reveals them.

Do not reveal hidden/secret badge conditions if they are meant to be surprises.

---

# RECENT FIELD ACTIVITY

Where authoritative data supports it, display recent player activity:

QUEST VERIFIED
+150 XP

BADGE UNLOCKED

PRIZE ENTRY CONFIRMED

RANK CHANGE

etc.

Do not fabricate feed entries.

If existing data cannot produce a reliable activity feed, gracefully omit it.

---

# PROFILE PERSONALIZATION

Allow player to edit legitimate existing optional profile fields where already supported:

- bio
- motto
- hometown
- avatar
- player title/flair
- theme/path identity where rules permit
- privacy setting

Do not allow player to change game-controlled data like:

- XP
- rank
- prize entries
- earned badges
- verified quest completions

---

# PUBLIC / PRIVATE PROFILE — NEW IDEA

Audit existing privacy architecture.

Add a clear privacy option if appropriate:

PUBLIC PLAYER PROFILE

When public:
other players may view approved profile information such as:

- callsign
- selected avatar/photo according to consent
- badges
- rank
- XP
- quest progress where allowed

Never expose:

- email
- auth UUID
- storage path
- internal metadata
- private proof submissions

Default should respect current existing privacy behavior.

---

# PHOTO PRIVACY

Uploaded personal photos deserve special handling.

A player must understand whether their photo may be visible to other players.

If current system has:

profile privacy

honor it.

If not, introduce a sensible option such as:

SHOW MY PLAYER IMAGE PUBLICLY

Do not silently make uploaded personal photos globally public.

Preset CQ avatars can follow standard public profile visibility.

---

# AUTHENTICATED NAVIGATION

When logged in, site navigation should visibly know the player.

Include useful authenticated destinations such as:

- COMMAND CENTER
- QUESTS
- LEADERBOARD
- PROFILE
- CALLSIGN / avatar indicator
- LOG OUT

Do not prominently show SIGN UP to someone already logged in.

---

# POST-EMAIL-CONFIRMATION FLOW

Integrate this with the current scanner-safe email confirmation architecture.

Do NOT regress:

- token_hash flow
- deliberate POST verification
- scanner-safe GET behavior
- redirect sanitization
- secure session handling

After successful confirmation:

IF player identity incomplete
→ finish onboarding

IF profile ready
→ open Player Command Center

Do not dump verified users onto a generic anonymous homepage.

---

# MOBILE FIRST

This feature is primarily for phones outdoors.

Test:

320px
375px
390px
414px
430px

The player card must:

- fit completely
- preserve proportions
- never overflow horizontally
- remain readable
- keep circular avatar aligned
- keep dynamic labels aligned
- keep badge circles aligned

Do not solve overflow by hiding it.

Fix actual responsive geometry.

---

# CARD PERFORMANCE

Do not ship giant multi-megabyte artwork unnecessarily.

Inspect card/avatar files.

Optimize them appropriately while maintaining visual quality.

Use Next/Image or equivalent where suitable.

Preset avatar gallery should not download every giant source asset unnecessarily on first page render.

Use appropriate sizing/optimization.

---

# ACCESSIBILITY

Dynamic values must exist as actual accessible text, not only pixels on an image.

Images need useful alt text.

Buttons need descriptive labels.

Do not sacrifice accessibility just because the card is visually elaborate.

---

# SHAREABLE PLAYER CARD — FUTURE-READY IDEA

Architect the component so it could later generate a shareable Player Card image for:

- social media
- milestone announcements
- leaderboard wins
- badge unlocks

Do NOT spend this mission building a complicated social sharing system.

Just avoid architecture that makes this impossible later.

---

# SECURITY

Audit every new endpoint and mutation.

Required:

- auth required for player edits
- ownership enforced
- server-side validation
- RLS/storage policy enforcement
- no service-role leak
- no email leak
- no auth UUID exposed publicly
- no client-controlled XP/rank/badges
- no client-controlled prize entries
- player cannot feature badge they have not earned
- player cannot modify another player
- uploaded file validation

---

# DATABASE

Before migrations:

inspect existing tables/columns.

Reuse existing player/profile fields where possible.

If migration is needed:

- make it idempotent
- use appropriate foreign keys
- add indexes where required
- add safe RLS
- avoid duplicate truth sources

Potential new concepts MAY include:

- avatar_source
- avatar_preset_id
- avatar_storage_path
- avatar_crop_x
- avatar_crop_y
- avatar_zoom
- featured_badge_ids / relation
- image_public_visibility

These are conceptual only.

Do not blindly create them.

---

# BROWSER VERIFICATION

Use real Chrome.

Test at least:

## PLAYER 1
Family path

Verify:
- correct avatar/photo
- Arts District
- correct quests
- other districts accessible
- card fields
- badge display

## PLAYER 2
Challenge path

Verify corresponding path/district behavior.

## PLAYER 3
Secret path

Verify corresponding path/district behavior.

Also test:

- preset avatar change
- uploaded photo
- badge featuring
- page refresh
- logout/login
- mobile card sizing
- profile privacy behavior
- account session persistence

---

# TESTS

Add regression coverage for:

- card renders authenticated player
- callsign correct
- correct starting path
- correct starting district
- XP authoritative
- rank authoritative
- quest count authoritative
- prize entry count authoritative
- preset avatar persists
- photo upload ownership
- invalid image rejected
- one player cannot edit another player
- badge ownership enforced
- featured badges persist
- only earned badges may be featured
- email not exposed
- auth UUID not exposed publicly
- anonymous private-profile access blocked
- other districts remain accessible
- responsive component logic
- post-confirmation routing

Run:

npm test
npm run lint
npm run build

All must pass.

---

# VISUAL QA

Compare final implementation directly against:

`player_card_guide`

and:

`player_card.png`

Ensure the finished populated card follows the user's intended empty areas.

Do not eyeball it from memory.

Inspect and compare the actual assets.

---

# COMMIT + DEPLOY

If all tests pass:

1. commit changes
2. deploy to production
3. verify live at:
   https://divinedesigndestinations.com
4. test authenticated player page on real mobile-sized Chrome
5. verify persistent login/profile state

Suggested commit message:

`feat(player): build personalized command center and player card`

---

# FINAL REPORT

Report:

1. All card assets discovered
2. Exact asset paths used
3. Player card implementation architecture
4. Dynamic field mapping
5. Avatar preset implementation
6. Upload implementation
7. Photo crop implementation
8. Badge implementation
9. Featured badge behavior
10. Starting district behavior
11. Quest recommendation logic
12. District progress implementation
13. Profile/privacy behavior
14. Database/schema changes
15. Storage/RLS changes
16. Security validation
17. Mobile widths tested
18. Browser verification
19. Test count/pass result
20. Lint result
21. Build result
22. Production deployment
23. Commit hash

DO NOT stop after creating the visual card.

The finished product must be a full authenticated Canton Quests player experience centered around their identity, avatar/photo, starting district, quests, progress, rank, XP, prize entries, and BADGES.
