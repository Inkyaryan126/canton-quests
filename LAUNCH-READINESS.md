# Canton Quests Volume 1 Launch Readiness

Target launch: September 4, 2026.

## READY

- Player journey is wired from quest discovery to event hub, quest detail, proof submission, XP, drawing entries, progress, leaderboard, and drawing status.
- Public quest API serializes launch quests through `getPublicQuestView`, removing `targetCode`, step secrets, and `gmNotes`.
- Volume 1 seed data now includes a real launch set across GPS/check-in, QR, passphrase, photo, video, flash, partner-ready, secret, finale, and chained quest patterns.
- The high-difficulty secret mission is configured as an ordered multi-step chain with public step instructions and server-side hashed step answers.
- Quest rewards are configured with explicit XP and drawing-entry values.
- GPS-required quests keep server-side location enforcement and now give clearer retry guidance when location permission or accuracy fails.
- Quest detail pages expose location, access notes, rewards, proof type, safety notes, and a public map-directions control.
- The QR gateway can process physical QR passcodes against active QR missions and passes GPS data when the QR mission requires proximity.
- Game Master tools expose event readiness, quest/location/QR management, manual proof review, event phase/pause controls, flash drops, announcements, score reconciliation, spectator controls, and drawing controls.
- Frankenstein's Quiet Signal is represented as a respectful daytime photo quest with public safety rules and internal GM notes separated from public quest data.

## NEEDS HUMAN VERIFICATION

- Confirm all physical QR placements, printed passcodes, weatherproof materials, and replacement copies.
- Confirm exact public access, hours, and staff permission for every partner-ready location.
- Confirm McKinley, Palace, Onesto, Hall of Fame route, and Centennial clue targets in person before printing clues.
- Confirm West Lawn Cemetery visiting hours, photography policy, exact Frankenstein monument location, and whether staff permission is needed before enabling the cemetery quest.
- Confirm that cemetery visitor rules permit non-family historical visitors for this specific game use; if not, hide or replace Frankenstein's Quiet Signal before launch.
- Confirm GPS coordinates and practical radius values at each location with phones on cellular data.
- Confirm route walkability, crosswalks, lighting, ADA considerations, parking/staging, and crowd bottlenecks.
- Confirm final prize list, drawing rules, and on-site finale staffing before locking any drawing ledger.

## BLOCKERS

- No software blocker found in the local launch-readiness pass.
- Physical-world verification remains required before the event can be truthfully called field-ready.

## LAUNCH CHECKLIST

- Walk every quest route in daylight with the production clue sheet and a phone.
- Place or approve all QR/passphrase materials and photograph their final positions for GM reference.
- Confirm partner permissions and free no-purchase paths.
- Confirm cemetery access rules before activating Frankenstein's Quiet Signal.
- Run a full dry run: join event, complete one GPS quest, one passphrase quest, one QR quest, one photo review, one secret chain, and one drawing-readiness review.
- Staff the Game Master console during active hours and define who can pause the event for safety.
- Re-run `git diff --check`, `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build` before deployment.
