'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { QuestEvent, Quest } from '@/lib/types';
import { getEvents, getQuestsForEvent } from '@/lib/game-engine';

export default function EventPreviewModePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [simulatedCompletedIds, setSimulatedCompletedIds] = useState<string[]>([]);
  const [simulatedXp, setSimulatedXp] = useState<number>(0);

  useEffect(() => {
    const events = getEvents();
    const target = events.find((e) => e.id === eventId || e.slug === eventId);
    if (target) {
      setEvent(target);
      setQuests(getQuestsForEvent(target.id));
    }
  }, [eventId]);

  const handleSimulateSolve = (quest: Quest) => {
    if (simulatedCompletedIds.includes(quest.id)) return;
    setSimulatedCompletedIds([...simulatedCompletedIds, quest.id]);
    setSimulatedXp(simulatedXp + quest.pointValue);
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex items-center justify-center font-mono">
        Loading Sandbox Preview...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Sandboxed Banner */}
        <div className="p-4 bg-purple-950/80 border-2 border-purple-500 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧪</span>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-widest">
                SANDBOXED EVENT PREVIEW MODE
              </span>
              <h1 className="text-lg font-extrabold text-white">{event.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">Simulated XP: {simulatedXp} XP</span>
            <Link href="/admin" className="btn btn-secondary text-xs py-1.5 px-3">
              Exit Preview →
            </Link>
          </div>
        </div>

        {/* Quests Preview Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase">Simulated Quests ({quests.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.map((q) => {
              const isSolved = simulatedCompletedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2 ${
                    isSolved
                      ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-obsidian border-gray-800 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{q.title}</span>
                    <span className="text-amber-400 font-bold">+{q.pointValue} XP</span>
                  </div>
                  <div className="text-gray-300 text-[11px]">{q.instructions}</div>
                  <button
                    onClick={() => handleSimulateSolve(q)}
                    disabled={isSolved}
                    className={`btn text-xs py-1.5 px-3 font-bold w-full ${
                      isSolved ? 'bg-emerald-900 text-emerald-300 cursor-default' : 'btn-primary'
                    }`}
                  >
                    {isSolved ? '✓ Simulated Completion' : '🧪 Simulate Solve'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
