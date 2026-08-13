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
  const [candidateQrQuests, setCandidateQrQuests] = useState<PublicQuestView[]>([]);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [result, setResult] = useState<SubmitProofResult | null>(null);
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);
  const [userAccuracyMeters, setUserAccuracyMeters] = useState<number | undefined>(undefined);
  const [isClaiming, setIsClaiming] = useState(false);

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
        const allQuests = eventData.quests || [];
        const match = allQuests.find((q) => q.slug.toUpperCase() === code.toUpperCase() || q.id.toUpperCase() === code.toUpperCase());
        if (match) {
          setQuest(match);
        }
        setCandidateQrQuests(allQuests.filter((q) => q.verificationType === 'qr' && q.status === 'active'));
      })
      .catch(() => {
        if (!cancelled) setQuest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLon(pos.coords.longitude);
        setUserAccuracyMeters(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  const handleInstantClaim = async () => {
    if (!event || !player || isClaiming) return;
    setIsClaiming(true);
    setResult(null);

    const questsToTry = quest?.verificationType === 'qr' ? [quest] : candidateQrQuests;
    let lastResult: SubmitProofResult | null = null;

    for (const qrQuest of questsToTry) {
      const response = await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          questId: qrQuest.id,
          eventId: event.id,
          proofType: 'qr',
          submittedContent: code,
          userLat,
          userLon,
          userAccuracyMeters,
        }),
      });
      const res = (await response.json()) as SubmitProofResult;
      lastResult = res;
      if (res.success) {
        setQuest(qrQuest);
        setResult(res);
        setIsClaiming(false);
        return;
      }
    }

    setResult(
      lastResult || {
        success: false,
        submission: {
          id: 'qr-no-match',
          questId: '',
          playerId: player.id,
          eventId: event.id,
          proofType: 'qr',
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
        message: 'No active QR mission accepted this signal. Check the card, location, and event window.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      }
    );
    setIsClaiming(false);
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

          {quest || candidateQrQuests.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-obsidian/70 rounded-xl border border-gray-800 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">{quest ? 'IDENTIFIED QUEST:' : 'FIELD QR READY:'}</span>
                  {quest && <span className="badge badge-medium">{quest.difficulty}</span>}
                </div>
                <h3 className="text-lg font-bold text-white">{quest ? quest.title : 'Unknown QR Signal'}</h3>
                <p className="text-xs text-gray-300 line-clamp-2">
                  {quest
                    ? quest.description
                    : 'Stay near the official Canton Quests QR card and claim the signal. Location-bound QR missions need GPS permission.'}
                </p>
                <div className="text-amber-400 font-display font-extrabold text-sm pt-1">
                  {quest ? `Value: +${quest.pointValue} XP` : `${candidateQrQuests.length} active QR mission(s) available`}
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
                    disabled={isClaiming}
                    className="btn btn-primary w-full py-3 text-sm font-bold disabled:opacity-60"
                  >
                    {isClaiming ? 'Checking QR signal...' : quest ? `⚡ CLAIM QR QUEST XP (+${quest.pointValue} XP)` : '⚡ CLAIM QR SIGNAL'}
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
