import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canton Quests — Production Schema Catch-Up & Volume 1 Restore Migration (20260814030000)', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20260814030000_production_schema_catchup_and_volume1_restore.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');

  it('1. Migration file exists, is non-empty, and enables uuid extension', () => {
    expect(sql).toBeDefined();
    expect(sql.length).toBeGreaterThan(10000);
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  });

  it('2. Enforces non-destructive idempotency (no DROP TABLE, no TRUNCATE, no destructive DELETE)', () => {
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
    expect(sql).not.toMatch(/^\s*DROP\s+TABLE\b/im);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM\s+public\.players/im);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM\s+public\.users/im);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM\s+auth\.users/im);
  });

  it('3. Enforces zero fake/demo player seeding', () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.players/i);
    expect(sql).not.toContain('ApexHunter_330');
    expect(sql).not.toContain('CantonRover');
    expect(sql).not.toContain('DowntownDecoder');
  });

  it('4. Establishes Phase 4 Event Factory schema extensions and tables', () => {
    // Events columns
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS registration_start_time TIMESTAMPTZ');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS safety_notes TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION DEFAULT 40.7989');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS map_center_lon DOUBLE PRECISION DEFAULT -81.3748');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#f59e0b'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS readiness_status TEXT DEFAULT 'draft'");

    // Submissions & NPC extensions
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS reviewer_notes TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS review_flags JSONB');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS retry_requested BOOLEAN DEFAULT false');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS operator_notes TEXT');

    // Generated QRs & Templates
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.generated_qrs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.quest_templates');
  });

  it('5. Establishes Phase 5.1 Spectator Engine tables, views, triggers, and RPCs', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_event_options');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_votes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_effects');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.public_game_feed');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.host_broadcasts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.spectator_sessions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.spectator_system_settings');

    // Sanitized Views
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_audience_events');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_audience_event_options');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_host_broadcasts');

    // Spectator RPCs & Functions
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.check_spectator_vote_limit()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.prevent_player_role_self_elevation()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cast_spectator_vote');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.register_or_update_spectator_session');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.convert_spectator_session_to_player');
  });

  it('6. Establishes Core Quest Rewards Backbone (XP, Drawing Entries, Quest Steps, Drawing Ledger)', () => {
    // Quests & Submissions extensions
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS xp_reward INTEGER');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS drawing_entry_reward INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS gm_notes TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS drawing_entries_awarded INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS completed_step_order INTEGER');

    // Enum constraint expansions
    expect(sql).toContain("'multi_step'");
    expect(sql).toContain("'retry_requested'");

    // Tables
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.quest_steps');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.drawing_entry_ledger');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.drawing_ledger_locks');

    // Views
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_quests');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_quest_steps');
  });

  it('7. Establishes Transparent Prize Drawing System (Event Prizes, Draw Records, Immutability)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.event_prizes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.prize_draw_records');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_edits()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_locks_edits()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.execute_prize_draw_if_drawable');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.publish_prize_draws_if_publishable');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_published_drawings_projection');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_drawing_ledger_projection');
  });

  it('8. Establishes QR Campaign Attribution tables and Street Team campaign seed data', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.qr_campaigns');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaign_flyer_variants');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaign_distributors');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaign_qr_codes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.campaign_visits');

    // Seed campaign with natural unique key conflict resolution
    expect(sql).toContain("'camp-street-team-2026'");
    expect(sql).toContain("'canton-quests-street-team-2026'");
    expect(sql).toContain("'flyer-family'");
    expect(sql).toContain("'flyer-challenge'");
    expect(sql).toContain("'flyer-secret'");
    expect(sql).toContain("'cqr-canonical-f1'");

    // Validate genuine natural key idempotency to prevent 23505 duplicate key violations
    expect(sql).toContain('ON CONFLICT (slug) DO UPDATE SET');
    expect(sql).toContain('ON CONFLICT (campaign_id, name) DO UPDATE SET');
    expect(sql).toContain('ON CONFLICT (tracking_slug) DO UPDATE SET');
    expect(sql).toContain('ON CONFLICT (event_id, slug) DO UPDATE SET');
  });

  it('9. Establishes Player Identity & Three-Path Architecture (Starting Path, Achievements)', () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS selected_starting_path TEXT DEFAULT 'family'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS starting_path TEXT DEFAULT 'family'");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.achievements');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.player_achievements');

    // Seed achievements
    expect(sql).toContain("'ach-pathfinder-family'");
    expect(sql).toContain("'ach-pathfinder-challenge'");
    expect(sql).toContain("'ach-pathfinder-secret'");
    expect(sql).toContain("'ach-triple-threat'");
    expect(sql).toContain("'ach-day-one-king'");
  });

  it('10. Enforces Critical Player Auth Hardening (20260814010000) as the authoritative final state', () => {
    // Indexes
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_user_id_unique');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_players_email_lower');

    // Anti-tampering Trigger
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.prevent_player_user_id_tampering()');
    expect(sql).toContain('CREATE TRIGGER trg_prevent_player_user_id_tampering');

    // Hardened Players Policies (strictly auth.uid() = user_id OR service_role)
    expect(sql).toContain('CREATE POLICY "Users can insert their own player profile"');
    expect(sql).toContain('(auth.uid() = user_id) OR');
    expect(sql).toContain("(auth.jwt() ->> 'role' = 'service_role')");

    expect(sql).toContain('CREATE POLICY "Users can update their own player profile"');

    // Hardened Submissions Policy
    expect(sql).toContain('CREATE POLICY "Players can create submissions"');
    expect(sql).toContain('public.players.user_id = auth.uid()');
  });

  it('11. Restores canonical Canton, Ohio city record with deterministic UUID', () => {
    expect(sql).toContain("'a0000001-0000-4000-8000-000000000001'::uuid");
    expect(sql).toContain("'Canton'");
    expect(sql).toContain("'canton-oh'");
    expect(sql).toContain("'OH'");
  });

  it('12. Restores all 9 canonical launch locations with Frankenstein Monument safety boundaries', () => {
    const expectedLocations = [
      'Centennial Plaza',
      'McKinley National Memorial',
      '4th Street Arts Corridor Mural',
      'Aura Craft Coffee',
      'Downtown Canton Arcade Vault',
      'Canton Palace Theatre',
      'Hall of Fame City Marker',
      'The Onesto Historic Entrance',
      'Frankenstein Monument at West Lawn Cemetery',
    ];

    for (const loc of expectedLocations) {
      expect(sql).toContain(loc);
    }

    expect(sql).toMatch(/1919 7th St NW, Canton, OH 44708',\s+NULL,\s+NULL/);
    expect(sql).toContain('Daylight cemetery visit only during posted visitor hours');
  });

  it('13. Restores canonical event: Canton Quests Volume 1 (The Founder\'s Cipher)', () => {
    expect(sql).toContain("'b0000001-0000-4000-8000-000000000001'::uuid");
    expect(sql).toContain("Canton Quests: Volume 1 - The Founder''s Cipher");
    expect(sql).toContain("'canton-weekend-1'");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'day_1'");
  });

  it('14. Restores all 15 canonical Volume 1 quests across Three-Path districts', () => {
    const expectedQuestSlugs = [
      'centennial-beacon',
      'mckinley-monument-year',
      '4th-st-mural-pose',
      'aura-coffee-scan',
      'arcade-champion-video',
      'palace-theatre-lore',
      'market-square-flash',
      'onesto-brass-motto',
      'hof-trail-emblem',
      'frankenstein-quiet-signal',
      'secret-cipher-77',
      'founders-secret-clue',
      'palace-marquee-flash',
      'civic-seal-snapshot',
      'grand-finale-cipher',
    ];

    for (const slug of expectedQuestSlugs) {
      expect(sql).toContain(`'${slug}'`);
    }

    expect(sql).toContain("'family'");
    expect(sql).toContain("'challenge'");
    expect(sql).toContain("'secret'");
    expect(sql).toContain("'cross_city'");
  });

  it('15. Restores multi-step quest sequence for Secret Quest with cryptographic step hashes', () => {
    expect(sql).toContain('Lock One: Founder Fragment');
    expect(sql).toContain('Lock Two: Painted Fragment');
    expect(sql).toContain('Lock Three: Brass Fragment');
    expect(sql).toContain('sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106');
    expect(sql).toContain('sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d');
    expect(sql).toContain('sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c');
  });

  it('16. Restores Collectibles, Secret Codes, NPC, Business Partners, Event Prizes, and Drawing Lock', () => {
    expect(sql).toContain('founder-token');
    expect(sql).toContain('cipher-fragment-1');
    expect(sql).toContain('palace-seal');
    expect(sql).toContain('The Courier');
    expect(sql).toContain('Aura Craft Coffee');
    expect(sql).toContain('Downtown Canton Arcade Vault');
    expect(sql).toContain('Canton Quest Champion Trophy');
    expect(sql).toContain('Year of Aura Coffee VIP Pass');
    expect(sql).toContain('public.drawing_ledger_locks');
  });

  it('18. Enforces natural-key conflict resolution across all restored and seeded relations', () => {
    // QR campaign natural key is slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.qr_campaigns[\s\S]*?ON\s+CONFLICT\s*\(slug\)\s+DO\s+UPDATE/);
    
    // Campaign flyer variants composite unique is (campaign_id, name)
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.campaign_flyer_variants[\s\S]*?ON\s+CONFLICT\s*\(campaign_id,\s*name\)\s+DO\s+UPDATE/);

    // Campaign distributors composite unique is (campaign_id, name)
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.campaign_distributors[\s\S]*?ON\s+CONFLICT\s*\(campaign_id,\s*name\)\s+DO\s+UPDATE/);

    // Campaign QR codes unique natural key is tracking_slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.campaign_qr_codes[\s\S]*?ON\s+CONFLICT\s*\(tracking_slug\)\s+DO\s+UPDATE/);

    // Quests composite natural key is (event_id, slug)
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.quests[\s\S]*?ON\s+CONFLICT\s*\(event_id,\s*slug\)\s+DO\s+UPDATE/);

    // Cities unique natural key is slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.cities[\s\S]*?ON\s+CONFLICT\s*\(slug\)\s+DO\s+UPDATE/);

    // Events unique natural key is slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.events[\s\S]*?ON\s+CONFLICT\s*\(slug\)\s+DO\s+UPDATE/);

    // Collectibles unique natural key is slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.collectibles[\s\S]*?ON\s+CONFLICT\s*\(slug\)\s+DO\s+UPDATE/);

    // Achievements unique natural key is slug
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.achievements[\s\S]*?ON\s+CONFLICT\s*\(slug\)\s+DO\s+UPDATE/);

    // Quest steps unique natural key is (quest_id, step_order)
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.quest_steps[\s\S]*?ON\s+CONFLICT\s*\(quest_id,\s*step_order\)\s+DO\s+UPDATE/);

    // Secret codes unique natural key is (event_id, code)
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.secret_codes[\s\S]*?ON\s+CONFLICT\s*\(event_id,\s*code\)\s+DO\s+UPDATE/);
  });

  it('19. Dynamically resolves parent foreign key identifiers in PL/pgSQL to prevent _fkey constraint failures', () => {
    // Section 5 dynamically resolves campaign_id
    expect(sql).toContain("SELECT id INTO v_campaign_id FROM public.qr_campaigns WHERE slug = 'canton-quests-street-team-2026'");
    expect(sql).toContain("SELECT id INTO v_variant_family_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Family'");
    expect(sql).toContain("SELECT id INTO v_dist_dustin_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Dustin'");

    // Section 8 dynamically resolves city_id and event_id
    expect(sql).toContain("SELECT id INTO v_city_id FROM public.cities WHERE slug = 'canton-oh'");
    expect(sql).toContain("SELECT id INTO v_event_id FROM public.events WHERE slug = 'canton-weekend-1'");
    expect(sql).toContain("SELECT id INTO v_secret_quest_id FROM public.quests WHERE event_id = v_event_id AND slug = 'secret-cipher-77'");
    expect(sql).toContain("SELECT id INTO v_col_founder FROM public.collectibles WHERE slug = 'founder-token'");
    expect(sql).toContain("SELECT id INTO v_col_palace FROM public.collectibles WHERE slug = 'palace-seal'");
  });

  it('20. Audits that all CREATE POLICY and CREATE TRIGGER statements are idempotent with DROP IF EXISTS', () => {
    // Extract all policy creation names and verify they are dropped before creation
    const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_.]+)/gi;
    let match: RegExpExecArray | null;
    const policiesFound: Array<{ policy: string; table: string }> = [];

    while ((match = policyRegex.exec(sql)) !== null) {
      policiesFound.push({ policy: match[1], table: match[2] });
    }

    expect(policiesFound.length).toBeGreaterThan(20);

    for (const item of policiesFound) {
      const dropRegex = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${item.policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+ON\\s+${item.table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      expect(sql).toMatch(dropRegex);
    }

    // Extract all trigger names and verify they are dropped before creation
    const triggerRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+(?:BEFORE|AFTER)\s+(?:INSERT|UPDATE|DELETE)/gi;
    const triggersFound: string[] = [];

    while ((match = triggerRegex.exec(sql)) !== null) {
      triggersFound.push(match[1]);
    }

    expect(triggersFound.length).toBe(5);

    for (const triggerName of triggersFound) {
      const dropTriggerRegex = new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${triggerName}\\b`, 'i');
      expect(sql).toMatch(dropTriggerRegex);
    }

    // Verify all CREATE INDEX use IF NOT EXISTS
    const rawCreateIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z0-9_]+/gi;
    expect(sql).not.toMatch(rawCreateIndexRegex);
  });
});
