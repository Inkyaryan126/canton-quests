'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import { showGameMoment } from '@/lib/game-effects';
import { SafePlayerLinkProfile, PlayerLinkType, PLAYER_LINK_CONFIG } from '@/lib/player-links';
import { Player } from '@/lib/types';

function getClientPlayer(): Player | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('canton_quests_current_player');
  return stored ? (JSON.parse(stored) as Player) : null;
}

const SECTOR_LABEL: Record<string, string> = { family: 'Arts District', challenge: 'Mother Goose Land', secret: 'Monument Park' };

/**
 * The safe player QR/link landing page — a player scans another player's
 * personal link QR (their own /link/[their id] URL) and lands here to
 * confirm establishing a Player Link. Only ever shows the target's safe
 * public profile (id/displayName/path) — never email, never exact GPS.
 */
export default function PlayerLinkPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const targetPlayerId = params.playerId as string;
  const eventSlug = searchParams.get('eventSlug') || 'canton-weekend-1';

  const [me, setMe] = useState<Player | null>(null);
  const [target, setTarget] = useState<SafePlayerLinkProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'linking' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    setMe(getClientPlayer());
    fetch(`/api/game/player-links?eventSlug=${encodeURIComponent(eventSlug)}&lookupPlayerId=${encodeURIComponent(targetPlayerId)}`)
      .then((res) => res.json())
      .then((data: { lookupProfile?: SafePlayerLinkProfile }) => {
        if (data.lookupProfile) {
          setTarget(data.lookupProfile);
          setStatus('ready');
        } else {
          setStatus('error');
          setMessage('This player signal could not be found.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the field network.');
      });
  }, [eventSlug, targetPlayerId]);

  const linkType: PlayerLinkType = me && target && me.selectedStartingPath && target.path && me.selectedStartingPath !== target.path ? 'DIFFERENT_PATH_LINK' : 'PLAYER_LINK';

  const handleLink = () => {
    if (!me) {
      setStatus('error');
      setMessage('Create your player identity first to establish a link.');
      return;
    }
    setStatus('linking');
    fetch('/api/game/player-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSlug, linkType, targetPlayerId }),
    })
      .then((res) => res.json())
      .then((data: { success: boolean; error?: string; newlyRewarded?: boolean; xpAwarded?: number; transmission?: any }) => {
        if (!data.success) {
          setStatus('error');
          setMessage(data.error || 'Could not establish this link.');
          return;
        }
        setStatus('done');
        setMessage(data.newlyRewarded ? `Link confirmed — +${data.xpAwarded} XP.` : 'Link confirmed. (Already earned for this pair.)');
        if (data.transmission) {
          showGameMoment({ type: 'commander-transmission', trigger: 'player_link', transmission: data.transmission });
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the field network.');
      });
  };

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={`/events/${eventSlug}`} context="global" />
      <main className="cq-page-main">
        <section className="cq-page-section" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="p-6 sm:p-8 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-4 shadow-xl">
            <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-cyan-400">FIELD LINK</span>

            {status === 'loading' && <p className="text-stone-400 text-sm">Reading signal...</p>}

            {status !== 'loading' && target && (
              <>
                <h1 className="text-2xl font-black font-display text-white">{target.displayName}</h1>
                {target.path && <p className="text-xs text-stone-400 uppercase font-mono">{SECTOR_LABEL[target.path] || target.path}</p>}
                <p className="text-sm text-stone-300">
                  {linkType === 'DIFFERENT_PATH_LINK'
                    ? 'A cross-path signal — you two started on different paths.'
                    : 'Confirm this field link to record the connection.'}
                </p>

                {(status === 'ready' || status === 'linking') && (
                  <button type="button" onClick={handleLink} disabled={status === 'linking'} className="btn btn-primary w-full">
                    {status === 'linking' ? 'LINKING...' : `ESTABLISH LINK (+${PLAYER_LINK_CONFIG[linkType].xpAwarded} XP)`}
                  </button>
                )}
              </>
            )}

            {message && (
              <div className={`p-3 rounded-xl text-xs font-bold ${status === 'error' ? 'bg-amber-950/60 border border-amber-500 text-amber-300' : 'bg-emerald-950/60 border border-emerald-500 text-emerald-300'}`}>
                {message}
              </div>
            )}

            <Link href={`/events/${eventSlug}`} className="text-xs text-stone-500 underline block">
              Back to Mission
            </Link>
          </div>
        </section>
      </main>
      <CinematicFooter />
    </div>
  );
}
