import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/grid/enter/route';

describe('legacy Canton Quests to THE GRID entry', () => {
  it('redirects old bookmarks to the independent GRID domain', async () => {
    const response = await GET();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://dominatethegrid.com/');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('does not expose authentication credentials in the redirect', async () => {
    const response = await GET();
    expect(response.headers.get('location')).not.toContain('access_token');
    expect(response.headers.get('location')).not.toContain('refresh_token');
  });
});
