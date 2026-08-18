# Canton Quests Volume 1 Launch Readiness

**Canonical Public Launch Date**: September 11, 2026<br/>
**Event Window**: September 11, 2026 (18:00 UTC) – September 14, 2026 (22:00 UTC)<br/>
*(Historical preliminary date September 4, 2026 superseded per ADR-029)*

---

## 1. Readiness by Subsystem

### 1. SOFTWARE / ENGINEERING: **COMPLETE**
- ✅ Next.js 14 / TypeScript / Tailwind CSS core web application shell.
- ✅ Pure individual player model with unified citywide leaderboard (ADR-023).
- ✅ Three-Path starting architecture (Family, Challenge, Secret) with open-grid progression (ADR-024).
- ✅ Cryptographic Supabase Auth Email OTP identity & session resolution (ADR-025).
- ✅ Server-side authoritative proof verification (GPS radius, QR, Passphrase, Photo, Video, Multi-Step chained ciphers) (ADR-016).
- ✅ Public Spectator Mode (`/watch`) with sanitized delay-buffered feeds, broadcast airwaves, and minor protections (ADR-010, ADR-013, ADR-014).
- ✅ Game Director Live Control Console (`/admin/live`) with 1-click audience resolution, GM override, and emergency pause controls (ADR-021, ADR-022).
- ✅ The Final Quest Transparent Prize Drawing System (`/events/[slug]/drawing`) with SHA-256 ledger snapshots and human-readable ticket formula (ADR-017, ADR-020).
- ✅ Cinematic HUD effects engine & procedural Web Audio synthesizer (ADR-028).
- ✅ Street Team QR campaign attribution CLI & deterministic flyer generator (ADR-018).
- ✅ Full automated verification suite: 24 test suites, 386 tests passing, 0 TypeScript errors, 0 ESLint warnings, successful production build.

### 2. GAME CONTENT: **IN PROGRESS**
- ✅ **Digital Specifications (COMPLETE)**: 15 canonical Volume 1 quests, 3 multi-step ciphers (`secret-cipher-77`), 5 digital collectibles, 2 secret codes, 1 NPC, 2 business partner integration definitions, and 2 event prizes specified in seed data and migrations.
- 🟡 **Physical Field Clues (NOT VERIFIED)**: On-site physical clue text, mural details, plaque inscriptions, and cipher answer confirmation pending physical inspection.

### 3. DATABASE / PRODUCTION DATA: **COMPLETE**
- ✅ Idempotent production seed migration (`20260814020000_restore_canton_volume1_production_seed.sql`) and consolidated catch-up migration (`20260814030000_production_schema_catchup_and_volume1_restore.sql`).
- ✅ Database RLS policies, role elevation triggers (`trg_protect_player_role`), user ID tamper triggers (`trg_prevent_player_user_id_tampering`), and single-vote constraints (`uq_spectator_one_vote_per_event`).
- ✅ Zero demo player accounts in production seed data; all production player records root in Supabase Auth.
- 🟡 **Remote Production Deployment (IN PROGRESS)**: Execution of migration scripts on live remote Supabase project instance scheduled ahead of launch.

### 4. PHYSICAL QR / SIGNAGE: **NOT VERIFIED**
- ❌ Physical print production of QR codes and clues.
- ❌ Placement and mounting of weatherproof QR signs at outdoor Canton locations.
- ❌ Backup laminated replacement copies prepared and distributed to field marshals.
- ❌ Physical photo verification of mounted sign positions for GM reference.

### 5. PARTNER / LOCATION VERIFICATION: **NOT VERIFIED**
- ❌ Physical in-person visit to Aura Craft Coffee (414 4th St NW) to confirm counter-sign instructions and staff briefing.
- ❌ Physical in-person visit to Downtown Canton Arcade Vault (218 Market Ave N) to confirm operating hours and game challenge rules.
- ❌ West Lawn Cemetery administrative visit to verify daytime visiting policy, photography rules, and explicit approval for the Frankenstein Monument quest (`qst-frankenstein-west-lawn`). *Rule: If cemetery rules disallow game visits, hide or replace this quest before launch.*
- ❌ Physical confirmation of operating hours and public accessibility for Canton Palace Theatre and Centennial Plaza.

### 6. FIELD TESTING: **NOT VERIFIED**
- ❌ In-person cellular network signal & GPS accuracy verification at all 9 launch locations across carrier networks (Verizon, AT&T, T-Mobile).
- ❌ Full physical walking dry run of all 3 starting paths in daylight with smartphone.
- ❌ Sidewalk safety, crosswalk safety, ADA accessibility, lighting, and pedestrian bottleneck inspection along active quest routes.

### 7. FINALE / PRIZE OPERATIONS: **NOT VERIFIED**
- ❌ Procurement and physical staging of physical prize trophies and gift cards ($100 Canton Local Pass, Year of Aura Coffee VIP Pass).
- ❌ On-site Sunday Finale venue, audio/PA system, and stage schedule confirmation.
- ❌ Game Master live drawing operator briefing and test dry-run of the Final Quest Drawing tool on-site.

### 8. MARKETING: **IN PROGRESS**
- ✅ Automated Street Team flyer compositor (`npm run qr:campaign`) ready with high-DPI masters and tracking attribution URLs.
- 🟡 Physical print run of marketing flyers (Family, Challenge, Secret).
- ❌ Street team volunteer distribution across Stark County and downtown Canton leading into September 11.

### 9. LAUNCH-DAY OPERATIONS: **NOT VERIFIED**
- ❌ Staffing roster and shift schedule for Game Master live director console (`/admin/live`).
- ❌ Emergency incident protocol & weather pause escalation contact tree.
- ❌ Field marshal battery packs, high-vis badges, and backup hotspot devices.

---

## 2. Launch Gates & Blockers Summary

- **Software / Code Blockers**: **0** (All test suites, builds, and types verified clean).
- **Physical / Human Action Blockers**: **Field & partner verification required** before Volume 1 can be declared field-ready for live players.

---

## 3. Human Verification Action Checklist

1. [ ] Walk all 9 Volume 1 locations with production clue sheets and mobile device on cellular data.
2. [ ] Visit West Lawn Cemetery office to confirm historical visitor/photography policy for the Frankenstein Monument.
3. [ ] Confirm partner agreements with Aura Craft Coffee and Downtown Arcade Vault.
4. [ ] Print, laminate, and place physical QR codes and passcodes at approved nodes.
5. [ ] Procure physical prize trophies and local gift cards for the Sunday Finale.
6. [ ] Brief field operators and Game Master console staff on emergency pause protocols.
7. [ ] Execute live Supabase consolidated migration on production database and test auth OTP flow with a real phone.
