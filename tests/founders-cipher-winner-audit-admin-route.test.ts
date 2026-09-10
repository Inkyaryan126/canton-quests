// Canton Quests — Winner Audit Admin Route (Master Launch Pivot correction,
// item 5)
//
// The winner-audit queue exposes a short-lived signed READ URL into the
// private quest-proofs bucket so a Game Master can actually look at a drawn
// candidate's locked evidence before payout. This must never be reachable
// without a real admin session — neither the queue contents nor a signed
// URL, and the resolve action (approve/reject) must be equally gated.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET as winnerAuditGetRoute, POST as winnerAuditPostRoute } from '../app/api/game/admin/winner-audit/route';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('GET /api/game/admin/winner-audit never returns queue data or signed URLs without admin auth', () => {
  it('rejects an unauthenticated request', async () => {
    const req = new Request('http://localhost:3000/api/game/admin/winner-audit?eventId=evt-test', {
      method: 'GET',
    });
    const res = await winnerAuditGetRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).not.toBe(true);
    expect(data.queue).toBeUndefined();
  });

  it('checks admin auth before ever calling into the queue/signed-URL logic', () => {
    const routeSource = readSource('app/api/game/admin/winner-audit/route.ts');
    const getBody = routeSource.slice(routeSource.indexOf('export async function GET'), routeSource.indexOf('export async function POST'));
    const authIdx = getBody.indexOf('resolveAdminSessionFromRequest');
    const queueIdx = getBody.indexOf('getWinnerAuditQueueDB');
    const signIdx = getBody.indexOf('createSignedUrl');
    expect(authIdx).toBeGreaterThan(-1);
    expect(queueIdx).toBeGreaterThan(-1);
    expect(signIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(queueIdx);
    expect(authIdx).toBeLessThan(signIdx);
  });
});

describe('POST /api/game/admin/winner-audit never resolves a submission without admin auth', () => {
  it('rejects an unauthenticated approve/reject request', async () => {
    const req = new Request('http://localhost:3000/api/game/admin/winner-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: 'sub-1', decision: 'rejected' }),
    });
    const res = await winnerAuditPostRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).not.toBe(true);
    expect(data.submission).toBeUndefined();
  });

  it('checks admin auth before ever calling resolveWinnerAuditSubmissionDB', () => {
    const routeSource = readSource('app/api/game/admin/winner-audit/route.ts');
    const postBody = routeSource.slice(routeSource.indexOf('export async function POST'));
    const authIdx = postBody.indexOf('resolveAdminSessionFromRequest');
    const resolveIdx = postBody.indexOf('resolveWinnerAuditSubmissionDB');
    expect(authIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(resolveIdx);
  });
});
