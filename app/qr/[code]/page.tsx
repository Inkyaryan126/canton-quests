'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Quest, QuestEvent, Player, SubmitProofResult, GeneratedQR } from '@/lib/types';
import {
  getEvents,
  getQuestsForEvent,
  getCurrentPlayer,
  submitQuestProof,
  resolveQRToken,
} from '@/lib/game-engine';

export default function QrGatewayPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  const [quest, setQuest] = useState<Quest | null>(null);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [result, setResult] = useState<SubmitProofResult | null>(null);
  const [generatedQR, setGeneratedQR] = useState<GeneratedQR | null>(null);

  useEffect(() => {
    const events = getEvents();
    const activeEvent = events.find((e) => e.status === 'active') || events[0];
    if (!activeEvent) return;

    setEvent(activeEvent);
    const quests = getQuestsForEvent(activeEvent.id);

    // 1. Check generated QR tokens
    const gen = resolveQRToken(code);
    if (gen) {
      setGeneratedQR(gen);
      const targetQuest = quests.find((q) => q.id === gen.targetId || q.slug === gen.targetId);
      if (targetQuest) {
        setQuest(targetQuest);
      }
    } else {
      // 2. Direct quest code match
      const match = quests.find(
        (q) =>
          (q.targetCode && q.targetCode.toUpperCase() === code.toUpperCase()) ||
          q.slug.toUpperCase() === code.toUpperCase()
      );
      if (match) {
        setQuest(match);
      }
    }

    const p = getCurrentPlayer();
    setPlayer(p);
  }, [code]);

  const handleInstantClaim = () => {
    if (!quest || !event || !player) return;

    const res = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: event.id,
      proofType: 'qr',
      submittedContent: code,
    });
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

          {generatedQR && (
            <div className="text-xs text-amber-400 font-mono">
              Label: <span className="text-white font-bold">{generatedQR.label}</span>
            </div>
          )}

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
                    Return to Event Hub →
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
