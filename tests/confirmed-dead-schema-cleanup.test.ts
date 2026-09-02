import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetGameEngineStore,
  initializeGameEngine,
  setCurrentPlayer,
  submitQuestProof,
  recordScoreLedger,
  createSecretCode,
  redeemSecretCode,
  grantFinaleQualification,
  getLeaderboardForEvent,
  decodeLocalCipherDistrict,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Canton Quests — Confirmed Dead Schema Cleanup Suite', () => {
  const migrationSql = readRepoFile('supabase/migrations/20260901140000_cleanup_dead_teams_and_legacy_prizes.sql');

  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  describe('Migration Text & Safety Invariant Proofs', () => {
    it('contains fail-safe precondition assertions raising exceptions if data is present', () => {
      expect(migrationSql).toContain('DO $$');
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.teams is not empty");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.team_members is not empty");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.prizes is not empty");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.quest_submissions has % non-null team_id values'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.score_ledger has % non-null team_id values'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.code_redemptions has % non-null team_id values'");
      expect(migrationSql).toContain("RAISE EXCEPTION 'Cleanup aborted: public.finale_qualifications has % non-null team_id values'");
    });

    it('contains ZERO uses of the word CASCADE anywhere in the migration', () => {
      expect(migrationSql.toUpperCase()).not.toContain('CASCADE');
    });

    it('touches ONLY approved objects (prizes, team_members, teams, 4 team_id columns)', () => {
      expect(migrationSql).toContain('DROP TABLE IF EXISTS public.team_members;');
      expect(migrationSql).toContain('DROP TABLE IF EXISTS public.teams;');
      expect(migrationSql).toContain('DROP TABLE IF EXISTS public.prizes;');
      expect(migrationSql).toContain('ALTER TABLE public.quest_submissions DROP COLUMN IF EXISTS team_id;');
      expect(migrationSql).toContain('ALTER TABLE public.score_ledger DROP COLUMN IF EXISTS team_id;');
      expect(migrationSql).toContain('ALTER TABLE public.code_redemptions DROP COLUMN IF EXISTS team_id;');
      expect(migrationSql).toContain('ALTER TABLE public.finale_qualifications DROP COLUMN IF EXISTS team_id;');
    });

    it('does NOT reference public_quests_projection and does NOT alter public.public_quests', () => {
      expect(migrationSql).not.toContain('public_quests_projection');
      expect(migrationSql).not.toContain('ALTER VIEW public.public_quests');
      expect(migrationSql).not.toContain('DROP VIEW IF EXISTS public.public_quests');
    });

    it('does NOT touch event_prizes, prize_draw_records, or any live/planned tables', () => {
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.event_prizes');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.prize_draw_records');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.bonus_windows');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.crowd_objectives');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.generated_qrs');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.live_events');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.field_npcs');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.player_links');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.player_personal_roles');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.watcher_eligibility');
      expect(migrationSql).not.toContain('DROP TABLE IF EXISTS public.drawing_entry_ledger');
    });
  });

  describe('Runtime & Type Cleanup Verification', () => {
    it('1. runtime no longer expects quest_submissions.team_id', () => {
      const dbSource = readRepoFile('lib/supabase-db.ts');
      expect(dbSource).not.toMatch(/team_id:\s*sub\.team_id/);
      expect(dbSource).not.toMatch(/teamId:\s*sub\.team_id/);
    });

    it('2. runtime no longer expects score_ledger.team_id', () => {
      const dbSource = readRepoFile('lib/supabase-db.ts');
      expect(dbSource).not.toMatch(/team_id:\s*params\.teamId/);
    });

    it('3. runtime no longer expects code_redemptions.team_id', () => {
      const typesSource = readRepoFile('lib/types.ts');
      const codeRedemptionBlock = typesSource.slice(
        typesSource.indexOf('export interface CodeRedemption'),
        typesSource.indexOf('export interface Collectible')
      );
      expect(codeRedemptionBlock).not.toContain('teamId');
    });

    it('4. runtime no longer expects finale_qualifications.team_id', () => {
      const typesSource = readRepoFile('lib/types.ts');
      const finaleBlock = typesSource.slice(
        typesSource.indexOf('export interface FinaleQualification'),
        typesSource.indexOf('export interface Prize')
      );
      expect(finaleBlock).not.toContain('teamId');
    });

    it('5. no live team creation, join, captain, or squad standings code exists in runtime', () => {
      const searchDirs = ['app', 'components', 'lib'];
      const bannedTerms = ['joinTeamByCode', 'createTeam', 'getTeamForPlayer', 'getTeamLeaderboardForEvent'];

      function walk(dir: string): string[] {
        const full = path.join(process.cwd(), dir);
        if (!fs.existsSync(full)) return [];
        let results: string[] = [];
        for (const entry of fs.readdirSync(full)) {
          const entryPath = path.join(dir, entry);
          const stat = fs.statSync(path.join(process.cwd(), entryPath));
          if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === '.next') continue;
            results = results.concat(walk(entryPath));
          } else if (/\.(ts|tsx)$/.test(entry)) {
            results.push(entryPath);
          }
        }
        return results;
      }

      const allFiles = [...walk('app'), ...walk('components'), ...walk('lib')];
      for (const file of allFiles) {
        const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
        for (const term of bannedTerms) {
          expect(source, `${file} still contains banned squad term ${term}`).not.toContain(term);
        }
      }
    });

    it('6. individual quest submissions still work seamlessly', () => {
      const player = setCurrentPlayer('SoloAgent_Test_1', '🚀');
      const quest = SEED_QUESTS[0];

      const res = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: quest.verificationType,
        submittedContent: quest.verificationType === 'qr' ? 'CQ-AURA-FOUNDER' : 'checkin',
        userLat: quest.location?.latitude || 40.7989,
        userLon: quest.location?.longitude || -81.3748,
      });

      expect(res.success).toBe(true);
      expect(res.awardedPoints).toBeGreaterThan(0);
      expect(res.submission.playerId).toBe(player.id);
      expect((res.submission as any).teamId).toBeUndefined();
    });

    it('7. individual score ledger still records and calculates rankings correctly', () => {
      const p1 = setCurrentPlayer('TopScorer_1', '🌟');
      const p2 = setCurrentPlayer('TopScorer_2', '⚡');

      recordScoreLedger({
        eventId: SEED_EVENT.id,
        playerId: p1.id,
        points: 400,
        category: 'quest_completion',
        description: 'First Place Lead',
      });

      recordScoreLedger({
        eventId: SEED_EVENT.id,
        playerId: p2.id,
        points: 250,
        category: 'quest_completion',
        description: 'Second Place Chase',
      });

      const leaderboard = getLeaderboardForEvent(SEED_EVENT.id);
      expect(leaderboard.length).toBeGreaterThanOrEqual(2);
      expect(leaderboard[0].playerId).toBe(p1.id);
      expect(leaderboard[0].totalPoints).toBe(400);
      expect(leaderboard[1].playerId).toBe(p2.id);
      expect(leaderboard[1].totalPoints).toBe(250);
    });

    it('8. secret code redemption operates purely for individual players', () => {
      const player = setCurrentPlayer('CodeRedeemer_1', '🔑');
      const newSecret = createSecretCode(SEED_EVENT.id, 'ALPHA2026', 'Secret Drop', 150);

      const res = redeemSecretCode('ALPHA2026', player.id, SEED_EVENT.id);

      expect(res.success).toBe(true);
      expect(res.pointsAwarded).toBe(150);
    });

    it('9. finale qualification functions under pure individual player model', () => {
      const player = setCurrentPlayer('FinaleQualifier_1', '🏆');

      const qual = grantFinaleQualification(
        SEED_EVENT.id,
        player.id,
        'Solved All Three Locks',
        false
      );

      expect(qual.playerId).toBe(player.id);
      expect(qual.qualificationReason).toBe('Solved All Three Locks');
      expect((qual as any).teamId).toBeUndefined();
    });

    it('10. prize drawing system strictly uses public_published_drawings_projection and drawing_ledger_locks', () => {
      const dbSource = readRepoFile('lib/supabase-db.ts');
      expect(dbSource).toContain("from('public_published_drawings_projection')");
      expect(dbSource).toContain("from('drawing_ledger_locks')");
      expect(dbSource).toContain("from('drawing_entry_ledger')");
      expect(dbSource).not.toMatch(/\.from\(\s*['"]prizes['"]\s*\)/);
    });

    it('11. nothing in the application code references the abandoned legacy public.prizes table', () => {
      const searchDirs = ['app', 'components', 'lib'];
      function walk(dir: string): string[] {
        const full = path.join(process.cwd(), dir);
        if (!fs.existsSync(full)) return [];
        let results: string[] = [];
        for (const entry of fs.readdirSync(full)) {
          const entryPath = path.join(dir, entry);
          const stat = fs.statSync(path.join(process.cwd(), entryPath));
          if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === '.next') continue;
            results = results.concat(walk(entryPath));
          } else if (/\.(ts|tsx)$/.test(entry)) {
            results.push(entryPath);
          }
        }
        return results;
      }

      const allFiles = [...walk('app'), ...walk('components'), ...walk('lib')];
      for (const file of allFiles) {
        const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
        expect(source, `${file} still contains from('prizes')`).not.toMatch(/\.from\(\s*['"]prizes['"]\s*\)/);
      }
    });

    it('12. Founder\'s Cipher district locks and manual decoding behavior are unchanged', () => {
      const player = setCurrentPlayer('CipherExplorer_1', '🔍');
      const fcSource = readRepoFile('lib/supabase-db.ts');
      expect(fcSource).toContain('threeLocksOwned');
      expect(fcSource).toContain('cipherFragmentsAwarded');

      const decodeResult = decodeLocalCipherDistrict({
        eventId: SEED_EVENT.id,
        playerId: player.id,
        districtKey: 'arts',
        sequence: ['frag-arts-1', 'frag-arts-2', 'frag-arts-3'],
      });
      expect(decodeResult).toBeDefined();
    });

    it('13. Fair Mystery Money board and claims behavior are unchanged', () => {
      const fairSource = readRepoFile('lib/supabase-db.ts');
      expect(fairSource).toContain('getFairMysteryBoardDB');
      expect(fairSource).toContain('claimFairMysterySignalDB');
      expect(fairSource).toContain('fair_signal_prizes');
      expect(fairSource).toContain('fair_signal_claims');
    });
  });
});
