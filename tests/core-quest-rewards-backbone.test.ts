import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  getEvents,
  getEventBySlug,
  getQuestsForEvent,
  getQuestById,
  setCurrentPlayer,
  submitQuestProof,
  reviewSubmission,
  initializeGameEngine,
  awardDrawingEntries,
  getDrawingEntriesForEvent,
  getDrawingEntriesForPlayer,
  getPublicDrawingLedgerProjection,
  exportDrawingLedgerSnapshot,
  lockDrawingLedger,
  getPublicQuestView,
  createQuest,
  createEvent,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { PublicQuestView, Quest } from '../lib/types';

describe('Canton Quests — Core Quest Rewards Backbone Suite', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  it('1. Event contains multiple quests correctly', () => {
    const quests = getQuestsForEvent(SEED_EVENT.id);
    expect(quests.length).toBeGreaterThanOrEqual(2);
    const eventQuestIds = quests.map((q) => q.eventId);
    expect(eventQuestIds.every((id) => id === SEED_EVENT.id)).toBe(true);
  });

  it('2. Quest belongs to correct event', () => {
    const quest = SEED_QUESTS[0];
    expect(quest.eventId).toBe(SEED_EVENT.id);

    const eventQuests = getQuestsForEvent(quest.eventId);
    expect(eventQuests.some((q) => q.id === quest.id)).toBe(true);
  });

  it('3. Valid automated proof becomes verified', () => {
    const player = setCurrentPlayer('Agent_Auto_Verify_Tester', '⚡');
    const quest = SEED_QUESTS[1]; // Passphrase quest, targetCode: 1897

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1897',
    });

    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('verified');
    expect(result.awardedPoints).toBe(quest.pointValue);
    expect(result.drawingEntriesAwarded).toBe(quest.drawingEntryReward ?? 1);
  });

  it('4. Invalid proof does not verify', () => {
    const player = setCurrentPlayer('Agent_Invalid_Proof_Tester', '❌');
    const quest = SEED_QUESTS[1]; // Passphrase quest, targetCode: 1897

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'WRONG_CODE_999',
    });

    expect(result.success).toBe(false);
    expect(result.submission.status).toBe('rejected');
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);
  });

  it('5. Pending manual proof does not award rewards', () => {
    const player = setCurrentPlayer('Agent_Manual_Pending_Tester', '📸');
    const quest = SEED_QUESTS[2]; // Photo proof quest (manual GM approval)

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      proofUrl: 'https://example.com/mural.jpg',
    });

    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('pending');
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);

    // Verify drawing ledger has 0 entries for this pending submission
    const playerEntries = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id);
    expect(playerEntries.some((e) => e.questId === quest.id)).toBe(false);
  });

  it('6. Verified proof awards XP exactly once', () => {
    const player = setCurrentPlayer('Agent_XP_Once_Tester', '🎯');
    const startXp = player.totalXp;
    const quest = SEED_QUESTS[0]; // Check-in quest (50 XP)

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(50);

    const updatedPlayer = setCurrentPlayer('Agent_XP_Once_Tester', '🎯');
    expect(updatedPlayer.totalXp).toBe(startXp + 50);
  });

  it('7. Verified proof awards drawing entries exactly once', () => {
    const player = setCurrentPlayer('Agent_Entries_Once_Tester', '🎟️');
    const quest = SEED_QUESTS[0]; // Centennial beacon check-in

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(result.success).toBe(true);
    expect(result.drawingEntriesAwarded).toBe(1);

    const drawingEntries = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id);
    const questEntries = drawingEntries.filter((e) => e.questId === quest.id);
    expect(questEntries.length).toBe(1);
    expect(questEntries[0].entriesCount).toBe(1);
  });

  it('8. Duplicate completion cannot duplicate XP', () => {
    const player = setCurrentPlayer('Agent_No_Dup_XP', '🛡️');
    const quest = SEED_QUESTS[5]; // Palace Theatre passphrase quest

    const first = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });
    expect(first.success).toBe(true);
    expect(first.awardedPoints).toBe(125);

    const pAfterFirst = setCurrentPlayer('Agent_No_Dup_XP', '🛡️');
    const xpAfterFirst = pAfterFirst.totalXp;

    const second = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });
    expect(second.success).toBe(false);
    expect(second.awardedPoints).toBe(0);

    const pAfterSecond = setCurrentPlayer('Agent_No_Dup_XP', '🛡️');
    expect(pAfterSecond.totalXp).toBe(xpAfterFirst);
  });

  it('9. Duplicate completion cannot duplicate drawing entries', () => {
    const player = setCurrentPlayer('Agent_No_Dup_Entries', '🎟️');
    const quest = SEED_QUESTS[5];

    submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });

    const entriesFirst = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id);
    const countFirst = entriesFirst.reduce((sum, e) => sum + e.entriesCount, 0);

    submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });

    const entriesSecond = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id);
    const countSecond = entriesSecond.reduce((sum, e) => sum + e.entriesCount, 0);

    expect(countSecond).toBe(countFirst);
  });

  it('10. Drawing entries are scoped to the correct event', () => {
    const player = setCurrentPlayer('Agent_Event_Scope_Tester', '🌐');

    // Award entry in Event 1
    awardDrawingEntries({
      eventId: SEED_EVENT.id,
      playerId: player.id,
      questId: SEED_QUESTS[0].id,
      entriesCount: 3,
      sourceType: 'quest_completion',
      reason: 'Event 1 test',
    });

    // Award entry in Event 2
    awardDrawingEntries({
      eventId: 'evt-canton-vol-2',
      playerId: player.id,
      questId: 'qst-vol2-sample',
      entriesCount: 5,
      sourceType: 'quest_completion',
      reason: 'Event 2 test',
    });

    const event1Entries = getDrawingEntriesForEvent(SEED_EVENT.id);
    const event2Entries = getDrawingEntriesForEvent('evt-canton-vol-2');

    expect(event1Entries.some((e) => e.playerId === player.id && e.entriesCount === 3)).toBe(true);
    expect(event1Entries.some((e) => e.eventId === 'evt-canton-vol-2')).toBe(false);

    expect(event2Entries.some((e) => e.playerId === player.id && e.entriesCount === 5)).toBe(true);
    expect(event2Entries.some((e) => e.eventId === SEED_EVENT.id)).toBe(false);
  });

  it('11. Persistent XP survives across event boundaries', () => {
    const player = setCurrentPlayer('Agent_Persistent_XP_Tester', '⭐');

    // Complete quest in Event 1
    submitQuestProof({
      playerId: player.id,
      questId: SEED_QUESTS[0].id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    const pAfterEvent1 = setCurrentPlayer('Agent_Persistent_XP_Tester', '⭐');
    const xpEvent1 = pAfterEvent1.totalXp;
    expect(xpEvent1).toBeGreaterThan(0);

    // Complete quest in Event 2 (different event)
    const event2 = createEvent({
      cityId: 'city-canton-oh',
      title: 'Canton Quest Volume 2',
      slug: 'canton-vol-2',
      description: 'Second volume event',
      status: 'active',
      currentPhase: 'day_1',
      isPaused: false,
    });

    const quest2 = createQuest({
      eventId: event2.id,
      title: 'Vol 2 Opening Beacon',
      slug: 'vol-2-opening',
      description: 'Vol 2 check-in',
      instructions: 'Check in at Vol 2',
      pointValue: 300,
      xpReward: 300,
      drawingEntryReward: 2,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'passphrase',
      targetCode: 'VOL2-OPEN',
      proofRequirement: 'Passphrase',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
    });

    submitQuestProof({
      playerId: player.id,
      questId: quest2.id,
      eventId: event2.id,
      proofType: 'passphrase',
      submittedContent: 'VOL2-OPEN',
    });

    const pAfterEvent2 = setCurrentPlayer('Agent_Persistent_XP_Tester', '⭐');
    // Persistent XP must combine across events
    expect(pAfterEvent2.totalXp).toBe(xpEvent1 + 300);
  });

  it('12. Public prize-ledger projection contains no private player information', () => {
    const player = setCurrentPlayer('Agent_Privacy_Check', '🔒');

    submitQuestProof({
      playerId: player.id,
      questId: SEED_QUESTS[0].id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    const projection = getPublicDrawingLedgerProjection(SEED_EVENT.id);
    expect(projection.eventId).toBe(SEED_EVENT.id);
    expect(projection.totalEntriesAcrossAllPlayers).toBeGreaterThan(0);

    const playerEntry = projection.playerEntries.find(
      (e) => e.playerPublicLabel === player.displayName
    );
    expect(playerEntry).toBeDefined();

    // Verify projection object structure has no private keys
    const jsonStr = JSON.stringify(projection);
    expect(jsonStr).not.toContain('user_id');
    expect(jsonStr).not.toContain('playerId');
    expect(jsonStr).not.toContain('submissionId');
    expect(jsonStr).not.toContain('latitude');
    expect(jsonStr).not.toContain('targetCode');
  });

  it('13. Player cannot claim another player reward', () => {
    const ownerPlayer = setCurrentPlayer('Owner_Agent', '👑');
    const attackerPlayer = setCurrentPlayer('Attacker_Agent', '🕵️');
    const quest = SEED_QUESTS[2]; // Photo proof quest

    // Owner submits photo proof
    const ownerSub = submitQuestProof({
      playerId: ownerPlayer.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      proofUrl: 'https://example.com/owner-mural.jpg',
    });

    expect(ownerSub.submission.playerId).toBe(ownerPlayer.id);

    // GM approves owner's submission
    const verifiedSub = reviewSubmission(ownerSub.submission.id, 'verified');
    expect(verifiedSub?.playerId).toBe(ownerPlayer.id);

    // Verify drawing entry is awarded to owner, NOT attacker
    const ownerDrawingEntries = getDrawingEntriesForPlayer(ownerPlayer.id, SEED_EVENT.id);
    const attackerDrawingEntries = getDrawingEntriesForPlayer(attackerPlayer.id, SEED_EVENT.id);

    expect(ownerDrawingEntries.some((e) => e.submissionId === ownerSub.submission.id)).toBe(true);
    expect(attackerDrawingEntries.some((e) => e.submissionId === ownerSub.submission.id)).toBe(false);
  });

  it('14. Quest secret verification values are not exposed publicly', () => {
    const questWithSecret: Quest = {
      ...SEED_QUESTS[1],
      targetCode: 'TOP_SECRET_PASS_CODE_777',
      gmNotes: 'Internal GM Note: Do not reveal under any circumstances!',
    };

    const publicView: PublicQuestView = getPublicQuestView(questWithSecret);

    expect('targetCode' in publicView).toBe(false);
    expect('gmNotes' in publicView).toBe(false);
    expect(publicView.title).toBe(questWithSecret.title);
    expect(publicView.description).toBe(questWithSecret.description);
  });

  it('15. GPS quest requires coordinates and proximity validation', () => {
    const player = setCurrentPlayer('Agent_GPS_Tester', '📡');
    const gpsQuest = createQuest({
      eventId: SEED_EVENT.id,
      title: 'GPS Beacon Challenge',
      slug: 'gps-beacon-test',
      description: 'Location verification required',
      instructions: 'Go to target location',
      pointValue: 150,
      xpReward: 150,
      drawingEntryReward: 1,
      difficulty: 'medium',
      category: 'exploration',
      verificationType: 'gps',
      proofRequirement: 'GPS',
      isFlash: false,
      status: 'active',
      sortOrder: 10,
      location: {
        id: 'loc-test',
        cityId: 'city-canton-oh',
        name: 'Test Location',
        latitude: 40.7989,
        longitude: -81.3784,
        isPartner: false,
        radiusMeters: 50,
      },
      radiusMeters: 50,
    });

    // Attempt 1: Submitting without userLat / userLon must fail
    const noCoordsRes = submitQuestProof({
      playerId: player.id,
      questId: gpsQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'gps',
    });
    expect(noCoordsRes.success).toBe(false);
    expect(noCoordsRes.submission.status).toBe('rejected');
    expect(noCoordsRes.awardedPoints).toBe(0);

    // Attempt 2: Submitting far away (outside radius) must fail
    const farRes = submitQuestProof({
      playerId: player.id,
      questId: gpsQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'gps',
      userLat: 40.9000, // Miles away
      userLon: -81.5000,
    });
    expect(farRes.success).toBe(false);
    expect(farRes.submission.status).toBe('rejected');
    expect(farRes.awardedPoints).toBe(0);

    // Attempt 3: Submitting within 50m radius must succeed
    const validRes = submitQuestProof({
      playerId: player.id,
      questId: gpsQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'gps',
      userLat: 40.7989,
      userLon: -81.3784,
    });
    expect(validRes.success).toBe(true);
    expect(validRes.submission.status).toBe('verified');
    expect(validRes.awardedPoints).toBe(150);
  });

  it('16. Multi-step quest requires ordered step completion', () => {
    const player = setCurrentPlayer('Agent_Multistep_Tester', '🧩');
    const multiQuest = createQuest({
      eventId: SEED_EVENT.id,
      title: 'Decoders Trial',
      slug: 'decoders-trial',
      description: '2-step puzzle sequence',
      instructions: 'Complete step 1 then step 2',
      pointValue: 300,
      xpReward: 300,
      drawingEntryReward: 2,
      difficulty: 'hard',
      category: 'puzzle',
      verificationType: 'multi_step',
      proofRequirement: 'Sequence',
      isFlash: false,
      status: 'active',
      sortOrder: 11,
      steps: [
        {
          id: 'step-1',
          questId: 'dummy-id',
          stepOrder: 1,
          title: 'Step 1: First Key',
          instructions: 'Enter first code',
          verificationType: 'passphrase',
          targetCode: 'FIRST_KEY_123',
        },
        {
          id: 'step-2',
          questId: 'dummy-id',
          stepOrder: 2,
          title: 'Step 2: Final Key',
          instructions: 'Enter final code',
          verificationType: 'passphrase',
          targetCode: 'FINAL_KEY_456',
        },
      ],
    });

    // Attempting step 1 out of order (stepIndex 1 instead of 0) must fail
    const skipStepRes = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 1,
      submittedContent: 'FINAL_KEY_456',
    });
    expect(skipStepRes.success).toBe(false);
    expect(skipStepRes.awardedPoints).toBe(0);

    // Valid step 0 submission unlocks step 1, status = in_progress, 0 rewards yet
    const step0Res = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 0,
      submittedContent: 'FIRST_KEY_123',
    });
    expect(step0Res.success).toBe(true);
    expect(step0Res.submission.status).toBe('in_progress');
    expect(step0Res.currentStepCompleted).toBe(1);
    expect(step0Res.awardedPoints).toBe(0);

    // Valid step 1 submission completes full quest, awards XP & entries
    const step1Res = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 1,
      submittedContent: 'FINAL_KEY_456',
    });
    expect(step1Res.success).toBe(true);
    expect(step1Res.isQuestFullyCompleted).toBe(true);
    expect(step1Res.submission.status).toBe('verified');
    expect(step1Res.awardedPoints).toBe(300);
    expect(step1Res.drawingEntriesAwarded).toBe(2);
  });

  it('17. Public multi-step quest view hides current and future step target codes', () => {
    const secretQuest: Quest = {
      ...SEED_QUESTS[1],
      verificationType: 'multi_step',
      steps: [
        {
          id: 'safe-step-1',
          questId: SEED_QUESTS[1].id,
          stepOrder: 1,
          title: 'Visible Objective',
          instructions: 'Find the first mark.',
          verificationType: 'passphrase',
          targetCode: 'DO_NOT_EXPOSE_STEP_1',
        },
        {
          id: 'safe-step-2',
          questId: SEED_QUESTS[1].id,
          stepOrder: 2,
          title: 'Future Objective',
          instructions: 'This is safe narrative only.',
          verificationType: 'passphrase',
          targetCode: 'DO_NOT_EXPOSE_FUTURE_STEP_2',
        },
      ],
    };

    const publicView = getPublicQuestView(secretQuest);
    const serialized = JSON.stringify(publicView);

    expect(serialized).not.toContain('DO_NOT_EXPOSE_STEP_1');
    expect(serialized).not.toContain('DO_NOT_EXPOSE_FUTURE_STEP_2');
    expect(serialized).not.toContain('targetCode');
  });

  it('18. GPS failure awards zero drawing entries as well as zero XP', () => {
    const player = setCurrentPlayer('Agent_GPS_Zero_Reward', '📍');
    const quest = SEED_QUESTS[0];

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
    });

    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);
    expect(getDrawingEntriesForPlayer(player.id, SEED_EVENT.id)).toHaveLength(0);
  });

  it('19. Multi-step step 3 cannot be submitted before step 2', () => {
    const player = setCurrentPlayer('Agent_No_Step3_Skip', '🧩');
    const multiQuest = createQuest({
      eventId: SEED_EVENT.id,
      title: 'Three Lock Trial',
      slug: 'three-lock-trial',
      description: 'Three ordered passphrases',
      instructions: 'Complete every lock in order.',
      pointValue: 400,
      xpReward: 400,
      drawingEntryReward: 3,
      difficulty: 'hard',
      category: 'puzzle',
      verificationType: 'multi_step',
      proofRequirement: 'Sequence',
      isFlash: false,
      status: 'active',
      sortOrder: 12,
      steps: [
        { id: 's1', questId: 'three-lock-trial', stepOrder: 1, title: 'One', instructions: 'One', verificationType: 'passphrase', targetCode: 'ONE' },
        { id: 's2', questId: 'three-lock-trial', stepOrder: 2, title: 'Two', instructions: 'Two', verificationType: 'passphrase', targetCode: 'TWO' },
        { id: 's3', questId: 'three-lock-trial', stepOrder: 3, title: 'Three', instructions: 'Three', verificationType: 'passphrase', targetCode: 'THREE' },
      ],
    });

    const step1 = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 0,
      submittedContent: 'ONE',
    });
    expect(step1.success).toBe(true);
    expect(step1.currentStepCompleted).toBe(1);

    const skippedStep3 = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 2,
      submittedContent: 'THREE',
    });

    expect(skippedStep3.success).toBe(false);
    expect(skippedStep3.awardedPoints).toBe(0);
    expect(skippedStep3.drawingEntriesAwarded).toBe(0);
  });

  it('20. Final multi-step completion cannot duplicate quest rewards', () => {
    const player = setCurrentPlayer('Agent_Final_Step_Once', '🔐');
    const multiQuest = createQuest({
      eventId: SEED_EVENT.id,
      title: 'Two Lock Reward Trial',
      slug: 'two-lock-reward-trial',
      description: 'Two ordered passphrases',
      instructions: 'Complete every lock in order.',
      pointValue: 275,
      xpReward: 275,
      drawingEntryReward: 2,
      difficulty: 'medium',
      category: 'puzzle',
      verificationType: 'multi_step',
      proofRequirement: 'Sequence',
      isFlash: false,
      status: 'active',
      sortOrder: 13,
      steps: [
        { id: 'r1', questId: 'two-lock-reward-trial', stepOrder: 1, title: 'First', instructions: 'First', verificationType: 'passphrase', targetCode: 'ALPHA' },
        { id: 'r2', questId: 'two-lock-reward-trial', stepOrder: 2, title: 'Final', instructions: 'Final', verificationType: 'passphrase', targetCode: 'OMEGA' },
      ],
    });

    submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 0,
      submittedContent: 'ALPHA',
    });

    const firstFinal = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 1,
      submittedContent: 'OMEGA',
    });
    const secondFinal = submitQuestProof({
      playerId: player.id,
      questId: multiQuest.id,
      eventId: SEED_EVENT.id,
      proofType: 'multi_step',
      stepIndex: 1,
      submittedContent: 'OMEGA',
    });

    const entries = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id).filter((entry) => entry.questId === multiQuest.id);
    expect(firstFinal.awardedPoints).toBe(275);
    expect(firstFinal.drawingEntriesAwarded).toBe(2);
    expect(secondFinal.awardedPoints).toBe(0);
    expect(secondFinal.drawingEntriesAwarded).toBe(0);
    expect(entries).toHaveLength(1);
  });

  it('21. Drawing ledger snapshot hash is genuine SHA-256', () => {
    const player = setCurrentPlayer('Agent_SHA256_Check', '🧾');
    awardDrawingEntries({
      eventId: SEED_EVENT.id,
      playerId: player.id,
      questId: 'qst-hash-proof',
      entriesCount: 2,
      sourceType: 'quest_completion',
      reason: 'Hash proof',
    });

    const exportResult = exportDrawingLedgerSnapshot(SEED_EVENT.id);
    const expectedHash = `SHA256-${createHash('sha256').update(JSON.stringify(exportResult.snapshot)).digest('hex')}`;

    expect(exportResult.snapshotHash).toBe(expectedHash);
    expect(exportResult.snapshotHash).toMatch(/^SHA256-[a-f0-9]{64}$/);
  });

  it('22. Supabase-configured submission path fails closed instead of delegating to local engine', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: false,
      supabase: {},
      supabaseAdmin: null,
    }));

    const { submitQuestProofDB } = await import('../lib/supabase-db');
    const result = await submitQuestProofDB({
      playerId: 'plr-attacker',
      questId: SEED_QUESTS[1].id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1897',
    });

    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);
    expect(result.message).toContain('service-role');

    vi.doUnmock('../lib/supabase');
  });

  it('23. Core rewards migration hardens raw ledgers and adds idempotency constraints', () => {
    const sql = readFileSync('supabase/migrations/20260812000000_core_quest_rewards_backbone.sql', 'utf8');

    expect(sql).toContain('uq_score_quest_completion_xp');
    expect(sql).toContain("category = 'quest_completion'");
    expect(sql).toContain('public_drawing_ledger_projection');
    expect(sql).toContain('WITH (security_barrier = true)');
    expect(sql).toContain('Admins can view raw drawing entries');
    expect(sql).not.toContain('auth.uid() IS NULL');
    expect(sql).not.toMatch(/CREATE POLICY "Drawing entries viewable by everyone" ON public\.drawing_entry_ledger/);
  });
});
