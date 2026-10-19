import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  resolveAuthenticatedSession: vi.fn(),
  extractAuthTokens: vi.fn(),
  setAuthCookies: vi.fn(),
}));
vi.mock('../lib/supabase-auth', () => auth);
import { GET } from '../app/api/grid/enter/route';

beforeEach(() => {
  vi.clearAllMocks();
  auth.extractAuthTokens.mockReturnValue({ accessToken: 'existing-access', refreshToken: 'existing-refresh' });
});

describe('safe Canton Quests to Grid handoff', () => {
  it('passes authenticated browser credentials via HttpOnly cookies, never a URL', async () => {
    auth.resolveAuthenticatedSession.mockResolvedValue({
      user: { id: 'user-1' }, player: { id: 'player-1' },
    });
    const response = await GET(new Request('https://www.cantonquests.com/api/grid/enter'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://grid.cantonquests.com/grid');
    expect(response.headers.get('location')).not.toContain('access');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(auth.setAuthCookies).toHaveBeenCalledWith(response, {
      access_token: 'existing-access', refresh_token: 'existing-refresh',
    }, 'player-1');
  });

  it('uses rotated tokens returned by the verified session rather than expired originals', async () => {
    auth.resolveAuthenticatedSession.mockResolvedValue({
      user: { id: 'user-1' }, player: { id: 'player-1' },
      refreshedSession: { access_token: 'rotated-access', refresh_token: 'rotated-refresh' },
    });
    await GET(new Request('https://www.cantonquests.com/api/grid/enter'));
    expect(auth.setAuthCookies).toHaveBeenCalledWith(expect.anything(), {
      access_token: 'rotated-access', refresh_token: 'rotated-refresh',
    }, 'player-1');
  });

  it('cannot mint a session for an unrecognized guest and does not expose credentials', async () => {
    auth.resolveAuthenticatedSession.mockResolvedValue({ user: null, player: null });
    const response = await GET(new Request('https://www.cantonquests.com/api/grid/enter?next=https://attacker.invalid'));
    expect(response.headers.get('location')).toBe('https://grid.cantonquests.com/grid');
    expect(auth.setAuthCookies).not.toHaveBeenCalled();
  });
});
