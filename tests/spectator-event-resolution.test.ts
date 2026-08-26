// Canton Quests — Spectator/Admin-Live "default-event" Placeholder Elimination
//
// Regression coverage proving the legacy "default-event" UUID placeholder
// literal can no longer reach a production execution path (a Supabase query
// against a UUID event_id column, or a downstream write action). Covers
// both app/api/game/spectator/route.ts (fixed in an earlier pass) and
// app/api/admin/live/route.ts (this pass), plus the removed default
// parameters in lib/spectator-db.ts.

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetSpectatorStores } from '../lib/spectator-engine';
import { resolveSpectatorEventId } from '../lib/spectator-db';
import { GET as spectatorGET } from '../app/api/game/spectator/route';

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

function adminAuthedRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      'x-admin-key': 'canton-gm-2026',
    },
  });
}

describe('Spectator/admin-live "default-event" placeholder elimination', () => {
  beforeEach(() => {
    resetSpectatorStores();
    delete process.env.ADMIN_SECRET_KEY;
  });

  describe('1. No executable production fallback assigns "default-event"', () => {
    const executableFiles = [
      'app/api/admin/live/route.ts',
      'app/api/game/spectator/route.ts',
      'app/watch/page.tsx',
    ];

    it.each(executableFiles)('%s never assigns the literal placeholder as a runtime fallback', (file) => {
      const source = readFile(file);
      // Matches `|| 'default-event'` / `= 'default-event'` assignment
      // patterns specifically — the class of bug this suite guards against —
      // without flagging prose that merely mentions the string in a comment.
      expect(source).not.toMatch(/\|\|\s*'default-event'/);
      expect(source).not.toMatch(/=\s*'default-event'\s*[,;)]/);
    });

    it('lib/spectator-db.ts no longer has default parameters that fall back to "default-event"', () => {
      const source = readFile('lib/spectator-db.ts');
      expect(source).not.toMatch(/eventId:\s*string\s*=\s*'default-event'/);
      // The two remaining hits are the historical-bug explanation comment —
      // confirm they're inside a /** ... */ doc block, not executable code.
      const executableLines = source
        .split('\n')
        .filter((line) => line.includes('default-event') && !line.trim().startsWith('*') && !line.trim().startsWith('//'));
      expect(executableLines).toHaveLength(0);
    });

    it('lib/spectator-engine.ts functions still defaulting eventId to "default-event" are pure in-memory (no Supabase/DB call in their bodies)', () => {
      const source = readFile('lib/spectator-engine.ts');
      for (const fnName of ['getDistrictActivity', 'getSpectatorSessionCount', 'seedDefaultSpectatorData', 'processAudienceLifecycleCron']) {
        const start = source.indexOf(`function ${fnName}(`);
        expect(start).toBeGreaterThan(-1);
        // Slice to the next top-level export/function boundary (a generous
        // window covers each of these short functions' full bodies).
        const body = source.slice(start, start + 1500);
        expect(body).not.toContain('supabaseModule');
        expect(body).not.toContain('.from(');
      }
    });
  });

  describe('2. Missing event input resolves via the canonical canton-weekend-1 slug', () => {
    it('resolveSpectatorEventId never returns the literal placeholder for any non-UUID input', async () => {
      for (const input of [null, undefined, '', 'default-event', 'not-a-uuid']) {
        const resolved = await resolveSpectatorEventId(input as any);
        expect(resolved).not.toBe('default-event');
      }
    });
  });

  describe('3. Failed event resolution never sends a placeholder into UUID queries (admin/live)', () => {
    it('GET /api/admin/live returns a safe empty read when no event can be resolved, never a fabricated id', async () => {
      vi.resetModules();
      vi.doMock('../lib/spectator-db', async () => {
        const actual = await vi.importActual<typeof import('../lib/spectator-db')>('../lib/spectator-db');
        return { ...actual, resolveSpectatorEventId: async () => null };
      });

      const { GET } = await import('../app/api/admin/live/route');
      const req = adminAuthedRequest('http://localhost:3000/api/admin/live');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.activeEvent).toBeNull();
      expect(data.activeOptions).toEqual([]);
      expect(data.upcomingEvents).toEqual([]);

      vi.doUnmock('../lib/spectator-db');
      vi.resetModules();
    });

    it('POST /api/admin/live returns a clear validation error and does not continue when no event can be resolved', async () => {
      vi.resetModules();
      vi.doMock('../lib/spectator-db', async () => {
        const actual = await vi.importActual<typeof import('../lib/spectator-db')>('../lib/spectator-db');
        return { ...actual, resolveSpectatorEventId: async () => null };
      });

      const { POST } = await import('../app/api/admin/live/route');
      const req = adminAuthedRequest('http://localhost:3000/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_pause', isPaused: true }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/no event could be resolved/i);

      vi.doUnmock('../lib/spectator-db');
      vi.resetModules();
    });
  });

  describe('4. Public spectator GET empty state remains successful', () => {
    it('GET /api/game/spectator (feed) with no resolvable event still succeeds with an empty feed', async () => {
      const req = new Request('http://localhost:3000/api/game/spectator?action=feed');
      const res = await spectatorGET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.feed)).toBe(true);
    });
  });
});
