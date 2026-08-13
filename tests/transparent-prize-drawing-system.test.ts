import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  getAllPlayers,
  getPublicPlayerLabel,
  awardDrawingEntries,
  exportDrawingLedgerSnapshot,
  lockDrawingLedger,
  cancelDrawingLedger,
  isDrawingLedgerLocked,
  getDrawingLedgerReview,
  executePrizeDraw,
  publishDrawingResults,
  voidPrizeDrawRecord,
  getPublicDrawingPageData,
  submitQuestProof,
} from '../lib/game-engine';
import { authorizeGameMasterRequest } from '../lib/admin-auth';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Canton Quests — Transparent Prize Drawing System', () => {
  const TEST_EVENT_ID = 'evt-canton-vol-1';
  const TEST_EVENT_UUID = '11111111-1111-4111-8111-111111111111';
  const TEST_PLAYER_UUID = '22222222-2222-4222-8222-222222222222';

  const mockCanonicalSnapshot = {
    eventId: TEST_EVENT_UUID,
    players: [
      {
        publicPlayerLabel: 'Agent #2222',
        publicParticipantId: 'fb2b7324',
        entries: 5,
      },
    ],
  };

  function createDrawingSupabaseMock(lockStatus: string, options?: { rpcError?: string; publishedRows?: any[] }) {
    const calls: Array<{ table?: string; method: string; args: any[] }> = [];
    const drawRecord = {
      id: '33333333-3333-4333-8333-333333333333',
      event_id: TEST_EVENT_UUID,
      prize_id: null,
      prize_title: 'DB Prize',
      status: 'drawn',
      locked_ledger_hash: 'SHA256-dbtest',
      locked_at: '2026-08-13T00:00:00.000Z',
      draw_method: 'manual_external',
      provider_reference: 'Manual Ref #1',
      drawn_at: '2026-08-13T00:01:00.000Z',
      winning_player_id: TEST_PLAYER_UUID,
      winning_public_player_label: 'Agent #2222',
      selected_weighted_entry_index: -1,
      audit_metadata: {
        verificationStatus: 'manual_unverified',
        isSystemVerified: false,
        isIndependent: false,
      },
      published_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by: null,
      created_at: '2026-08-13T00:01:00.000Z',
    };
    const publishedRows = options?.publishedRows || [{ ...drawRecord, status: 'published', published_at: '2026-08-13T00:02:00.000Z' }];

    const makeQuery = (table: string) => {
      const query: any = {
        select: (...args: any[]) => {
          calls.push({ table, method: 'select', args });
          return query;
        },
        update: (...args: any[]) => {
          calls.push({ table, method: 'update', args });
          return query;
        },
        insert: (...args: any[]) => {
          calls.push({ table, method: 'insert', args });
          return query;
        },
        delete: (...args: any[]) => {
          calls.push({ table, method: 'delete', args });
          return query;
        },
        eq: (...args: any[]) => {
          calls.push({ table, method: 'eq', args });
          return query;
        },
        neq: (...args: any[]) => {
          calls.push({ table, method: 'neq', args });
          return query;
        },
        in: (...args: any[]) => {
          calls.push({ table, method: 'in', args });
          return query;
        },
        or: (...args: any[]) => {
          calls.push({ table, method: 'or', args });
          return query;
        },
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => {
          if (table === 'events') return { data: { id: TEST_EVENT_UUID }, error: null };
          if (table === 'drawing_ledger_locks') {
            return {
              data: {
                event_id: TEST_EVENT_UUID,
                is_locked: true,
                status: lockStatus,
                snapshot_hash: 'SHA256-dbtest',
                canonical_snapshot: mockCanonicalSnapshot,
                locked_at: '2026-08-13T00:00:00.000Z',
              },
              error: null,
            };
          }
          if (table === 'prize_draw_records') return { data: null, error: null };
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (table === 'prize_draw_records') return Promise.resolve({ data: [], error: null }).then(resolve);
          if (table === 'drawing_entry_ledger') {
            return Promise.resolve({
              data: [
                {
                  player_id: TEST_PLAYER_UUID,
                  players: { id: TEST_PLAYER_UUID, display_name: 'Agent #2222', is_minor: false },
                },
              ],
              error: null,
            }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return query;
    };

    const mockSupabaseAdmin = {
      calls,
      from: (table: string) => makeQuery(table),
      rpc: async (fn: string, args: any) => {
        calls.push({ method: 'rpc', args: [fn, args] });
        if (options?.rpcError) return { data: null, error: new Error(options.rpcError) };
        if (fn === 'execute_prize_draw_if_drawable') return { data: drawRecord, error: null };
        if (fn === 'publish_prize_draws_if_publishable') return { data: publishedRows, error: null };
        return { data: null, error: new Error(`Unexpected RPC ${fn}`) };
      },
    };

    return mockSupabaseAdmin;
  }

  const setupTestEntries = (eventId: string = TEST_EVENT_ID) => {
    awardDrawingEntries({
      eventId,
      playerId: 'plr-dev-001',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'Qualified player 1',
    });
    awardDrawingEntries({
      eventId,
      playerId: 'plr-dev-002',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Qualified player 2',
    });
  };

  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  afterEach(() => {
    vi.doUnmock('../lib/supabase');
  });

  // 1. Ledger cannot lock for nonexistent event.
  it('1. Ledger cannot lock for nonexistent event', () => {
    expect(() => lockDrawingLedger('nonexistent-event-id-999')).toThrow(/Event not found/);
  });

  // 2. Ledger lock creates deterministic snapshot.
  it('2. Ledger lock creates deterministic snapshot', () => {
    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);
    expect(lock.isLocked).toBe(true);
    expect(lock.snapshotHash).toBeDefined();
    expect(lock.snapshotHash?.startsWith('SHA256-')).toBe(true);
    expect(lock.canonicalSnapshot).toBeDefined();
    expect(lock.canonicalSnapshot?.players).toBeInstanceOf(Array);
  });

  // 3. Same ledger produces identical canonical export.
  it('3. Same ledger produces identical canonical export', () => {
    setupTestEntries();
    const export1 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    const export2 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    expect(export1.snapshot).toEqual(export2.snapshot);
    expect(export1.snapshotHash).toEqual(export2.snapshotHash);
  });

  // 4. Same ledger produces identical SHA-256.
  it('4. Same ledger produces identical SHA-256', () => {
    setupTestEntries();
    const export1 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    const export2 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    expect(export1.snapshotHash).toBe(export2.snapshotHash);
  });

  // 5. Changing one entry changes SHA-256.
  it('5. Changing one entry changes SHA-256', () => {
    setupTestEntries();
    const initialExport = exportDrawingLedgerSnapshot(TEST_EVENT_ID);

    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-dev-001',
      questId: 'qst-bonus-extra-test',
      entriesCount: 5,
      sourceType: 'bonus_test',
      reason: 'Extra test entries',
    });

    const modifiedExport = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    expect(initialExport.snapshotHash).not.toEqual(modifiedExport.snapshotHash);
  });

  // 6. Snapshot ordering is deterministic.
  it('6. Snapshot ordering is deterministic regardless of entry insertion order', () => {
    resetGameEngineStore();
    initializeGameEngine();

    // Award entries in order Z then A
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-z-agent',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Agent Z',
    });
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-a-agent',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'Agent A',
    });

    const export1 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);

    resetGameEngineStore();
    initializeGameEngine();

    // Award entries in reverse order A then Z
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-a-agent',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'Agent A',
    });
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-z-agent',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Agent Z',
    });

    const export2 = exportDrawingLedgerSnapshot(TEST_EVENT_ID);

    expect(export1.snapshotHash).toEqual(export2.snapshotHash);
    expect(export1.snapshot.players[0].publicPlayerLabel).toEqual(export2.snapshot.players[0].publicPlayerLabel);
  });

  // 7. Raw player IDs do not appear in public snapshot.
  it('7. Raw player IDs do not appear in public snapshot', () => {
    setupTestEntries();
    const snapshotResult = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    const serialized = JSON.stringify(snapshotResult.snapshot);
    const players = getAllPlayers();

    players.forEach((p) => {
      expect(serialized).not.toContain(`"id":"${p.id}"`);
      expect(serialized).not.toContain(`"playerId":"${p.id}"`);
    });
  });

  // 8. Private player information does not appear publicly.
  it('8. Private player information does not appear publicly', () => {
    setupTestEntries();
    const snapshotResult = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    const serialized = JSON.stringify(snapshotResult.snapshot);
    expect(serialized).not.toMatch(/@|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    expect(serialized).not.toContain('user_id');
    expect(serialized).not.toContain('submissionId');
  });

  // 9. Minor public labels remain anonymized.
  it('9. Minor public labels remain anonymized', () => {
    const minorPlayerId = 'plr-minor-1234';
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: minorPlayerId,
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Minor completion',
    });

    const review = getDrawingLedgerReview(TEST_EVENT_ID);
    const minorEntry = review.playerEntries.find((p: { playerId?: string; publicPlayerLabel: string; entries: number; isMinor?: boolean }) => p.playerId === minorPlayerId);
    expect(minorEntry?.publicPlayerLabel).toBe('Agent #1234');
  });

  // 10. Locked ledger rejects new ordinary drawing entries.
  it('10. Locked ledger rejects new ordinary drawing entries', () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    expect(isDrawingLedgerLocked(TEST_EVENT_ID)).toBe(true);

    expect(() =>
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 1,
        sourceType: 'post_lock_test',
        reason: 'Attempt post lock entry',
      })
    ).toThrow(/locked/);
  });

  // 11. Locked ledger rejects mutation of prior ordinary entries.
  it('11. Locked ledger rejects mutation of prior entries during quest proof submission', () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const result = submitQuestProof({
      playerId: 'plr-apex-hunter',
      questId: 'qst-centennial-discovery',
      eventId: TEST_EVENT_ID,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(result.success).toBe(true);
    expect(result.drawingEntriesAwarded).toBe(0);
  });

  // 12. Test draw requires locked ledger.
  it('12. Test draw requires locked ledger', async () => {
    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        testSeed: 'TEST_SEED_123',
      })
    ).rejects.toThrow(/must be locked/);
  });

  // 13. Weighted drawing correctly honors entry counts.
  it('13. Weighted drawing correctly honors entry counts', async () => {
    resetGameEngineStore();
    initializeGameEngine();

    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-heavy-a',
      entriesCount: 9,
      sourceType: 'test',
      reason: 'Heavy player A',
    });
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-light-b',
      entriesCount: 1,
      sourceType: 'test',
      reason: 'Light player B',
    });

    lockDrawingLedger(TEST_EVENT_ID);

    const draw1 = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Weighted Test Prize',
      testSeed: 'SEED-WEIGHTED-TEST-1',
    });

    expect(draw1.selectedWeightedEntryIndex).toBeLessThan(10);
  });

  // 14. Deterministic test seed gives reproducible result.
  it('14. Deterministic test seed gives reproducible result', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const draw1 = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-grand',
      prizeTitle: 'Grand Prize',
      testSeed: 'STATIC-SEED-XYZ',
    });

    resetGameEngineStore();
    initializeGameEngine();
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const draw2 = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-grand',
      prizeTitle: 'Grand Prize',
      testSeed: 'STATIC-SEED-XYZ',
    });

    expect(draw1.winningPlayerId).toEqual(draw2.winningPlayerId);
    expect(draw1.winningPublicPlayerLabel).toEqual(draw2.winningPublicPlayerLabel);
    expect(draw1.selectedWeightedEntryIndex).toEqual(draw2.selectedWeightedEntryIndex);
  });

  // 15. Test draw is clearly marked internal/non-independent.
  it('15. Test draw is clearly marked internal/non-independent', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const draw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      testSeed: 'DISCLAIMER-SEED',
    });

    expect(draw.drawMethod).toBe('internal_test');
    expect(draw.auditMetadata.isTestProvider).toBe(true);
    expect(draw.auditMetadata.isIndependent).toBe(false);
    expect(draw.auditMetadata.disclaimer).toContain('INTERNAL TEST');
  });

  // 16. Multiple prizes are supported.
  it('16. Multiple prizes are supported', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const grand = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-1-grand',
      prizeTitle: 'Grand Prize',
      testSeed: 'SEED-1',
    });

    const second = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-2-second',
      prizeTitle: 'Second Prize',
      testSeed: 'SEED-2',
    });

    expect(grand.id).not.toEqual(second.id);
    expect(grand.prizeTitle).toBe('Grand Prize');
    expect(second.prizeTitle).toBe('Second Prize');
  });

  // 17. One-player-one-primary-prize rule works.
  it('17. One-player-one-primary-prize rule prevents duplicate winner in same session', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const firstDraw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-1',
      prizeTitle: 'Prize 1',
      testSeed: 'MULTIPLE-PRIZE-SEED-A',
    });

    const secondDraw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-2',
      prizeTitle: 'Prize 2',
      testSeed: 'MULTIPLE-PRIZE-SEED-B',
    });

    expect(secondDraw.winningPlayerId).not.toEqual(firstDraw.winningPlayerId);
  });

  // 18. Draw record references locked ledger hash.
  it('18. Draw record references locked ledger hash', async () => {
    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);

    const draw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      testSeed: 'HASH-REF-SEED',
    });

    expect(draw.lockedLedgerHash).toEqual(lock.snapshotHash);
  });

  // 19. Public result only uses public player labels.
  it('19. Public result only uses public player labels', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Public Label Prize',
      testSeed: 'PUBLIC-LABEL-SEED',
    });
    publishDrawingResults(TEST_EVENT_ID);

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    const pubResult = pageData.publishedPrizes[0];

    expect(pubResult.winnerPublicLabel).toBeDefined();
    expect(pubResult.winnerPublicLabel).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  // 20. Unpublished result is not exposed publicly.
  it('20. Unpublished result is not exposed publicly', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Draft Prize',
      testSeed: 'UNPUBLISHED-SEED',
    });

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    expect(pageData.publishedPrizes.length).toBe(0);
    expect(pageData.ledgerLockStatus).toBe('drawn');
  });

  // 21. Published result cannot be silently overwritten.
  it('21. Published result cannot be silently overwritten without audit record', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-unique-123',
      prizeTitle: 'Published Prize',
      testSeed: 'OVERWRITE-TEST-SEED',
    });
    const published = publishDrawingResults(TEST_EVENT_ID);

    expect(published[0].status).toBe('published');
    expect(() => voidPrizeDrawRecord(TEST_EVENT_ID, published[0].id, '')).toThrow(/audit reason/);
  });

  // 22. Void/redraw preserves audit history.
  it('22. Void/redraw preserves audit history', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    const draw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-void-test',
      prizeTitle: 'Void Test Prize',
      testSeed: 'VOID-SEED-1',
    });
    publishDrawingResults(TEST_EVENT_ID);

    const voided = voidPrizeDrawRecord(
      TEST_EVENT_ID,
      draw.id,
      'Administrative mistake in seed configuration'
    );

    expect(voided.status).toBe('cancelled');
    expect(voided.cancellationReason).toBe('Administrative mistake in seed configuration');
    expect(voided.cancelledAt).toBeDefined();

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    expect(pageData.publishedPrizes.length).toBe(0);
  });

  // 23. Public drawing page leaks no internal IDs.
  it('23. Public drawing page leaks no internal IDs', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Privacy Check Prize',
      testSeed: 'PRIVACY-CHECK-SEED',
    });
    publishDrawingResults(TEST_EVENT_ID);

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    const jsonStr = JSON.stringify(pageData);

    expect(jsonStr).not.toContain('winningPlayerId');
    expect(jsonStr).not.toContain('user_id');
    expect(jsonStr).not.toMatch(/@|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  });

  // 24. Anonymous users cannot lock ledger.
  it('24. Anonymous users cannot lock ledger via admin auth check', () => {
    const unauthSession = authorizeGameMasterRequest({ 'x-admin-key': 'invalid-passphrase' });
    expect(unauthSession.isAdmin).toBe(false);
  });

  // 25. Anonymous users cannot execute draw.
  it('25. Anonymous users cannot execute draw via admin auth check', () => {
    const unauthSession = authorizeGameMasterRequest({});
    expect(unauthSession.isAdmin).toBe(false);
  });

  // 26. Anonymous users cannot publish results.
  it('26. Anonymous users cannot publish results via admin auth check', () => {
    const unauthSession = authorizeGameMasterRequest({ authorization: 'Bearer wrong-token' });
    expect(unauthSession.isAdmin).toBe(false);
  });

  // 27. Migration SQL file check.
  it('27. Database migration file exists and includes locking triggers', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260813000000_transparent_prize_drawing_system.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.prize_draw_records');
    expect(sql).toContain('fn_prevent_locked_drawing_ledger_edits');
    expect(sql).toContain('public_published_drawings_projection');
  });

  // 28. API Route files check.
  it('28. Public and Admin API routes exist and enforce security', () => {
    const publicRoutePath = join(
      process.cwd(),
      'app/api/game/events/[slug]/drawing/route.ts'
    );
    const adminRoutePath = join(process.cwd(), 'app/api/admin/drawing/route.ts');

    const publicRouteCode = readFileSync(publicRoutePath, 'utf8');
    const adminRouteCode = readFileSync(adminRoutePath, 'utf8');

    expect(publicRouteCode).toContain('getPublicDrawingPageDataDB');
    expect(adminRouteCode).toContain('authorizeGameMasterRequest');
    expect(adminRouteCode).toContain('lockDrawingLedgerDB');
    expect(adminRouteCode).toContain('executePrizeDrawDB');
  });

  // 29. Public Drawing Page component check.
  it('29. Public Drawing Page component renders auditable fingerprint UI', () => {
    const pagePath = join(process.cwd(), 'app/events/[slug]/drawing/page.tsx');
    const pageCode = readFileSync(pagePath, 'utf8');

    expect(pageCode).toContain('Frozen Ledger Cryptographic Fingerprint');
    expect(pageCode).toContain('COPY HASH');
    expect(pageCode).toContain('Public Entry Ledger Breakdown');
    expect(pageCode).toContain('Official Quest Winners');
  });

  // 31. Duplicate public labels are disambiguated with publicParticipantId.
  it('31. Duplicate public labels are disambiguated with publicParticipantId in canonical snapshot', () => {
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-alpha-1234',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'First duplicate label player',
    });
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-beta-1234',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'Second duplicate label player',
    });

    const exportData = exportDrawingLedgerSnapshot(TEST_EVENT_ID);
    expect(exportData.snapshot.players.length).toBe(2);
    expect(exportData.snapshot.players[0].publicParticipantId).toBeDefined();
    expect(exportData.snapshot.players[1].publicParticipantId).toBeDefined();
    expect(exportData.snapshot.players[0].publicParticipantId).not.toEqual(
      exportData.snapshot.players[1].publicParticipantId
    );
  });

  // 32. Public drawing page data includes drawRecordId on published prizes.
  it('32. Public drawing page data includes drawRecordId for void record routing', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-test-route',
      prizeTitle: 'Route Test Prize',
      testSeed: 'SEED-ROUTE-1',
    });
    publishDrawingResults(TEST_EVENT_ID);

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    expect(pageData.publishedPrizes[0].drawRecordId).toBeDefined();
    expect(pageData.publishedPrizes[0].drawRecordId).toMatch(/^pdr-/);
  });

  // 33. Supabase DB service layer drawing functions exist and fall back seamlessly.
  it('33. Supabase DB service layer drawing functions are defined and fall back when unconfigured', async () => {
    const {
      getDrawingLedgerReviewDB,
      lockDrawingLedgerDB,
      getPublicDrawingPageDataDB,
    } = await import('../lib/supabase-db');

    const review = await getDrawingLedgerReviewDB(TEST_EVENT_ID);
    expect(review.eventId).toBe(TEST_EVENT_ID);

    const publicData = await getPublicDrawingPageDataDB(TEST_EVENT_ID);
    expect(publicData.eventId).toBe(TEST_EVENT_ID);
  });

  // 30. Game Master Admin controls page check.
  it('30. Game Master Admin drawing page exists and supports lock, draw, publish and void actions', () => {
    const adminPagePath = join(process.cwd(), 'app/admin/drawing/page.tsx');
    const adminCode = readFileSync(adminPagePath, 'utf8');

    expect(adminCode).toContain('LOCK DRAWING LEDGER');
    expect(adminCode).toContain('PUBLISH RESULTS TO PUBLIC');
    expect(adminCode).toContain('VOID DRAWING RECORD');
    expect(adminCode).toContain('p.drawRecordId');
  });

  // 34. Duplicate active draw execution is rejected for same prize and locked ledger.
  it('34. Duplicate active draw execution is rejected for same prize and locked ledger', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-grand-1',
      prizeTitle: 'Grand Prize',
      testSeed: 'SEED-DUP-1',
    });

    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-grand-1',
        prizeTitle: 'Grand Prize',
        testSeed: 'SEED-DUP-2',
      })
    ).rejects.toThrow(/active draw record already exists/i);
  });

  // 35. Re-locking an already locked/drawn ledger returns existing lock without overwrite.
  it('35. Re-locking an already locked ledger returns existing lock without overwrite', () => {
    setupTestEntries();
    const lock1 = lockDrawingLedger(TEST_EVENT_ID);
    const lock2 = lockDrawingLedger(TEST_EVENT_ID);

    expect(lock1.snapshotHash).toEqual(lock2.snapshotHash);
    expect(lock1.lockedAt).toEqual(lock2.lockedAt);
  });

  // 36. Public drawing page data exposes canonicalSnapshot for independent verification.
  it('36. Public drawing page data exposes canonicalSnapshot for independent verification', () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    expect(pageData.canonicalSnapshot).toBeDefined();
    expect(pageData.canonicalSnapshot?.players.length).toBeGreaterThan(0);
    expect(pageData.snapshotHash).toBeDefined();
  });

  // 37. Manual external provider result recording works and requires valid provider reference.
  it('37. Manual external provider result recording works and requires valid provider reference', async () => {
    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);
    const winner1Label = lock.canonicalSnapshot!.players[0].publicPlayerLabel;
    const winner2Label = lock.canonicalSnapshot!.players[1].publicPlayerLabel;

    const draw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-manual-1',
      prizeTitle: 'Manual Sponsor Prize',
      drawMethod: 'manual_external',
      manualWinnerPublicLabel: winner1Label,
      providerReference: 'RANDOM.ORG Ticket #88192',
    });

    expect(draw.drawMethod).toBe('manual_external');
    expect(draw.providerReference).toBe('RANDOM.ORG Ticket #88192');
    expect(draw.winningPublicPlayerLabel).toBe(winner1Label);
    expect(draw.auditMetadata.isIndependent).toBe(false);
    expect(draw.auditMetadata.isSystemVerified).toBe(false);
    expect(draw.auditMetadata.verificationStatus).toBe('manual_unverified');
    expect(draw.auditMetadata.disclaimer).toContain('NOT SYSTEM VERIFIED');

    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-manual-2',
        prizeTitle: 'Distinct Second Sponsor Prize',
        drawMethod: 'manual_external',
        manualWinnerPublicLabel: winner2Label,
      })
    ).rejects.toThrow(/valid provider reference/i);
  });

  // 38. Admin submission review route code enforces Game Master authentication.
  it('38. Admin submission review route code enforces Game Master authentication', () => {
    const reviewRoutePath = join(process.cwd(), 'app/api/game/admin/review/route.ts');
    const routeCode = readFileSync(reviewRoutePath, 'utf8');

    expect(routeCode).toContain('getAdminSessionFromRequest');
    expect(routeCode).toContain('Unauthorized. Game Master admin session is required.');
  });

  // 39. Public player label sanitizes email and phone number display names.
  it('39. Public player label sanitizes email and phone number display names to Agent # handle', () => {
    const emailPlayer = { id: 'plr-email-1234', displayName: 'john.doe@example.com' };
    const phonePlayer = { id: 'plr-phone-5678', displayName: 'Call 330-555-1234 for hints' };
    const cleanPlayer = { id: 'plr-clean-9999', displayName: 'Apex Explorer' };

    expect(getPublicPlayerLabel(emailPlayer as any, emailPlayer.id)).toBe('Agent #1234');
    expect(getPublicPlayerLabel(phonePlayer as any, phonePlayer.id)).toBe('Agent #5678');
    expect(getPublicPlayerLabel(cleanPlayer as any, cleanPlayer.id)).toBe('Apex Explorer');
  });

  // 40. Manual external draw rejects ambiguous public player label when multiple participants share the same label.
  it('40. Manual external draw rejects ambiguous public player label when multiple participants share display name unless publicParticipantId is supplied', async () => {
    resetGameEngineStore();
    initializeGameEngine();

    const players = getAllPlayers();
    players.push(
      { id: 'plr-alex-1', displayName: 'Alex Agent', avatarUrl: '⚡', role: 'player', totalXp: 0, level: 1, createdAt: new Date().toISOString() },
      { id: 'plr-alex-2', displayName: 'Alex Agent', avatarUrl: '⚡', role: 'player', totalXp: 0, level: 1, createdAt: new Date().toISOString() }
    );

    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-alex-1',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'First Alex player',
    });
    awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-alex-2',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Second Alex player',
    });

    const lock = lockDrawingLedger(TEST_EVENT_ID);
    const participant1 = lock.canonicalSnapshot!.players.find(p => p.publicPlayerLabel === 'Alex Agent');
    expect(participant1).toBeDefined();

    // Rejection due to ambiguity
    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-ambiguous',
        prizeTitle: 'Ambiguity Test Prize',
        drawMethod: 'manual_external',
        manualWinnerPublicLabel: 'Alex Agent',
        providerReference: 'RANDOM.ORG Ticket #999',
      })
    ).rejects.toThrow(/Ambiguous winner/i);

    // Success when supplying exact publicParticipantId
    const targetParticipantId = lock.canonicalSnapshot!.players[0].publicParticipantId;
    const drawSuccess = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-ambiguous-resolved',
      prizeTitle: 'Resolved Ambiguity Test Prize',
      drawMethod: 'manual_external',
      manualWinnerPublicParticipantId: targetParticipantId,
      providerReference: 'RANDOM.ORG Ticket #1000',
    });

    expect(drawSuccess.winningPublicPlayerLabel).toBe(lock.canonicalSnapshot!.players[0].publicPlayerLabel);
  });

  // 41. Database migration SQL includes lock immutability trigger and restricts raw lock SELECT access.
  it('41. Database migration SQL includes lock immutability trigger fn_prevent_locked_drawing_ledger_locks_edits and restricts raw lock table SELECT', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260813000000_transparent_prize_drawing_system.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('fn_prevent_locked_drawing_ledger_locks_edits');
    expect(sql).toContain('trg_prevent_locked_drawing_ledger_locks_edits');
    expect(sql).toContain('DROP POLICY IF EXISTS "Drawing ledger locks viewable by everyone"');
    expect(sql).toContain('CREATE POLICY "Admins can view drawing ledger locks" ON public.drawing_ledger_locks');
    expect(sql).toContain("OLD.status = 'cancelled' AND NEW.status != 'cancelled'");
    expect(sql).toContain('execute_prize_draw_if_drawable');
    expect(sql).toContain('publish_prize_draws_if_publishable');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) TO service_role');
  });

  // 42. BLOCKER 1 FIX: Cancelled drawing ledger MUST reject prize draw execution.
  it('42. Cancelled drawing ledger MUST reject prize draw execution', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    cancelDrawingLedger(TEST_EVENT_ID, 'Event cancelled due to storm');

    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeTitle: 'Cancelled Draw Test',
        testSeed: 'CANCELLED-SEED-1',
      })
    ).rejects.toThrow(/cancelled/i);
  });

  // 43. BLOCKER 1 FIX: Cancelled drawing ledger MUST reject publishing drawing results.
  it('43. Cancelled drawing ledger MUST reject publishing drawing results', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Pre-cancellation Draw',
      testSeed: 'SEED-BEFORE-CANCEL',
    });
    cancelDrawingLedger(TEST_EVENT_ID, 'Event cancelled after partial draw');

    expect(() => publishDrawingResults(TEST_EVENT_ID)).toThrow(/cancelled/i);
  });

  // 44. BLOCKER 1 FIX: Valid locked ledger allows prize draw execution and transitions status to drawn.
  it('44. Valid locked ledger allows prize draw execution', async () => {
    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);
    expect(lock.status).toBe('locked');

    const drawRecord = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Valid Locked Draw Prize',
      testSeed: 'VALID-LOCK-SEED',
    });

    expect(drawRecord.status).toBe('drawn');
    const review = getDrawingLedgerReview(TEST_EVENT_ID);
    expect(review.ledgerStatus).toBe('drawn');
  });

  // 45. BLOCKER 1 FIX: Valid drawn ledger allows publishing drawing results.
  it('45. Valid drawn ledger allows publishing drawing results', async () => {
    setupTestEntries();
    lockDrawingLedger(TEST_EVENT_ID);
    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeTitle: 'Drawn State Prize',
      testSeed: 'DRAWN-STATE-SEED',
    });

    const published = publishDrawingResults(TEST_EVENT_ID);
    expect(published.length).toBe(1);
    expect(published[0].status).toBe('published');

    const review = getDrawingLedgerReview(TEST_EVENT_ID);
    expect(review.ledgerStatus).toBe('published');
  });

  // 46. BLOCKER 1 FIX: Unexpected or open lifecycle state rejects prize draw and publish operations.
  it('46. Open or un-locked ledger state rejects prize draw and publish operations', async () => {
    setupTestEntries(); // open ledger state, not locked

    await expect(
      executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeTitle: 'Open Ledger Draw Attempt',
        testSeed: 'UNLOCKED-SEED',
      })
    ).rejects.toThrow(/must be locked/i);

    expect(() => publishDrawingResults(TEST_EVENT_ID)).toThrow(/not locked/i);
  });

  // 46a. BLOCKER 1 DB FIX: DB-backed cancelled ledger rejects draw before any RPC transition.
  it('46a. DB-backed executePrizeDrawDB rejects cancelled drawing ledger', async () => {
    vi.resetModules();
    const mockSupabaseAdmin = createDrawingSupabaseMock('cancelled');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { executePrizeDrawDB } = await import('../lib/supabase-db');

    await expect(
      executePrizeDrawDB({
        eventId: TEST_EVENT_ID,
        drawMethod: 'manual_external',
        prizeTitle: 'DB Cancelled Draw',
        manualWinnerPublicParticipantId: 'fb2b7324',
        providerReference: 'Manual Ref #1',
      })
    ).rejects.toThrow(/cancelled/i);

    expect(mockSupabaseAdmin.calls.some((call) => call.method === 'rpc')).toBe(false);
    expect(mockSupabaseAdmin.calls.some((call) => call.table === 'prize_draw_records' && call.method === 'insert')).toBe(false);
  });

  // 46b. BLOCKER 1 DB FIX: DB-backed cancelled ledger rejects publish before any RPC transition.
  it('46b. DB-backed publishDrawingResultsDB rejects cancelled drawing ledger', async () => {
    vi.resetModules();
    const mockSupabaseAdmin = createDrawingSupabaseMock('cancelled');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { publishDrawingResultsDB } = await import('../lib/supabase-db');

    await expect(publishDrawingResultsDB(TEST_EVENT_ID)).rejects.toThrow(/cancelled/i);

    expect(mockSupabaseAdmin.calls.some((call) => call.method === 'rpc')).toBe(false);
  });

  // 46c. BLOCKER 1 DB FIX: Valid locked DB ledger draws through atomic allowed-state RPC.
  it('46c. DB-backed valid locked ledger draws through atomic lifecycle RPC', async () => {
    vi.resetModules();
    const mockSupabaseAdmin = createDrawingSupabaseMock('locked');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { executePrizeDrawDB } = await import('../lib/supabase-db');
    const draw = await executePrizeDrawDB({
      eventId: TEST_EVENT_ID,
      drawMethod: 'manual_external',
      prizeTitle: 'DB Valid Locked Draw',
      manualWinnerPublicParticipantId: 'fb2b7324',
      providerReference: 'Manual Ref #1',
    });

    const rpcCall = mockSupabaseAdmin.calls.find((call) => call.method === 'rpc');
    expect(draw.status).toBe('drawn');
    expect(rpcCall?.args[0]).toBe('execute_prize_draw_if_drawable');
    expect(rpcCall?.args[1].p_allowed_statuses).toEqual(['locked', 'drawn']);
    expect(mockSupabaseAdmin.calls.some((call) => call.table === 'prize_draw_records' && call.method === 'insert')).toBe(false);
  });

  // 46d. BLOCKER 1 DB FIX: Valid drawn DB ledger publishes through atomic allowed-state RPC.
  it('46d. DB-backed valid drawn ledger publishes through atomic lifecycle RPC', async () => {
    vi.resetModules();
    const mockSupabaseAdmin = createDrawingSupabaseMock('drawn');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { publishDrawingResultsDB } = await import('../lib/supabase-db');
    const published = await publishDrawingResultsDB(TEST_EVENT_ID);

    const rpcCall = mockSupabaseAdmin.calls.find((call) => call.method === 'rpc');
    expect(published[0].status).toBe('published');
    expect(rpcCall?.args[0]).toBe('publish_prize_draws_if_publishable');
    expect(rpcCall?.args[1].p_allowed_statuses).toEqual(['drawn']);
  });

  // 46e. BLOCKER 1 DB FIX: Unexpected DB lifecycle states fail closed.
  it('46e. DB-backed unexpected lifecycle state rejects draw and publish', async () => {
    vi.resetModules();
    const drawMock = createDrawingSupabaseMock('review');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: drawMock,
    }));

    const { executePrizeDrawDB } = await import('../lib/supabase-db');
    await expect(
      executePrizeDrawDB({
        eventId: TEST_EVENT_ID,
        drawMethod: 'manual_external',
        prizeTitle: 'DB Unexpected Draw',
        manualWinnerPublicParticipantId: 'fb2b7324',
        providerReference: 'Manual Ref #1',
      })
    ).rejects.toThrow(/only allowed/i);

    vi.resetModules();
    const publishMock = createDrawingSupabaseMock('locked');
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: publishMock,
    }));

    const { publishDrawingResultsDB } = await import('../lib/supabase-db');
    await expect(publishDrawingResultsDB(TEST_EVENT_ID)).rejects.toThrow(/only allowed/i);
  });

  // 46f. BLOCKER 1 DB FIX: stale DB lifecycle changes fail inside the atomic RPC.
  it('46f. DB-backed draw fails closed when atomic transition sees a stale/cancelled ledger', async () => {
    vi.resetModules();
    const mockSupabaseAdmin = createDrawingSupabaseMock('locked', {
      rpcError: 'Cannot execute prize draw for event. Ledger status cancelled is not drawable.',
    });
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { executePrizeDrawDB } = await import('../lib/supabase-db');

    await expect(
      executePrizeDrawDB({
        eventId: TEST_EVENT_ID,
        drawMethod: 'manual_external',
        prizeTitle: 'DB Stale Cancelled Draw',
        manualWinnerPublicParticipantId: 'fb2b7324',
        providerReference: 'Manual Ref #1',
      })
    ).rejects.toThrow(/cancelled|not drawable/i);
  });

  // 47. BLOCKER 2 FIX: ManualExternalDrawProvider sets isIndependent = false and audit metadata is system unverified.
  it('47. ManualExternalDrawProvider marks isIndependent = false and isSystemVerified = false', async () => {
    const { ManualExternalDrawProvider } = await import('../lib/game-engine');
    expect(ManualExternalDrawProvider.isIndependent).toBe(false);

    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);
    const winnerLabel = lock.canonicalSnapshot!.players[0].publicPlayerLabel;

    const draw = await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-manual-verify-check',
      prizeTitle: 'Manual Provider Verification Check',
      drawMethod: 'manual_external',
      manualWinnerPublicLabel: winnerLabel,
      providerReference: 'Physical Raffle Ticket #402',
    });

    expect(draw.auditMetadata.isIndependent).toBe(false);
    expect(draw.auditMetadata.isSystemVerified).toBe(false);
    expect(draw.auditMetadata.verificationStatus).toBe('manual_unverified');
    expect(draw.auditMetadata.disclaimer).toContain('NOT SYSTEM VERIFIED');
  });

  // 48. BLOCKER 2 FIX: Public drawing page data for manual external results reports manual_unverified status.
  it('48. Public drawing page data for manual external draws outputs manual_unverified verification status', async () => {
    setupTestEntries();
    const lock = lockDrawingLedger(TEST_EVENT_ID);
    const winnerLabel = lock.canonicalSnapshot!.players[0].publicPlayerLabel;

    await executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-public-manual-check',
      prizeTitle: 'Public Manual Check Prize',
      drawMethod: 'manual_external',
      manualWinnerPublicLabel: winnerLabel,
      providerReference: 'Wheel Spin #3',
    });

    publishDrawingResults(TEST_EVENT_ID);

    const pageData = getPublicDrawingPageData(TEST_EVENT_ID);
    expect(pageData.publishedPrizes.length).toBe(1);

    const prizeResult = pageData.publishedPrizes[0];
    expect(prizeResult.drawMethod).toBe('manual_external');
    expect(prizeResult.verificationStatus).toBe('manual_unverified');
    expect(prizeResult.isSystemVerified).toBe(false);
    expect(prizeResult.isIndependent).toBe(false);
  });

  // 49. BLOCKER 2 FIX: Admin and Public page component UI files contain explicit unverified warnings.
  it('49. Admin and Public drawing page components contain explicit unverified warnings for manual external draws', () => {
    const adminPageCode = readFileSync(join(process.cwd(), 'app/admin/drawing/page.tsx'), 'utf8');
    const publicPageCode = readFileSync(join(process.cwd(), 'app/events/[slug]/drawing/page.tsx'), 'utf8');

    expect(adminPageCode).toContain('RECORD MANUAL EXTERNAL RESULT (Manually Recorded / Unverified)');
    expect(adminPageCode).toContain('NOT SYSTEM VERIFIED');
    expect(publicPageCode).toContain('NOT SYSTEM VERIFIED');
    expect(publicPageCode).toContain('Manually Recorded (Not System Verified)');
  });

  // 50. BLOCKER 2 DB-BACKED FIX: getPublicDrawingPageDataDB returns manual_unverified, isSystemVerified=false, isIndependent=false.
  it('50. DB-backed getPublicDrawingPageDataDB preserves manual_unverified verification metadata for manual draws', async () => {
    vi.resetModules();
    vi.doUnmock('../lib/supabase');
    const engine = await import('../lib/game-engine');
    const { getPublicDrawingPageDataDB } = await import('../lib/supabase-db');

    engine.resetGameEngineStore();
    engine.initializeGameEngine();
    engine.awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-dev-001',
      entriesCount: 3,
      sourceType: 'test',
      reason: 'Qualified player 1',
    });
    engine.awardDrawingEntries({
      eventId: TEST_EVENT_ID,
      playerId: 'plr-dev-002',
      entriesCount: 2,
      sourceType: 'test',
      reason: 'Qualified player 2',
    });
    const lock = engine.lockDrawingLedger(TEST_EVENT_ID);
    const winnerLabel = lock.canonicalSnapshot!.players[0].publicPlayerLabel;

    await engine.executePrizeDraw({
      eventId: TEST_EVENT_ID,
      prizeId: 'prz-db-manual-check',
      prizeTitle: 'DB Manual Check Prize',
      drawMethod: 'manual_external',
      manualWinnerPublicLabel: winnerLabel,
      providerReference: 'Raffle Ticket #101',
    });

    engine.publishDrawingResults(TEST_EVENT_ID);

    const dbPageData = await getPublicDrawingPageDataDB(TEST_EVENT_ID);
    expect(dbPageData.publishedPrizes.length).toBe(1);

    const prizeResult = dbPageData.publishedPrizes[0];
    expect(prizeResult.drawMethod).toBe('manual_external');
    expect(prizeResult.verificationStatus).toBe('manual_unverified');
    expect(prizeResult.isSystemVerified).toBe(false);
    expect(prizeResult.isIndependent).toBe(false);
  });

  // 51. DB MIGRATION PROJECTION VIEW CHECK: Migration view projects verification_status, is_system_verified, and is_independent.
  it('51. Migration view public_published_drawings_projection projects verification_status, is_system_verified, and is_independent', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260813000000_transparent_prize_drawing_system.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('verification_status');
    expect(sql).toContain('is_system_verified');
    expect(sql).toContain('is_independent');
  });

  // 52. DB SERVICE LAYER MAPPER CHECK: lib/supabase-db.ts maps verificationStatus, isSystemVerified, and isIndependent.
  it('52. lib/supabase-db.ts maps verificationStatus, isSystemVerified, and isIndependent in getPublicDrawingPageDataDB', () => {
    const dbCode = readFileSync(join(process.cwd(), 'lib/supabase-db.ts'), 'utf8');

    expect(dbCode).toContain('verificationStatus: row.verification_status');
    expect(dbCode).toContain('isSystemVerified: row.is_system_verified');
    expect(dbCode).toContain('isIndependent: row.is_independent');
  });

  // 53. PUBLIC WINNERS SECTION NON-OVERCLAIMING CHECK: Public winners header uses conditional subtext.
  it('53. Public winners section header does not globally claim Audited & Verified when unverified manual draws exist', () => {
    const publicPageCode = readFileSync(join(process.cwd(), 'app/events/[slug]/drawing/page.tsx'), 'utf8');

    expect(publicPageCode).toContain('p.drawMethod === \'manual_external\' || p.isSystemVerified === false');
    expect(publicPageCode).toContain("prize.isSystemVerified === false");
    expect(publicPageCode).toContain('Status: Not System Verified');
    expect(publicPageCode).toContain('Official Quest Results');
    expect(publicPageCode).toContain('Audited & System Verified');
  });
});
