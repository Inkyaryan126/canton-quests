# Canton Quests — Volume 1 Production Game Data Restoration Specification

**Migration Document**: `supabase/migrations/20260814020000_restore_canton_volume1_production_seed.sql`  
**Target Event**: Canton Quests: Volume 1 — The Founder's Cipher (`canton-weekend-1`)  
**Target City**: Canton, Ohio (`canton-oh`)  
**Safety Classification**: Production-Safe, Non-Destructive, Idempotent Data Restoration  

---

## 1. Executive Summary & Production Safety Invariants

This migration restores the canonical Canton Quests Volume 1 game world into Supabase production tables following an empty table state (`0 rows` across cities, locations, events, quests, players).

### Critical Safety Invariants
1. **Zero Demo Players**:
   - Test players (`ApexHunter_330`, `CantonRover`, `DowntownDecoder`) are **strictly excluded**.
   - Production player profiles are created exclusively through the verified Supabase Auth onboarding chain (`auth.users` -> `players.user_id` -> `players.id`).
2. **UUID Integrity**:
   - All primary and foreign keys use deterministic, valid UUIDv4 literals.
   - Text IDs such as `"city-canton-oh"` or `"evt-canton-vol-1"` are replaced with valid UUID literals.
3. **Idempotence & Non-Destruction**:
   - Uses `INSERT ... ON CONFLICT (...) DO UPDATE` / `DO NOTHING`.
   - **Zero** `DROP TABLE`, **zero** `TRUNCATE`, **zero** `DELETE`.
   - Safe to execute multiple times without mutating or deleting existing user data or leaderboard history.
4. **Three-Path District Architecture**:
   - Quests correctly attribute to districts (`family`, `challenge`, `secret`, `cross_city`).
   - Starting path preferences do not lock players out of completing any mission across the city grid.
5. **Real-World Safety & Frankenstein Memorial Rules**:
   - The Frankenstein Monument quest (`qst-frankenstein-west-lawn`) enforces daylight hours, respectful cemetery conduct, and strict no-touching rules.
   - Coordinates remain `NULL` (no invented coordinates prior to on-site field verification).
6. **Server-Side Answer Security**:
   - Verification passcodes and QR tokens are stored as SHA-256 digests (`sha256:...`) to prevent plaintext leakage via client views.

---

## 2. Canonical Relational Mapping & IDs

### 2.1 City Record
| Attribute | Production Value |
| :--- | :--- |
| `id` | `a0000001-0000-4000-8000-000000000001` |
| `name` | Canton |
| `slug` | `canton-oh` |
| `state` | OH |
| `is_active` | `true` |

### 2.2 Event Record
| Attribute | Production Value |
| :--- | :--- |
| `id` | `b0000001-0000-4000-8000-000000000001` |
| `city_id` | `a0000001-0000-4000-8000-000000000001` |
| `title` | Canton Quests: Volume 1 - The Founder's Cipher |
| `slug` | `canton-weekend-1` |
| `status` | `active` |
| `current_phase` | `day_1` |
| `start_time` | `2026-09-04T18:00:00Z` |
| `end_time` | `2026-09-07T22:00:00Z` |
| `theme_color` | `#f5b942` |
| `readiness_status` | `ready` |

### 2.3 Canonical Launch Locations (9 Locations)
| Location UUID | Name | Address | Partner | Radius | GPS Coordinates |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `c0000001-0000-4000-8000-000000000001` | Centennial Plaza | 330 Market Ave N | Yes | 60m | (40.7989, -81.3748) |
| `c0000001-0000-4000-8000-000000000002` | McKinley National Memorial | 800 McKinley Monument Dr NW | No | 80m | (40.8064, -81.3933) |
| `c0000001-0000-4000-8000-000000000003` | 4th Street Arts Corridor Mural | 4th St NW & Court Ave NW | Yes | 50m | (40.7995, -81.3755) |
| `c0000001-0000-4000-8000-000000000004` | Aura Craft Coffee | 414 4th St NW | Yes | 40m | (40.7998, -81.3761) |
| `c0000001-0000-4000-8000-000000000005` | Downtown Canton Arcade Vault | 218 Market Ave N | Yes | 40m | (40.7978, -81.3748) |
| `c0000001-0000-4000-8000-000000000006` | Canton Palace Theatre | 605 Market Ave N | Yes | 50m | (40.8012, -81.3748) |
| `c0000001-0000-4000-8000-000000000007` | Hall of Fame City Marker | 2121 George Halas Dr NW | No | 75m | (40.8211, -81.3985) |
| `c0000001-0000-4000-8000-000000000008` | The Onesto Historic Entrance | 225 2nd St NW | No | 45m | (40.7971, -81.3752) |
| `c0000001-0000-4000-8000-000000000009` | Frankenstein Monument at West Lawn Cemetery | 1919 7th St NW | No | 60m | NULL (field check required) |

### 2.4 Canonical Volume 1 Quests (15 Quests)
| Order | Quest UUID | Slug | Title | District / Path | Verification | XP | Entries |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `e0000001-0000-4000-8000-000000000001` | `centennial-beacon` | Open the Founder Signal | Family | GPS / Check-in | 75 | 1 |
| 2 | `e0000001-0000-4000-8000-000000000002` | `mckinley-monument-year` | The Stone Stair Cipher | Secret | Passphrase | 150 | 1 |
| 3 | `e0000001-0000-4000-8000-000000000003` | `4th-st-mural-pose` | The Painted Witness | Family | Photo | 175 | 1 |
| 4 | `e0000001-0000-4000-8000-000000000004` | `aura-coffee-scan` | The Counter-Sign at Aura | Family | QR Code | 125 | 1 |
| 5 | `e0000001-0000-4000-8000-000000000005` | `arcade-champion-video` | The Neon Victory Loop | Challenge | Video | 250 | 2 |
| 6 | `e0000001-0000-4000-8000-000000000006` | `palace-theatre-lore` | The Palace Lantern Date | Family | Passphrase | 125 | 1 |
| 7 | `e0000001-0000-4000-8000-000000000007` | `market-square-flash` | Flash Drop: Market Square Signal | Cross-City | GPS Flash | 225 | 2 |
| 8 | `e0000001-0000-4000-8000-000000000008` | `onesto-brass-motto` | The Brass Door Key | Family | Passphrase | 150 | 1 |
| 9 | `e0000001-0000-4000-8000-000000000009` | `hof-trail-emblem` | The Helmet Trail Emblem | Challenge | QR Code | 325 | 2 |
| 10 | `e0000001-0000-4000-8000-000000000010` | `frankenstein-quiet-signal` | Frankenstein's Quiet Signal | Secret | Photo | 300 | 2 |
| 11 | `e0000001-0000-4000-8000-000000000011` | `secret-cipher-77` | Secret Quest: The Founder's Three Locks | Secret | Multi-Step | 650 | 4 |
| 12 | `e0000001-0000-4000-8000-000000000012` | `founders-secret-clue` | The Founder's Keystone | Family | Passphrase | 150 | 1 |
| 13 | `e0000001-0000-4000-8000-000000000013` | `palace-marquee-flash` | Flash Drop: Palace Lantern Cipher | Cross-City | Passphrase Flash | 275 | 2 |
| 14 | `e0000001-0000-4000-8000-000000000014` | `civic-seal-snapshot` | The Civic Seal Snapshot | Family | Photo | 125 | 1 |
| 15 | `e0000001-0000-4000-8000-000000000015` | `grand-finale-cipher` | Finale: The Founder's Master Key | Cross-City | Passphrase Finale | 900 | 5 |

### 2.5 Multi-Step Quest Steps (`secret-cipher-77`)
| Step Order | Step UUID | Title | Verification Type |
| :--- | :--- | :--- | :--- |
| 1 | `f0000001-0000-4000-8000-000000000001` | Lock One: Founder Fragment | Passphrase (SHA-256) |
| 2 | `f0000001-0000-4000-8000-000000000002` | Lock Two: Painted Fragment | Passphrase (SHA-256) |
| 3 | `f0000001-0000-4000-8000-000000000003` | Lock Three: Brass Fragment | Passphrase (SHA-256) |

---

## 3. Expected Post-Migration Verification Counts

After applying migration `20260814020000_restore_canton_volume1_production_seed.sql` to Supabase:

| Table | Expected Row Count | Verification Query |
| :--- | :--- | :--- |
| `public.cities` | **1** | `SELECT count(*) FROM public.cities WHERE slug = 'canton-oh';` |
| `public.locations` | **9** | `SELECT count(*) FROM public.locations WHERE city_id = 'a0000001-0000-4000-8000-000000000001';` |
| `public.events` | **1** | `SELECT count(*) FROM public.events WHERE slug = 'canton-weekend-1';` |
| `public.quests` | **15** | `SELECT count(*) FROM public.quests WHERE event_id = 'b0000001-0000-4000-8000-000000000001';` |
| `public.quest_steps` | **3** | `SELECT count(*) FROM public.quest_steps WHERE quest_id = 'e0000001-0000-4000-8000-000000000011';` |
| `public.collectibles` | **5** | `SELECT count(*) FROM public.collectibles;` |
| `public.secret_codes` | **2** | `SELECT count(*) FROM public.secret_codes WHERE event_id = 'b0000001-0000-4000-8000-000000000001';` |
| `public.npc_characters` | **1** | `SELECT count(*) FROM public.npc_characters WHERE event_id = 'b0000001-0000-4000-8000-000000000001';` |
| `public.business_partners` | **2** | `SELECT count(*) FROM public.business_partners WHERE city_id = 'a0000001-0000-4000-8000-000000000001';` |
| `public.event_prizes` | **2** | `SELECT count(*) FROM public.event_prizes WHERE event_id = 'b0000001-0000-4000-8000-000000000001';` |
| `public.drawing_ledger_locks` | **1** | `SELECT count(*) FROM public.drawing_ledger_locks WHERE event_id = 'b0000001-0000-4000-8000-000000000001';` |
| `public.players` | **0 (Untouched)** | `SELECT count(*) FROM public.players;` (No demo players) |

---

## 4. Intentionally Excluded Test/Demo Data
- **Demo Players**: Excluded to protect the integrity of the Supabase Auth identity root (`auth.users` -> `players.user_id` -> `players.id`).
- **Demo Submissions & Scores**: Excluded to ensure a fresh, clean competitive leaderboard for real players.
