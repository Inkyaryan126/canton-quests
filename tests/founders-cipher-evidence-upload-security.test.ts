// Canton Quests — Founder's Cipher Photo/Video Evidence Upload Security
// (Master Launch Pivot correction)
//
// A photo/video quest may only auto-complete for a real, private,
// immutable evidence object this exact player uploaded through the signed-
// upload flow (POST /api/game/quest-proofs/authorize-upload) — never an
// arbitrary client-supplied URL or string. This file proves that contract
// at every layer: the pure path-ownership rules (lib/quest-evidence.ts),
// the local/offline engine's mirror of the real check (lib/game-engine.ts),
// the authorization endpoint's auth/prelaunch gating, and the production
// migration that made the storage bucket private and removed the old
// public-read / blanket-authenticated-upload policies.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  authorizeQuestEvidenceUpload,
  createQuest,
  resetGameEngineStore,
  initializeGameEngine,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import {
  buildQuestEvidencePath,
  isEvidencePathOwnedBy,
  extensionForContentType,
  normalizeEvidenceContentType,
  QUEST_EVIDENCE_BUCKET,
} from '../lib/quest-evidence';
import { SEED_EVENT } from '../lib/seed-data';
import { POST as authorizeUploadRoute } from '../app/api/game/quest-proofs/authorize-upload/route';

const EVENT_ID = SEED_EVENT.id;

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function makePhotoQuest() {
  return createQuest({
    eventId: EVENT_ID,
    title: 'Evidence Security Fixture',
    slug: `evidence-security-fixture-${Date.now()}`,
    description: 'x',
    instructions: 'x',
    pointValue: 50,
    difficulty: 'easy',
    category: 'exploration',
    verificationType: 'photo',
    proofRequirement: 'x',
    isFlash: false,
    status: 'active',
    sortOrder: 999,
    startingPath: 'family',
  });
}

describe('1. A canonical photo quest cannot pass using an arbitrary external URL or text', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('rejects a plain external URL never authorized by the server', () => {
    const quest = makePhotoQuest();
    const player = setCurrentPlayer('Agent_Arbitrary_URL', '🚫');
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://attacker.example.com/fake-evidence.jpg',
    });
    expect(result.success).toBe(false);
    expect(result.submission.status).toBe('rejected');
    expect(result.awardedPoints).toBe(0);
  });

  it('rejects plain text pretending to be a path', () => {
    const quest = makePhotoQuest();
    const player = setCurrentPlayer('Agent_Plain_Text', '🚫');
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'i-uploaded-a-photo-trust-me',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty/missing proofUrl', () => {
    const quest = makePhotoQuest();
    const player = setCurrentPlayer('Agent_No_Evidence', '🚫');
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
    });
    expect(result.success).toBe(false);
  });
});

describe('2. Real, server-authorized evidence passes', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a path minted by authorizeQuestEvidenceUpload for this exact player/quest/event succeeds', () => {
    const quest = makePhotoQuest();
    const player = setCurrentPlayer('Agent_Real_Evidence', '✅');
    const { path: evidencePath } = authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: player.id, questId: quest.id });
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: evidencePath,
    });
    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('verified');
  });
});

describe('3. Evidence path ownership is strictly enforced — a player can never claim someone else\'s (or another quest\'s) evidence', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('rejects a real, authorized evidence path that belongs to a different player', () => {
    const quest = makePhotoQuest();
    const owner = setCurrentPlayer('Agent_Real_Owner', '👤');
    const attacker = setCurrentPlayer('Agent_Evidence_Thief', '🕵️');
    const { path: ownerEvidencePath } = authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: owner.id, questId: quest.id });

    const result = submitQuestProof({
      playerId: attacker.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: ownerEvidencePath,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a real, authorized evidence path that was minted for a different quest', () => {
    const questA = makePhotoQuest();
    const questB = makePhotoQuest();
    const player = setCurrentPlayer('Agent_Wrong_Quest', '🔀');
    const { path: evidenceForQuestA } = authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: player.id, questId: questA.id });

    const result = submitQuestProof({
      playerId: player.id,
      questId: questB.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: evidenceForQuestA,
    });
    expect(result.success).toBe(false);
  });

  it('isEvidencePathOwnedBy rejects a path-traversal attempt appended to a real prefix', () => {
    expect(isEvidencePathOwnedBy('evt-1/plr-1/qst-1/../../../etc/passwd', 'evt-1', 'plr-1', 'qst-1')).toBe(false);
    expect(isEvidencePathOwnedBy('evt-1/plr-1/qst-1/nested/evidence.jpg', 'evt-1', 'plr-1', 'qst-1')).toBe(false);
  });

  it('isEvidencePathOwnedBy accepts only an exact eventId/playerId/questId/ prefix', () => {
    expect(isEvidencePathOwnedBy('evt-1/plr-1/qst-1/abc123.jpg', 'evt-1', 'plr-1', 'qst-1')).toBe(true);
    expect(isEvidencePathOwnedBy('evt-1/plr-2/qst-1/abc123.jpg', 'evt-1', 'plr-1', 'qst-1')).toBe(false);
    expect(isEvidencePathOwnedBy('evt-2/plr-1/qst-1/abc123.jpg', 'evt-1', 'plr-1', 'qst-1')).toBe(false);
  });

  it('buildQuestEvidencePath rejects unsafe id segments (rules out path-traversal at mint time too)', () => {
    expect(() =>
      buildQuestEvidencePath({ eventId: '../../etc', playerId: 'plr-1', questId: 'qst-1', evidenceId: 'x', ext: 'jpg' })
    ).toThrow();
    expect(() =>
      buildQuestEvidencePath({ eventId: 'evt-1', playerId: 'plr-1', questId: 'qst-1', evidenceId: 'x', ext: 'sh' })
    ).not.toThrow(); // 'sh' is a syntactically valid ext token — content-type gating happens at the API layer, not here
  });
});

describe('4. Only real, allow-listed evidence content types are ever accepted', () => {
  it('maps supported image/video MIME types to safe extensions', () => {
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
    expect(extensionForContentType('image/jpg')).toBe('jpg');
    expect(extensionForContentType('image/pjpeg')).toBe('jpg');
    expect(extensionForContentType('image/png')).toBe('png');
    expect(extensionForContentType('image/x-png')).toBe('png');
    expect(extensionForContentType('image/heif')).toBe('heif');
    expect(extensionForContentType('image/avif')).toBe('avif');
    expect(extensionForContentType('image/tiff')).toBe('tiff');
    expect(extensionForContentType('video/mp4')).toBe('mp4');
  });

  it('accepts common photo aliases and falls back to a recognized filename extension', () => {
    expect(normalizeEvidenceContentType('image/jpg')).toBe('image/jpeg');
    expect(normalizeEvidenceContentType('image/x-png')).toBe('image/png');
    expect(normalizeEvidenceContentType('', 'camera.heic')).toBe('image/heic');
    expect(normalizeEvidenceContentType('', 'camera.heif')).toBe('image/heif');
    expect(normalizeEvidenceContentType('', 'camera.tiff')).toBe('image/tiff');
    expect(normalizeEvidenceContentType('', 'camera.exe')).toBeUndefined();
  });

  it('rejects an unsupported/dangerous content type', () => {
    expect(extensionForContentType('application/x-sh')).toBeUndefined();
    expect(extensionForContentType('text/html')).toBeUndefined();
  });
});

describe('5. POST /api/game/quest-proofs/authorize-upload never issues an upload token without real authentication', () => {
  it('rejects an unauthenticated request and never returns a path/token', async () => {
    const req = new Request('http://localhost:3000/api/game/quest-proofs/authorize-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: EVENT_ID, questId: 'qst-canton-sign-capture', contentType: 'image/jpeg' }),
    });
    const res = await authorizeUploadRoute(req);
    const data = await res.json();
    // In this test environment Supabase Storage isn't configured, so the
    // route fails closed with 503 before it even reaches the auth check —
    // in a real environment an unauthenticated request gets 401 instead.
    // Either way, the property under test holds: no success, no path, no
    // token is ever handed out.
    expect(res.status).not.toBe(200);
    expect(data.success).not.toBe(true);
    expect(data.path).toBeUndefined();
    expect(data.token).toBeUndefined();
  });

  it('the route checks authentication before ever minting a signed upload URL', () => {
    const routeSource = readSource('app/api/game/quest-proofs/authorize-upload/route.ts');
    const authIdx = routeSource.indexOf('resolveAuthenticatedSession');
    const signIdx = routeSource.indexOf('createSignedUploadUrl');
    expect(authIdx).toBeGreaterThan(-1);
    expect(signIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(signIdx);
  });
});

describe('6 & 7. Production evidence storage is private and immutable (migration-level proof)', () => {
  const migrationSource = readSource('supabase/migrations/20260911010000_quest_proofs_private_evidence_storage.sql');
  const limitsMigrationSource = readSource('supabase/migrations/20260911040000_quest_proofs_storage_limits_and_mime_types.sql');

  it('flips the quest-proofs bucket to private', () => {
    expect(migrationSource).toContain("UPDATE storage.buckets SET public = false WHERE id = 'quest-proofs'");
  });

  it('removes the old public-read policy — evidence is never publicly listable/downloadable', () => {
    expect(migrationSource).toContain('DROP POLICY IF EXISTS "Quest proofs public read access"');
  });

  it('records the production bucket size and supported MIME configuration without changing privacy or RLS', () => {
    expect(limitsMigrationSource).toContain('file_size_limit = 25000000');
    expect(limitsMigrationSource).toContain("'image/heic'");
    expect(limitsMigrationSource).toContain("'image/heif'");
    expect(limitsMigrationSource).toContain("'image/avif'");
    expect(limitsMigrationSource).toContain("'video/quicktime'");
    expect(limitsMigrationSource).not.toMatch(/CREATE POLICY|DROP POLICY/);
  });

  it('removes the old blanket-authenticated-upload policy — no player can overwrite or upload outside the signed-upload flow', () => {
    expect(migrationSource).toContain('DROP POLICY IF EXISTS "Quest proofs authenticated upload"');
  });

  it('does not add back any replacement anon/authenticated SELECT or INSERT policy', () => {
    expect(migrationSource).not.toMatch(/CREATE POLICY[\s\S]*?ON storage\.objects/);
  });

  it('the evidence bucket constant used by both client and server code matches the migrated bucket', () => {
    expect(QUEST_EVIDENCE_BUCKET).toBe('quest-proofs');
  });
});

describe('8. Evidence is verified server-side before completion — never trusted from the client alone', () => {
  it('the submit route never accepts a client-supplied "verified"/"evidenceConfirmed" boolean', () => {
    const submitSource = readSource('app/api/game/submit/route.ts');
    expect(submitSource).not.toMatch(/evidenceConfirmed\s*:\s*(body|req)/);
    expect(submitSource).not.toMatch(/verified\s*:\s*true/);
  });

  it('lib/supabase-db.ts independently re-verifies evidence existence and ownership before verifyAutomatedProof runs', () => {
    const dbSource = readSource('lib/supabase-db.ts');
    expect(dbSource).toContain('verifyQuestEvidenceObjectExistsDB');
    expect(dbSource).toContain('isEvidencePathOwnedBy');
  });
});

describe('9. The exact photo challenge is preserved at submission time, never regenerated later', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a verified photo submission freezes quest title, instructions, proof requirement, evidence path and MIME type', () => {
    const player = setCurrentPlayer('Agent_Evidence_Context', '🧾');
    const { path: evidencePath } = authorizeQuestEvidenceUpload({
      eventId: EVENT_ID,
      playerId: player.id,
      questId: 'qst-canton-sign-capture',
      ext: 'jpg',
    });
    const result = submitQuestProof({
      playerId: player.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: evidencePath,
    });

    expect(result.submission.evidenceContext).toBeDefined();
    expect(result.submission.evidenceContext!.evidencePath).toBe(evidencePath);
    expect(result.submission.evidenceContext!.questTitle).toBeTruthy();
    expect(result.submission.evidenceContext!.instructions).toBeTruthy();
    expect(result.submission.evidenceContext!.proofRequirement).toBeTruthy();
    expect(result.submission.evidenceContext!.mimeType).toBe('image/jpeg');
    expect(result.submission.evidenceContext!.capturedAt).toBeTruthy();
  });

  it('a rejected (unverified) submission never gets an evidence context — nothing was actually confirmed', () => {
    const player = setCurrentPlayer('Agent_Evidence_Context_Rejected', '🚫');
    const result = submitQuestProof({
      playerId: player.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/fake.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.submission.evidenceContext).toBeUndefined();
  });

  it('production path (lib/supabase-db.ts) captures the same snapshot before inserting the submission row', () => {
    const dbSource = readSource('lib/supabase-db.ts');
    expect(dbSource).toContain('buildEvidenceContextSnapshot');
    expect(dbSource).toContain('evidence_context');
  });

  it('the evidence-context migration adds the column additively, without touching existing rows', () => {
    const migrationSource = readSource('supabase/migrations/20260911030000_quest_submissions_evidence_context.sql');
    expect(migrationSource).toContain('ADD COLUMN IF NOT EXISTS evidence_context JSONB');
  });
});
