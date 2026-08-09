import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  createEventWizard,
  duplicateEvent,
  getEventReadinessCheck,
  getQuestTemplates,
  generateQRCodeToken,
  resolveQRToken,
  exportEventJSON,
  importEventJSON,
  getEvents,
  getQuestsForEvent,
  getCurrentPlayer,
} from '../lib/game-engine';
import { evaluateProofIntegrity } from '../lib/proof-integrity';
import { verifyAdminSecret, authorizeGameMasterRequest } from '../lib/admin-auth';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

describe('Phase 4 — Event Factory & Quest Studio Test Suite', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  it('1. should create a new event via Event Wizard', () => {
    const newEvt = createEventWizard({
      cityId: 'city-canton-oh',
      title: 'Canton Quest Weekend #2 — Art Cipher',
      slug: 'canton-weekend-2-art',
      description: 'Explore Canton Arts District',
      status: 'draft',
      currentPhase: 'day_1',
      isPaused: false,
      startTime: '2026-09-11T18:00:00Z',
      endTime: '2026-09-14T22:00:00Z',
    });

    expect(newEvt.id).toBeDefined();
    expect(newEvt.title).toBe('Canton Quest Weekend #2 — Art Cipher');
    expect(newEvt.status).toBe('draft');
  });

  it('2. should duplicate an event template without copying player progress', () => {
    const sourceEvt = getEvents().find((e) => e.id === SEED_EVENT.id) || getEvents()[0];
    const dupRes = duplicateEvent(sourceEvt.id, 'Canton Weekend Duplicated', 'canton-dup-test');

    expect(dupRes.newEvent.id).not.toBe(sourceEvt.id);
    expect(dupRes.newEvent.title).toBe('Canton Weekend Duplicated');
    expect(dupRes.duplicatedQuestsCount).toBeGreaterThan(0);

    const dupQuests = getQuestsForEvent(dupRes.newEvent.id);
    expect(dupQuests.length).toBe(dupRes.duplicatedQuestsCount);
    expect(dupQuests[0].currentClaims).toBe(0);
  });

  it('3. should generate pre-launch readiness check and design summary metrics', () => {
    const activeEvt = getEvents().find((e) => e.id === SEED_EVENT.id) || getEvents()[0];
    const readiness = getEventReadinessCheck(activeEvt.id);

    expect(readiness.metrics.totalQuests).toBeGreaterThan(0);
    expect(readiness.metrics.totalXp).toBeGreaterThan(0);
    expect(readiness.isReady).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
  });

  it('4. should provide standard quest preset templates', () => {
    const templates = getQuestTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);

    const checkinTmpl = templates.find((t) => t.id === 'tmpl-checkin');
    expect(checkinTmpl).toBeDefined();
    expect(checkinTmpl?.preset.verificationType).toBe('checkin');
  });

  it('5. should generate and resolve QR token codes', () => {
    const activeEvt = getEvents().find((e) => e.id === SEED_EVENT.id) || getEvents()[0];
    const newQr = generateQRCodeToken(activeEvt.id, 'quest', 'qst-centennial-discovery', 'Centennial QR');

    expect(newQr.token).toContain('CQQR-');
    expect(newQr.targetUrl).toContain('/qr/CQQR-');

    const resolved = resolveQRToken(newQr.token);
    expect(resolved).toBeDefined();
    expect(resolved?.label).toBe('Centennial QR');
  });

  it('6. should evaluate proof integrity and generate automated review flags for duplicate proofs', () => {
    const quest = SEED_QUESTS[0];
    const player = getCurrentPlayer();

    const flags = evaluateProofIntegrity(
      {
        playerId: player.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: 'photo',
        submittedContent: 'DUPLICATE_TEXT_PROOF_TEST_STRING_12345',
      },
      quest,
      [
        {
          id: 'sub-existing-1',
          questId: 'qst-other',
          playerId: 'plr-other',
          eventId: SEED_EVENT.id,
          proofType: 'photo',
          submittedContent: 'DUPLICATE_TEXT_PROOF_TEST_STRING_12345',
          status: 'verified',
          awardedPoints: 100,
          submittedAt: new Date().toISOString(),
        },
      ]
    );

    expect(flags).toContain('DUPLICATE_PROOF');
  });

  it('7. should enforce server-side Game Master security authorization', () => {
    expect(verifyAdminSecret('canton-gm-2026')).toBe(true);
    expect(verifyAdminSecret('wrong-secret')).toBe(false);

    const authSession = authorizeGameMasterRequest({ 'x-admin-key': 'canton-gm-2026' });
    expect(authSession.isAdmin).toBe(true);

    const deniedSession = authorizeGameMasterRequest({ 'x-admin-key': 'wrong' });
    expect(deniedSession.isAdmin).toBe(false);
  });

  it('8. should export and import event JSON structure', () => {
    const activeEvt = getEvents().find((e) => e.id === SEED_EVENT.id) || getEvents()[0];
    const jsonExport = exportEventJSON(activeEvt.id);
    expect(jsonExport).toContain(activeEvt.title);

    const importRes = importEventJSON(jsonExport);
    expect(importRes.success).toBe(true);
    expect(importRes.newEvent).toBeDefined();
  });
});
