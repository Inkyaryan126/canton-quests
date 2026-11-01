import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestEvent } from '@/lib/types';

const db = vi.hoisted(() => ({ events: [] as QuestEvent[], event: undefined as QuestEvent | undefined }));
vi.mock('@/lib/supabase-db', () => ({
  getEventsDB: async () => db.events,
  getEventBySlugDB: async () => db.event,
  getQuestsForEventDB: async () => [],
  getLeaderboardDB: async () => [],
  getPlayerProgressDB: async () => null,
}));
vi.mock('@/lib/founders-cipher', () => ({ getPlayerCipherProgressDB: async () => null }));
vi.mock('@/lib/supabase-auth', () => ({
  resolveAuthenticatedSession: async () => ({ player: null }), setAuthCookies: () => {},
}));
import { GET as listEvents } from '@/app/api/game/events/route';
import { GET as getEvent } from '@/app/api/game/events/[slug]/route';

const mission = (slug: string, status: QuestEvent['status']) => ({
  id: `event-${slug}`, cityId: 'canton', title: slug, slug, status,
  description: '', basicInstructions: '', createdAt: '2026-01-01T00:00:00Z',
} as QuestEvent);

beforeEach(() => { db.events = []; db.event = undefined; });

describe('unpublished mission visibility', () => {
  it('omits the draft Watchers event from the public list without deleting its record', async () => {
    db.events = [mission('the-watchers', 'draft'), mission('existing-live-mission', 'active'), mission('existing-past-mission', 'ended')];
    const response = await listEvents();
    const body = await response.json();
    expect(body.events.map((event: QuestEvent) => event.slug)).toEqual(['existing-live-mission', 'existing-past-mission']);
    expect(db.events[0].slug).toBe('the-watchers');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('can show Watchers again when its status is changed back to upcoming', async () => {
    db.events = [mission('the-watchers', 'upcoming')];
    expect((await (await listEvents()).json()).events.map((event: QuestEvent) => event.slug)).toEqual(['the-watchers']);
  });
  it('does not expose the draft event through its direct public URL', async () => {
    db.event = mission('the-watchers', 'draft');
    const response = await getEvent(new Request('http://localhost/api/game/events/the-watchers'), { params: { slug: 'the-watchers' } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Event not found' });
  });
});
