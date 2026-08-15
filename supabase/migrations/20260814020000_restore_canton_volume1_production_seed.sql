-- =============================================================================
-- Canton Quests Migration: Canonical Production Game Data Restoration (Volume 1)
-- Version: 20260814020000
-- Description: Production-safe, idempotent restoration of canonical Canton Quests
--              Volume 1 game world data (City, Locations, Event, Quests, Quest Steps,
--              Collectibles, Secret Codes, NPCs, Business Partners, Prizes).
--
-- Invariants Enforced:
--  1. Fully Idempotent (ON CONFLICT DO UPDATE / DO NOTHING).
--  2. Deterministic UUID Primary Keys for relational stability across environments.
--  3. Non-destructive: zero table wipes, zero truncations, preserves future player data.
--  4. Zero Demo Players inserted (auth.users -> players onboarding chain intact).
--  5. Sensitive answer passcodes hashed with SHA-256 for server-side verification.
--  6. Three-Path architecture districts preserved (family, challenge, secret, cross_city).
--  7. Frankenstein Monument daylight/respect safety rules preserved without invented coordinates.
-- =============================================================================

DO $$
BEGIN
  -- 1. Restore City: Canton, Ohio
  INSERT INTO public.cities (id, name, slug, state, is_active, created_at)
  VALUES (
    'a0000001-0000-4000-8000-000000000001'::uuid,
    'Canton',
    'canton-oh',
    'OH',
    true,
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    state = EXCLUDED.state,
    is_active = EXCLUDED.is_active;

  -- 2. Restore Canonical Launch Locations (9 Locations)
  INSERT INTO public.locations (
    id, city_id, name, address, latitude, longitude,
    location_notes, is_partner, radius_meters, access_notes, opening_hours, created_at
  )
  VALUES
    (
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Centennial Plaza',
      '330 Market Ave N, Canton, OH 44702',
      40.7989,
      -81.3748,
      'Downtown Canton central gathering space with outdoor screens and cafe seating.',
      true,
      60,
      'Open public plaza 6:00 AM – 11:00 PM daily. High pedestrian zone.',
      '6:00 AM - 11:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000002'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'McKinley National Memorial',
      '800 McKinley Monument Dr NW, Canton, OH 44708',
      40.8064,
      -81.3933,
      'Historic 108-step monument overlooking the park and city.',
      false,
      80,
      'Park grounds open dawn to dusk. Stairway can be slick in rainy weather.',
      'Dawn - Dusk',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000003'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      '4th Street Arts Corridor Mural',
      '4th St NW & Court Ave NW, Canton, OH 44702',
      40.7995,
      -81.3755,
      'Vibrant street art wall in the heart of downtown Canton Arts District.',
      true,
      50,
      'Public sidewalk access 24/7. Watch for downtown vehicular traffic.',
      '24/7 Public Access',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000004'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Aura Craft Coffee',
      '414 4th St NW, Canton, OH 44702',
      40.7998,
      -81.3761,
      'Local partner coffee shop. Look near the espresso counter or patio area.',
      true,
      40,
      'Indoor scanning during business hours (7 AM - 6 PM M-S). Patio access 24/7.',
      '7:00 AM - 6:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000005'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Downtown Canton Arcade Vault',
      '218 Market Ave N, Canton, OH 44702',
      40.7978,
      -81.3748,
      'Retro arcade venue featuring vintage pinball and arcade cabinets.',
      true,
      40,
      'Family friendly hours 12 PM - 8 PM.',
      '12:00 PM - 10:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000006'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Canton Palace Theatre',
      '605 Market Ave N, Canton, OH 44702',
      40.8012,
      -81.3748,
      'Historic theater marquee and architectural gem of Canton.',
      true,
      50,
      'Marquee visible from sidewalk 24/7.',
      '24/7 Outdoor Access',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000007'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Hall of Fame City Marker',
      '2121 George Halas Dr NW, Canton, OH 44708',
      40.8211,
      -81.3985,
      'Commemorative plaza marker celebrating Canton football heritage.',
      false,
      75,
      'Outdoor trail plaza open daily.',
      'Dawn - Dusk',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000008'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'The Onesto Historic Entrance',
      '225 2nd St NW, Canton, OH 44702',
      40.7971,
      -81.3752,
      'Grand historic hotel building with ornate brass entrance doors.',
      false,
      45,
      'Public sidewalk view.',
      '24/7',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000009'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Frankenstein Monument at West Lawn Cemetery',
      '1919 7th St NW, Canton, OH 44708',
      NULL,
      NULL,
      'Human field verification required before launch: confirm exact monument location, cemetery visitor rules, and any photography restrictions with West Lawn Cemetery staff.',
      false,
      60,
      'Daylight cemetery visit only during posted visitor hours. Stay on cemetery paths and roads, keep voices low, and never touch, climb, lean on, decorate, or disturb graves, monuments, markers, flowers, or memorial items.',
      'Posted visitor hours only; daylight access. Gates may close earlier in winter. Reconfirm before launch.',
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    location_notes = EXCLUDED.location_notes,
    is_partner = EXCLUDED.is_partner,
    radius_meters = EXCLUDED.radius_meters,
    access_notes = EXCLUDED.access_notes,
    opening_hours = EXCLUDED.opening_hours;

  -- 3. Restore Canonical Volume 1 Event: The Founder's Cipher
  INSERT INTO public.events (
    id, city_id, title, slug, description, status, current_phase, is_paused,
    start_time, end_time, registration_start_time, basic_instructions,
    safety_notes, map_center_lat, map_center_lon, theme_color, readiness_status, created_at
  )
  VALUES (
    'b0000001-0000-4000-8000-000000000001'::uuid,
    'a0000001-0000-4000-8000-000000000001'::uuid,
    'Canton Quests: Volume 1 - The Founder''s Cipher',
    'canton-weekend-1',
    'A real-world Canton adventure of founder marks, hidden field signals, public art, history nodes, partner stops, and one respectful cemetery mystery.',
    'active',
    'day_1',
    false,
    '2026-09-04T18:00:00Z',
    '2026-09-07T22:00:00Z',
    '2026-08-15T00:00:00Z',
    '1. Choose a mission from the board.' || E'\n' ||
    '2. Travel only to public or partner-approved places during posted hours.' || E'\n' ||
    '3. Use the on-site clue, QR, photo, or GPS check to submit proof.' || E'\n' ||
    '4. Earn XP and drawing entries, then check progress and the leaderboard.',
    'Use marked crosswalks, obey posted hours, avoid private property, and skip any location that feels unsafe or unavailable. Cemetery quests are daylight-only and require respectful conduct.',
    40.7989,
    -81.3748,
    '#f5b942',
    'ready',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (slug) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    current_phase = EXCLUDED.current_phase,
    is_paused = EXCLUDED.is_paused,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    registration_start_time = EXCLUDED.registration_start_time,
    basic_instructions = EXCLUDED.basic_instructions,
    safety_notes = EXCLUDED.safety_notes,
    map_center_lat = EXCLUDED.map_center_lat,
    map_center_lon = EXCLUDED.map_center_lon,
    theme_color = EXCLUDED.theme_color,
    readiness_status = EXCLUDED.readiness_status;

  -- 4. Restore Canonical Collectibles (5 Collectibles)
  INSERT INTO public.collectibles (id, name, slug, description, badge_symbol, rarity, created_at)
  VALUES
    (
      'd0000001-0000-4000-8000-000000000001'::uuid,
      'Founder Token',
      'founder-token',
      'Awarded to agents who crack the Founder Cipher at Centennial Plaza.',
      '🏅',
      'common',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000002'::uuid,
      'Cipher Fragment Alpha',
      'cipher-fragment-1',
      'First piece of the 3-part Canton Master Cipher.',
      '🧩',
      'rare',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000003'::uuid,
      'Cipher Fragment Beta',
      'cipher-fragment-2',
      'Second piece of the 3-part Canton Master Cipher.',
      '🧩',
      'rare',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000004'::uuid,
      'Cipher Fragment Gamma',
      'cipher-fragment-3',
      'Final piece of the 3-part Canton Master Cipher.',
      '🧩',
      'legendary',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000005'::uuid,
      'Palace Theatre Golden Seal',
      'palace-seal',
      'Historic seal granted for completing the Palace Theatre marquee lore.',
      '👑',
      'legendary',
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    badge_symbol = EXCLUDED.badge_symbol,
    rarity = EXCLUDED.rarity;

  -- 5. Restore Canonical Volume 1 Quests (15 Quests)
  INSERT INTO public.quests (
    id, event_id, location_id, title, slug, description, instructions,
    point_value, xp_reward, drawing_entry_reward, difficulty, category,
    verification_type, target_code, proof_requirement, is_flash, starts_at, expires_at,
    status, sort_order, radius_meters, prerequisite_quest_id, unlock_condition_type,
    require_location_verification, require_qr_and_location, claim_limit, current_claims,
    is_secret, is_finale_quest, gm_notes, safety_notes, starting_path, created_at
  )
  VALUES
    (
      'e0000001-0000-4000-8000-000000000001'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Open the Founder Signal',
      'centennial-beacon',
      'Begin Volume 1 at Centennial Plaza, where the Founder Cipher first lights up the city grid.',
      'Go to Centennial Plaza, stand in the public plaza area, and verify your location to activate your field log.',
      75, 75, 1, 'easy', 'exploration',
      'checkin', NULL, 'GPS check-in from the public plaza area.', false, NULL, NULL,
      'active', 1, 60, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Field verify plaza access on launch weekend and place opening signage where it does not obstruct pedestrian flow.',
      'Use public sidewalks and plaza areas. Do not enter closed event setups, stages, or restricted maintenance areas.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000002'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000002'::uuid,
      'The Stone Stair Cipher',
      'mckinley-monument-year',
      'The monument stairs guard a dated marker. Read the site itself and recover the four digits.',
      'Visit the public memorial grounds during open hours. Find the relevant dedication marker near the monument approach and enter the four-digit year requested by the quest.',
      150, 150, 1, 'medium', 'puzzle',
      'passphrase', 'sha256:0e3c49c57d4ab2494d55671730c356687405eb0423cc755381399f2f431b2d16', 'Enter the four-digit year found on the physical marker identified by the quest.', false, NULL, NULL,
      'active', 2, 80, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Existing server hash expects the verified four-digit answer. Reconfirm plaque wording and target marker before printing clue cards.',
      'Daylight recommended. Stairs may be slick; players do not need to climb quickly or leave public paths.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000003'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000003'::uuid,
      'The Painted Witness',
      '4th-st-mural-pose',
      'The Arts District keeps a visual clue in plain sight. Capture your team with the city color behind you.',
      'Stand on the public sidewalk near the mural and take a respectful photo of your team or callsign card with the mural visible.',
      175, 175, 1, 'medium', 'creative',
      'photo', NULL, 'Upload a photo or proof link showing the mural and your team/callsign card.', false, NULL, NULL,
      'active', 3, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Manual review should verify the mural is visible and the proof appears original to the event window.',
      'Stay on sidewalks, keep storefront entrances clear, and watch traffic when crossing downtown streets.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000004'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000004'::uuid,
      'The Counter-Sign at Aura',
      'aura-coffee-scan',
      'A partner signal is waiting at the coffee counter. No purchase required.',
      'During posted business hours, find the official Canton Quests QR card at Aura Craft Coffee and enter the printed QR passcode.',
      125, 125, 1, 'easy', 'business_partner',
      'qr', 'sha256:a3cd92f342c2b4d31e2025bd95b19b10ed3f996b3360dcfd57fe3233767ac8c9', 'Enter the QR passcode displayed on the official Canton Quests card.', false, NULL, NULL,
      'active', 4, 40, NULL, 'none',
      false, true, NULL, 0,
      false, false,
      'Requires partner permission, final QR placement, and free no-purchase access path before launch.',
      'Visit only during partner-approved hours, respect staff and customers, and do not block the counter.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000005'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000005'::uuid,
      'The Neon Victory Loop',
      'arcade-champion-video',
      'A partner-ready media quest slot for an all-ages arcade or game venue.',
      'If the partner site is confirmed active, record a short celebration clip near the approved game area. If the site is not staffed or approved, skip this mission.',
      250, 250, 2, 'hard', 'photo_video',
      'video', NULL, 'Upload a short video or proof link from the approved partner area.', false, NULL, NULL,
      'active', 5, 40, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Partner-ready slot. Confirm venue name, hours, minor policy, and exact proof backdrop before activation.',
      'Partner permission required. Family-friendly hours only; no alcohol purchase or adult-only access may be required.',
      'challenge', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000006'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000006'::uuid,
      'The Palace Lantern Date',
      'palace-theatre-lore',
      'The Palace Theatre facade holds a date tied to Canton show-night lore.',
      'From the public sidewalk, inspect the approved exterior marker and enter the four-digit year requested by this quest.',
      125, 125, 1, 'easy', 'trivia',
      'passphrase', 'sha256:3d5d2c29712a98874d8142d229c4bce09158a144ad376c2b68411f240878a9c1', 'Enter the four-digit year from the approved exterior marker.', false, NULL, NULL,
      'active', 6, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Existing server hash expects the verified four-digit answer. Reconfirm marker text before launch.',
      'Stay on public sidewalks and keep theatre entrances clear. No ticket purchase is required.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000007'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Flash Drop: Market Square Signal',
      'market-square-flash',
      'A live signal can be activated by the Game Master during the event window.',
      'When the Game Master broadcasts this drop, go to Centennial Plaza and verify your public-plaza location before the timer expires.',
      225, 225, 2, 'medium', 'flash',
      'checkin', NULL, 'Timed GPS check-in during an active Game Master flash window.', true, '2026-09-05T19:00:00Z', '2026-09-05T19:45:00Z',
      'active', 7, 60, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Use live controls to adjust the active window based on weather and field conditions.',
      'No running into traffic or cutting through restricted areas. The drop is optional and should be paused if the plaza is crowded or closed.',
      'cross_city', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000008'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000008'::uuid,
      'The Brass Door Key',
      'onesto-brass-motto',
      'A downtown doorway hides a one-word key in its architectural details.',
      'From the public sidewalk, inspect the approved entrance detail and enter the single word identified by the field clue.',
      150, 150, 1, 'medium', 'observation',
      'passphrase', 'sha256:1d3c51271f477ae14e45c93c4de9d71c88e659ec9df9ac491b917fcbee0987eb', 'Enter the exact word from the approved public-facing architectural detail.', false, NULL, NULL,
      'active', 8, 45, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Reconfirm visible clue target and public viewing boundary before launch.',
      'Public sidewalk view only. Do not enter private residential or lobby areas unless invited by posted public access.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000009'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000007'::uuid,
      'The Helmet Trail Emblem',
      'hof-trail-emblem',
      'A football-heritage route can host a high-value QR signal once field placement is confirmed.',
      'Find the official Canton Quests QR emblem at the approved public trail/plaza marker and enter its passcode.',
      325, 325, 2, 'hard', 'trivia',
      'qr', 'sha256:e5ec5382a5c868db291798d6f727c21b8b2e6e589a09849c8dbf4c5e981a24bd', 'Enter the QR passcode from the official field emblem.', false, NULL, NULL,
      'active', 9, 75, NULL, 'none',
      false, true, NULL, 0,
      false, false,
      'Human verification required for exact placement, permission, QR weatherproofing, and pedestrian safety.',
      'Use marked pedestrian routes and daylight hours. Do not cross traffic outside crosswalks.',
      'challenge', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000010'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000009'::uuid,
      'Frankenstein''s Quiet Signal',
      'frankenstein-quiet-signal',
      'A cemetery monument becomes a hushed field node. Find it respectfully, document your visit, and leave the place exactly as you found it.',
      'Visit West Lawn Cemetery only during posted public visiting hours. From a path or respectful standing distance, take one quiet photo that shows your callsign card near the Frankenstein monument area without touching or disturbing any grave or memorial.',
      300, 300, 2, 'hard', 'observation',
      'photo', NULL, 'Upload a respectful daytime photo or proof link showing your callsign card and the monument area from a safe distance.', false, NULL, NULL,
      'active', 10, 60, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Human verification required before launch: exact monument coordinates, cemetery hours/rules, photography policy, staff permission if needed, and whether this should be enabled or temporarily hidden.',
      'Daylight only. Confirm cemetery hours before visiting. No touching, climbing, rubbing, decorating, moving items, loud behavior, nighttime access, trespassing, or interference with graves, markers, services, visitors, or staff.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000011'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000003'::uuid,
      'Secret Quest: The Founder''s Three Locks',
      'secret-cipher-77',
      'A higher-difficulty mystery chain begins when three downtown fragments start speaking to each other.',
      'Solve the three locks in order. Each lock uses a clue fragment gathered from a completed downtown mission; the next lock opens only after the previous one verifies.',
      650, 650, 4, 'epic', 'secret',
      'multi_step', 'sha256:aaa637bb2b24bc3e307a3201e22c694cdc4566365c991ccd64fa93bae23f3996', 'Verify all three field-fragment passphrases in sequence.', false, NULL, NULL,
      'active', 11, 50, 'e0000001-0000-4000-8000-000000000008'::uuid, 'prerequisite',
      false, false, NULL, 0,
      true, false,
      'Do not publish fragment answers. Confirm all three fragment cards are placed, ordered, and mapped to server step hashes before enabling this chain for competitive play.',
      'Use only public sidewalks and approved partner/public spaces while gathering fragments.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000012'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'The Founder''s Keystone',
      'founders-secret-clue',
      'The opening signal reveals a second mark at the plaza.',
      'After opening the Founder Signal, inspect the approved public clue card or marker at Centennial Plaza and enter the keystone word.',
      150, 150, 1, 'medium', 'puzzle',
      'passphrase', 'sha256:036b0ec8125ea4188177e958f876254c06724168970a02060c29551e083595c6', 'Enter the keystone word from the approved physical clue.', false, NULL, NULL,
      'active', 12, 60, 'e0000001-0000-4000-8000-000000000001'::uuid, 'prerequisite',
      true, false, NULL, 0,
      false, false,
      'Server hash expects launch clue value. Place clue card only after final field route check.',
      'Stay in public plaza areas and do not move or alter any clue card or fixture.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000013'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000006'::uuid,
      'Flash Drop: Palace Lantern Cipher',
      'palace-marquee-flash',
      'A timed theatre-front cipher for the Game Master to activate during safe evening visibility.',
      'When activated, inspect the approved public-facing Palace clue and enter the flash passcode before the timer expires.',
      275, 275, 2, 'hard', 'flash',
      'passphrase', 'sha256:e49c9702b08e49280244ca823d1a747df7a3386f0cc67a990a6e5fd9094c6a70', 'Enter flash passcode before expiry.', true, '2026-09-05T23:00:00Z', '2026-09-05T23:30:00Z',
      'active', 13, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Evening flash is optional. Cancel if weather, crowding, or lighting creates field risk.',
      'Only activate if the sidewalk is well lit, public, and calm. No road crossings outside marked crosswalks and no building entry required.',
      'cross_city', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000014'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'The Civic Seal Snapshot',
      'civic-seal-snapshot',
      'A family-friendly photo stop that turns the city center into a team badge moment.',
      'Find an approved public civic backdrop near the plaza and take a photo of your team/callsign card making a clear Canton Quests victory mark.',
      125, 125, 1, 'easy', 'creative',
      'photo', NULL, 'Upload a photo or proof link from the approved public civic backdrop.', false, NULL, NULL,
      'active', 14, 60, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Pick final backdrop after human site walk; avoid exposing private business entrances or minors in public recap feeds.',
      'Keep sidewalks clear and do not photograph strangers closely without consent.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000015'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Finale: The Founder''s Master Key',
      'grand-finale-cipher',
      'The final lock opens only when the Game Master starts the finale sprint.',
      'Qualified players receive the final prompt during Finale Mode. Enter the master key announced through official event channels.',
      900, 900, 5, 'epic', 'finale',
      'passphrase', 'sha256:8a2199b47b3f30d63a023f8dcfc82edc66bf863b3b23189703224923ad25c56f', 'Finale qualification and official Game Master prompt required.', false, NULL, NULL,
      'active', 15, 60, NULL, 'manual',
      false, false, NULL, 0,
      false, true,
      'Keep inactive until finale operations are staffed. Confirm drawing ledger status before awarding final entries.',
      'Finale prompt must never require rushing, trespassing, unsafe driving, or nighttime cemetery access.',
      'cross_city', '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (event_id, slug) DO UPDATE SET
    location_id = EXCLUDED.location_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    point_value = EXCLUDED.point_value,
    xp_reward = EXCLUDED.xp_reward,
    drawing_entry_reward = EXCLUDED.drawing_entry_reward,
    difficulty = EXCLUDED.difficulty,
    category = EXCLUDED.category,
    verification_type = EXCLUDED.verification_type,
    target_code = EXCLUDED.target_code,
    proof_requirement = EXCLUDED.proof_requirement,
    is_flash = EXCLUDED.is_flash,
    starts_at = EXCLUDED.starts_at,
    expires_at = EXCLUDED.expires_at,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    radius_meters = EXCLUDED.radius_meters,
    prerequisite_quest_id = EXCLUDED.prerequisite_quest_id,
    unlock_condition_type = EXCLUDED.unlock_condition_type,
    require_location_verification = EXCLUDED.require_location_verification,
    require_qr_and_location = EXCLUDED.require_qr_and_location,
    is_secret = EXCLUDED.is_secret,
    is_finale_quest = EXCLUDED.is_finale_quest,
    gm_notes = EXCLUDED.gm_notes,
    safety_notes = EXCLUDED.safety_notes,
    starting_path = EXCLUDED.starting_path;

  -- 6. Restore Quest Steps for Multi-Step Quest 'Secret Quest: The Founder''s Three Locks'
  INSERT INTO public.quest_steps (
    id, quest_id, step_order, title, instructions, verification_type, target_code, location_id, radius_meters, created_at
  )
  VALUES
    (
      'f0000001-0000-4000-8000-000000000001'::uuid,
      'e0000001-0000-4000-8000-000000000011'::uuid,
      1,
      'Lock One: Founder Fragment',
      'Use the fragment revealed by the Founder Signal route. Enter only the field phrase printed on the approved physical clue.',
      'passphrase',
      'sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106',
      'c0000001-0000-4000-8000-000000000001'::uuid,
      60,
      '2026-08-01T00:00:00Z'
    ),
    (
      'f0000001-0000-4000-8000-000000000002'::uuid,
      'e0000001-0000-4000-8000-000000000011'::uuid,
      2,
      'Lock Two: Painted Fragment',
      'Use the fragment connected to the Painted Witness. Enter the field phrase exactly as it appears in the event clue.',
      'passphrase',
      'sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d',
      'c0000001-0000-4000-8000-000000000003'::uuid,
      50,
      '2026-08-01T00:00:00Z'
    ),
    (
      'f0000001-0000-4000-8000-000000000003'::uuid,
      'e0000001-0000-4000-8000-000000000011'::uuid,
      3,
      'Lock Three: Brass Fragment',
      'Use the final fragment from the Brass Door Key. Enter the field phrase to close the chain and claim the mystery reward.',
      'passphrase',
      'sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c',
      'c0000001-0000-4000-8000-000000000008'::uuid,
      45,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (quest_id, step_order) DO UPDATE SET
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    verification_type = EXCLUDED.verification_type,
    target_code = EXCLUDED.target_code,
    location_id = EXCLUDED.location_id,
    radius_meters = EXCLUDED.radius_meters;

  -- 7. Restore Canonical Secret Codes (2 Codes)
  INSERT INTO public.secret_codes (
    id, event_id, code, description, bonus_points, max_redemptions, current_redemptions, is_active, grant_collectible_id, created_at
  )
  VALUES
    (
      '50000001-0000-4000-8000-000000000001'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'sha256:67a9464364c6f818e5ee997ee0a2b4ce41132639b4498d2a8ceedf70b0d90834',
      'Game Master Opening Broadcast Code',
      150, 50, 0, true,
      'd0000001-0000-4000-8000-000000000001'::uuid,
      '2026-08-07T18:00:00Z'
    ),
    (
      '50000001-0000-4000-8000-000000000002'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      'sha256:02afa6fe2b15c793aad3c73636cbc91539816da99dc43144712b3bf405933eca',
      'Handed out by roaming NPC "The Courier" near Arts District',
      200, 15, 0, true,
      'd0000001-0000-4000-8000-000000000005'::uuid,
      '2026-08-07T19:30:00Z'
    )
  ON CONFLICT (event_id, code) DO UPDATE SET
    description = EXCLUDED.description,
    bonus_points = EXCLUDED.bonus_points,
    max_redemptions = EXCLUDED.max_redemptions,
    is_active = EXCLUDED.is_active,
    grant_collectible_id = EXCLUDED.grant_collectible_id;

  -- 8. Restore Canonical NPC Character: The Courier
  INSERT INTO public.npc_characters (
    id, event_id, alias_name, description, avatar_symbol, is_active, current_zone, clue_hint, secret_code, operator_notes, last_spotted_at
  )
  VALUES (
    '60000001-0000-4000-8000-000000000001'::uuid,
    'b0000001-0000-4000-8000-000000000001'::uuid,
    'The Courier',
    'A mysterious agent roaming downtown Canton handing out secret passphrase cards.',
    '🕵️',
    true,
    '4th Street Arts Corridor',
    'Look near the giant street mural or Aura Craft Coffee patio.',
    'Distributed in person by The Courier',
    'Street team NPC for Arts District corridor',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (id) DO UPDATE SET
    alias_name = EXCLUDED.alias_name,
    description = EXCLUDED.description,
    avatar_symbol = EXCLUDED.avatar_symbol,
    is_active = EXCLUDED.is_active,
    current_zone = EXCLUDED.current_zone,
    clue_hint = EXCLUDED.clue_hint,
    secret_code = EXCLUDED.secret_code,
    operator_notes = EXCLUDED.operator_notes;

  -- 9. Restore Canonical Business Partners (2 Partners)
  INSERT INTO public.business_partners (
    id, city_id, name, address, contact_notes, public_instructions, is_active, created_at
  )
  VALUES
    (
      '70000001-0000-4000-8000-000000000001'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Aura Craft Coffee',
      '414 4th St NW, Canton, OH 44702',
      'Partner coffee shop providing QR card placement and perk discounts.',
      'Show completed quest screen at counter for 10% off espresso drinks!',
      true,
      '2026-08-01T00:00:00Z'
    ),
    (
      '70000001-0000-4000-8000-000000000002'::uuid,
      'a0000001-0000-4000-8000-000000000001'::uuid,
      'Downtown Canton Arcade Vault',
      '218 Market Ave N, Canton, OH 44702',
      'Arcade venue partner.',
      'Show completed quest screen for 5 free game tokens!',
      true,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    contact_notes = EXCLUDED.contact_notes,
    public_instructions = EXCLUDED.public_instructions,
    is_active = EXCLUDED.is_active;

  -- 10. Restore Canonical Event Prizes (2 Prizes)
  INSERT INTO public.event_prizes (
    id, event_id, title, sponsor_name, quantity, eligibility_rule, sort_order, created_at
  )
  VALUES
    (
      '80000001-0000-4000-8000-000000000001'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      '🏆 Canton Quest Champion Trophy & $100 Local Gift Pass',
      'Downtown Canton Partnership',
      1,
      'Highest overall XP score at Finale',
      1,
      '2026-08-01T00:00:00Z'
    ),
    (
      '80000001-0000-4000-8000-000000000002'::uuid,
      'b0000001-0000-4000-8000-000000000001'::uuid,
      '☕ Year of Aura Coffee VIP Pass',
      'Aura Craft Coffee',
      1,
      'Winner of Business Partner Trail Challenge',
      2,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    event_id = EXCLUDED.event_id,
    title = EXCLUDED.title,
    sponsor_name = EXCLUDED.sponsor_name,
    quantity = EXCLUDED.quantity,
    eligibility_rule = EXCLUDED.eligibility_rule,
    sort_order = EXCLUDED.sort_order;

  -- 11. Ensure Open Drawing Ledger Lock Record Exists
  INSERT INTO public.drawing_ledger_locks (event_id, is_locked, status, created_at, updated_at)
  VALUES (
    'b0000001-0000-4000-8000-000000000001'::uuid,
    false,
    'open',
    '2026-08-01T00:00:00Z',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (event_id) DO NOTHING;

END $$;
