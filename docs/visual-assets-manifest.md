# Canton Quests — Master Visual Assets Manifest & Architecture Map

## 1. Asset Directory & Placement Structure

All production assets are located under `public/canton-quests/` with strong typed references exported via `lib/marketing-assets.ts`.

---

## 2. Complete Asset Matrix & Integration Mapping

| # | Asset Filename | Source Path | Destination Path | Target Component / Page | State / Role | Desktop / Mobile Use | Optimization Status |
|---|---|---|---|---|---|---|---|
| 1 | `canton_quests.png` | `public/canton-quests/canton_quests.png` | `/canton-quests/canton_quests.png` | `CantonQuestsLogo.tsx`, `CinematicNav.tsx`, `Header.tsx`, `app/page.tsx` | Primary Brand Emblem & Lockup | Responsive logo with preserved aspect ratio | Lossless PNG (68 KB) |
| 2 | `card_available.png` | `public/canton-quests/card_available.png` | `/canton-quests/card_available.png` | `QuestCard.tsx`, `app/quests/page.tsx` | AVAILABLE / ACTIVE quest frame | Upper photo window with HTML metadata | 1086x1448 frame |
| 3 | `card_locked.png` | `public/canton-quests/card_locked.png` | `/canton-quests/card_locked.png` | `QuestCard.tsx`, `app/quests/page.tsx` | LOCKED / Unavailable quest frame | Stealth dark aesthetic | 1086x1448 frame |
| 4 | `card_complete.png` | `public/canton-quests/card_complete.png` | `/canton-quests/card_complete.png` | `QuestCard.tsx`, `app/quests/page.tsx` | COMPLETED collectible quest frame | Brilliant gold collectible finish | 1122x1402 frame |
| 5 | `card_poster.png` | `public/canton-quests/card_poster.png` | `/canton-quests/card_poster.png` | `QuestCard.tsx`, `app/events/[slug]/quests/[questId]/page.tsx` | FEATURED / Hero Quest Spotlight | Large photo focal window | 1086x1448 frame |
| 6 | `three_doors.png` | `public/canton-quests/three_doors.png` | `/canton-quests/three_doors.png` | `ThreePathSelector.tsx`, `app/page.tsx` | THREE DOORS Path Selector Master Portal | 3-portal clickable hero selector image | High resolution PNG |
| 7 | `palace.png` | `public/canton-quests/palace.png` | `/canton-quests/palace.png` | `lib/marketing-assets.ts`, `app/page.tsx`, `app/quests/page.tsx` | Palace Theatre Real Landmark Art | Arts District / Family quest backdrop & destination card | 781x919 PNG |
| 10 | `football.png` | `public/canton-quests/football.png` | `/canton-quests/football.png` | `lib/marketing-assets.ts`, `app/page.tsx`, `app/quests/page.tsx` | Football Heritage / Hall of Fame Art | Challenge path / Helmet Trail quest backdrop | 870x924 PNG |
| 11 | `frank.png` | `public/canton-quests/frank.png` | `/canton-quests/frank.png` | `lib/marketing-assets.ts`, `app/quests/page.tsx`, `SecretLanding.tsx` | West Lawn Frankenstein Monument Art | Secret path / West Lawn respectful cipher quest | 1623x445 PNG |
| 12 | `goosewall.png` | `public/canton-quests/goosewall.png` | `/canton-quests/goosewall.png` | `lib/marketing-assets.ts`, `app/page.tsx`, `ChallengeLanding.tsx` | Mother Goose Land Wall / Mural Art | Challenge zone landmark destination card | 761x582 PNG |
| 13 | `goosewillie.png` | `public/canton-quests/goosewillie.png` | `/canton-quests/goosewillie.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx`, `app/quests/page.tsx` | Mother Goose Land Whale / Willie Art | Challenge zone kinetic landmark | 819x707 PNG |
| 14 | `monument.png` | `public/canton-quests/monument.png` | `/canton-quests/monument.png` | `lib/marketing-assets.ts`, `app/page.tsx`, `app/quests/page.tsx` | McKinley National Memorial Art | Secret zone / Monument Park destination card | 1623x445 PNG |
| 15 | `Quest_board.png` | `public/canton-quests/Quest_board.png` | `/canton-quests/Quest_board.png` | `app/quests/page.tsx` | Pre-launch Quest Board Backdrop | Grid Locked HUD banner backdrop (HTML copy) | 1672x941 PNG |
| 16 | `leaderboard.png` | `public/canton-quests/leaderboard.png` | `/canton-quests/leaderboard.png` | `app/leaderboard/page.tsx`, `Leaderboard.tsx` | Pre-season Leaderboard Backdrop | Pre-Season Active HUD banner backdrop (HTML copy) | 1672x941 PNG |
| 17 | `game_master_transmission.png` | `public/canton-quests/game_master_transmission.png` | `/canton-quests/game_master_transmission.png` | `app/watch/page.tsx`, `FlashDropEffect.tsx`, `GameMomentOverlay.tsx` | Game Master Alert / Transmission Overlay | Full-screen transmission backdrop | 1672x941 PNG |
| 18 | `prize_vault.png` | `public/canton-quests/prize_vault.png` | `/canton-quests/prize_vault.png` | `app/how-it-works/page.tsx`, `app/profile/page.tsx`, `app/page.tsx` | Prize Vault & Sunday Drawing Art | Transparent Prize Drawing explainer card | 1672x941 PNG |
| 19 | `player_profile.png` | `public/canton-quests/player_profile.png` | `/canton-quests/player_profile.png` | `app/profile/page.tsx`, `PlayerIdentityBar.tsx` | Player Profile & Field Log HUD Backdrop | Responsive HUD panel backdrop | 1672x941 PNG |
| 20 | `quest_achievement_badges.png` | `public/canton-quests/quest_achievement_badges.png` | `/canton-quests/quest_achievement_badges.png` | `app/profile/page.tsx`, `AchievementEffect.tsx` | Collectible Achievement Badges Showcase | Badges gallery showcase and unlock background | 1536x1024 PNG |
| 21 | `footer_endoftrans.png` | `public/canton-quests/footer_endoftrans.png` | `/canton-quests/footer_endoftrans.png` | `CinematicFooter.tsx` | End of Transmission Footer Backdrop | Responsive ambient footer background with gold energy | 1672x941 PNG |
| 22 | `cq-briefing-transmission.mp4` | `public/canton-quests/cq-briefing-transmission.mp4` | `/canton-quests/cq-briefing-transmission.mp4` | `app/page.tsx`, `app/how-it-works/page.tsx` | Promotional Briefing Video & Modal | Faststart H.264 stream with user audio controls | 1080p MP4 |
| 23 | `cq-briefing-poster.jpg` | `public/canton-quests/cq-briefing-poster.jpg` | `/canton-quests/cq-briefing-poster.jpg` | `BriefingVideoModal.tsx`, `app/page.tsx`, `app/how-it-works/page.tsx` | Video Poster Frame | High resolution thumbnail frame for video player | 1080p JPG (280 KB) |
| 24 | `skate_park.png` | `public/canton-quests/quests/challenge/skate_park.png` | `/canton-quests/quests/challenge/skate_park.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx` | Challenge Card 01 — Skate Park Check-In | Standalone mission card for 9th Street Skate Park | 1024x1536 PNG |
| 25 | `the_open_ground.png` | `public/canton-quests/quests/challenge/the_open_ground.png` | `/canton-quests/quests/challenge/the_open_ground.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx` | Challenge Card 02 — The Open Ground | Standalone mission card for Challenge Field | 1024x1536 PNG |
| 26 | `silo.png` | `public/canton-quests/quests/challenge/silo.png` | `/canton-quests/quests/challenge/silo.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx` | Challenge Card 03 — The Tower | Standalone mission card for The Tower / Silo | 1024x1536 PNG |
| 27 | `mother_mural.png` | `public/canton-quests/quests/challenge/mother_mural.png` | `/canton-quests/quests/challenge/mother_mural.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx` | Challenge Card 04 — The Mural | Standalone mission card for Mother Goose Land mural wall | 1024x1536 PNG |
| 28 | `willie.png` | `public/canton-quests/quests/challenge/willie.png` | `/canton-quests/quests/challenge/willie.png` | `lib/marketing-assets.ts`, `ChallengeLanding.tsx` | Challenge Card 05 — Willie the Whale | Standalone mission card for Willie the Whale | 1024x1536 PNG |

---

## 3. Visual & Technical Invariants

1. **No Baked-in Fake Data**: All text, ranks, points, XP, and timers are rendered cleanly as accessible HTML over the artwork backdrops.
2. **Real Geography Preserved**: Palace Theatre is in the Arts District, Mother Goose Land / Willie is in Challenge, and Monument / West Lawn is in Secret.
3. **Pure Individual Competition**: All 3 paths share 1 individual leaderboard with 100% open quest access across Canton.
4. **Mobile First**: Touch targets >= 48px, high sunlight contrast, and zero horizontal overflow across 375px, 390px, and 430px devices.
