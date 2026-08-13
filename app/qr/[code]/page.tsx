'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { QuestEvent, Player, SubmitProofResult, PublicQuestView } from '@/lib/types';

function getClientPlayer(): Player {
  const stored = window.localStorage.getItem('canton_quests_current_player');
  if (stored) {
    return JSON.parse(stored) as Player;
  }

  const newPlayer: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem('canton_quests_current_player', JSON.stringify(newPlayer));
  return newPlayer;
}

export default function QrGatewayPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [quest, setQuest] = useState<PublicQuestView | null>(null);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [result, setResult] = useState<SubmitProofResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const p = getClientPlayer();
    setPlayer(p);

    fetch('/api/game/events')
      .then((res) => res.json())
      .then((eventsData: { events?: QuestEvent[] }) => {
        if (cancelled) return;
        const activeEvent = eventsData.events?.find((item) => item.status === 'active') || eventsData.events?.[0];
        if (!activeEvent) return;

        setEvent(activeEvent);
        return fetch(`/api/game/events/${activeEvent.slug}?playerId=${encodeURIComponent(p.id)}`);
      })
      .then((res) => res?.json())
      .then((eventData: { quests?: PublicQuestView[] } | undefined) => {
        if (cancelled || !eventData) return;
        const match = (eventData.quests || []).find((q) => q.slug.toUpperCase() === code.toUpperCase());
        if (match) {
          setQuest(match);
        }
      })
      .catch(() => {
        if (!cancelled) setQuest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleInstantClaim = async () => {
    if (!quest || !event || !player) return;

    const response = await fetch('/api/game/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerId: player.id,
        questId: quest.id,
        eventId: event.id,
        proofType: 'qr',
        submittedContent: code,
      }),
    });
    const res = (await response.json()) as SubmitProofResult;
    setResult(res);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center items-center">
        <div className="glass-panel p-8 w-full border-cyan-500/40 glow-cyan text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-cyan-500/20">
            📱
          </div>

          <span className="badge badge-medium bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono">
            CANTON QR SIGNAL DETECTED
          </span>

          <h1 className="text-2xl font-extrabold text-white">
            Passcode Token: <span className="text-cyan-400 font-mono">{code}</span>
          </h1>

          {quest ? (
            <div className="space-y-4">
              <div className="p-4 bg-obsidian/70 rounded-xl border border-gray-800 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">IDENTIFIED QUEST:</span>
                  <span className="badge badge-medium">{quest.difficulty}</span>
                </div>
                <h3 className="text-lg font-bold text-white">{quest.title}</h3>
                <p className="text-xs text-gray-300 line-clamp-2">{quest.description}</p>
                <div className="text-amber-400 font-display font-extrabold text-sm pt-1">
                  Value: +{quest.pointValue} XP
                </div>
              </div>

              {result ? (
                <div className={`p-4 rounded-xl text-sm font-mono ${result.success ? 'bg-emerald-950/40 border border-emerald-500 text-emerald-300' : 'bg-red-950/40 border border-red-500 text-red-300'}`}>
                  {result.success ? '🎉 ' : '⚠️ '} {result.message}
                  {result.awardedPoints > 0 && (
                    <div className="font-extrabold text-amber-400 mt-1">
                      +{result.awardedPoints} XP added to your score!
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-2">
                {!result?.success && (
                  <button
                    onClick={handleInstantClaim}
                    className="btn btn-primary w-full py-3 text-sm font-bold"
                  >
                    ⚡ CLAIM QR QUEST XP (+{quest.pointValue} XP)
                  </button>
                )}

                {event && (
                  <Link
                    href={`/events/${event.slug}`}
                    className="btn btn-secondary w-full py-2.5 text-xs font-mono"
                  >
                    Return to Quest →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-300 font-mono">
                No active quest found matching QR token &quot;{code}&quot;.
              </p>
              <Link href="/" className="btn btn-secondary text-xs">
                Return to Canton Hub
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
