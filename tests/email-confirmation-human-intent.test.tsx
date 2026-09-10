import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(
    'token_hash=mock-token-human-intent&type=email&next=%2Fprofile',
  ),
}));

vi.stubGlobal('React', React);

import ConfirmEmailPage from '../app/auth/confirm/page';
import {
  GET as confirmGet,
  HEAD as confirmHead,
  POST as confirmPost,
} from '../app/api/auth/confirm/route';
import { getAllPlayers, initializeGameEngine, resetGameEngineStore } from '../lib/game-engine';
import { resetMockAuthStores } from '../lib/supabase-auth';

describe('email confirmation requires explicit human intent', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    resetMockAuthStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the landing page and exact confirmation button without making a verification request', () => {
    const playerCountBeforeRender = getAllPlayers().length;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const html = renderToStaticMarkup(<ConfirmEmailPage />);

    expect(html).toContain('Confirm email address');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getAllPlayers()).toHaveLength(playerCountBeforeRender);
  });

  it('allows repeated GET and HEAD scanner visits before one POST consumes the token', async () => {
    const playerCountBeforeRequests = getAllPlayers().length;
    const href = 'https://www.cantonquests.com/auth/confirm?token_hash=mock-token-human-intent&type=email&next=/profile';

    const firstGet = await confirmGet(new Request(href, { method: 'GET' }));
    const secondGet = await confirmGet(new Request(href, { method: 'GET' }));
    const head = await confirmHead();

    expect(firstGet.status).toBe(307);
    expect(secondGet.status).toBe(307);
    expect(head.status).toBe(204);
    expect(getAllPlayers()).toHaveLength(playerCountBeforeRequests);

    const firstPost = await confirmPost(new Request('http://localhost:3000/api/auth/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash: 'mock-token-human-intent', type: 'email', next: '/profile' }),
    }));
    expect(firstPost.status).toBe(200);
    expect(getAllPlayers()).toHaveLength(playerCountBeforeRequests + 1);

    const reusedPost = await confirmPost(new Request('http://localhost:3000/api/auth/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash: 'mock-token-human-intent', type: 'email', next: '/profile' }),
    }));
    const reusedBody = await reusedPost.json();

    expect(reusedPost.status).toBe(401);
    expect(reusedBody.error).toMatch(/invalid|expired|used|new link/i);
    expect(getAllPlayers()).toHaveLength(playerCountBeforeRequests + 1);
  });
});
