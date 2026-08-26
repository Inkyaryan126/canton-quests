'use client';

import { useEffect, useState } from 'react';
import CinematicNav from '@/components/CinematicNav';

interface AdminQuestRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  pointValue: number;
  targetCode?: string;
  status: 'active' | 'inactive' | 'draft';
  startsAt?: string;
  expiresAt?: string;
  gmNotes?: string;
  uniqueClaimCount: number;
}

interface LeaderboardRow {
  rank: number;
  playerId: string;
  displayName: string;
  totalPoints: number;
  questsCompletedCount: number;
}

export default function FairQrAdminPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [authError, setAuthError] = useState('');
  const [quests, setQuests] = useState<AdminQuestRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fair-qr');
      const data = await res.json();
      if (data.success) {
        setQuests(data.quests);
        setLeaderboard(data.leaderboard);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(Boolean(data.isAdmin));
        if (data.isAdmin) loadData();
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    const data = await res.json();
    if (data.isAdmin) {
      setIsAdmin(true);
      loadData();
    } else {
      setAuthError(data.error || 'Invalid Game Master passphrase.');
    }
  };

  const toggleStatus = async (quest: AdminQuestRow) => {
    setBusyQuestId(quest.id);
    try {
      const nextStatus = quest.status === 'active' ? 'inactive' : 'active';
      const res = await fetch('/api/admin/fair-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, status: nextStatus } : q)));
      }
    } finally {
      setBusyQuestId(null);
    }
  };

  const core = quests.filter((q) => q.category === 'fair_core');
  const bonus = quests.filter((q) => q.category === 'fair_bonus');

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <CinematicNav eventHref="/events/fair-qr-hunt" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Fair QR Hunt — Commander Console</h1>

        {checkingAuth ? (
          <p className="text-sm font-mono text-gray-400">Checking authorization...</p>
        ) : !isAdmin ? (
          <form onSubmit={handleLogin} className="glass-panel p-6 max-w-sm space-y-3">
            <label className="block text-xs font-mono text-gray-400">Game Master Passphrase</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 text-white font-mono text-sm"
            />
            {authError && <p className="text-xs text-red-400">{authError}</p>}
            <button type="submit" className="btn btn-primary w-full py-2.5 text-sm font-bold">
              ACCESS CONSOLE
            </button>
          </form>
        ) : (
          <>
            {loading ? (
              <p className="text-sm font-mono text-gray-400">Loading Fair QR records...</p>
            ) : (
              <>
                <QuestTable title="Core QRs (20)" rows={core} onToggle={toggleStatus} busyQuestId={busyQuestId} />
                <QuestTable title="Daily Bonus QRs (7)" rows={bonus} onToggle={toggleStatus} busyQuestId={busyQuestId} showWindow />

                <section className="space-y-3">
                  <h2 className="text-lg font-extrabold text-white">Fair Leaderboard</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-stone-800">
                          <th className="py-2 pr-4">Rank</th>
                          <th className="py-2 pr-4">Player</th>
                          <th className="py-2 pr-4">Score</th>
                          <th className="py-2 pr-4">Signals Found</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row) => (
                          <tr key={row.playerId} className={`border-b border-stone-900 ${row.rank === 1 ? 'text-amber-300' : 'text-white'}`}>
                            <td className="py-2 pr-4">#{row.rank}</td>
                            <td className="py-2 pr-4">{row.displayName}</td>
                            <td className="py-2 pr-4">{row.totalPoints}</td>
                            <td className="py-2 pr-4">{row.questsCompletedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {leaderboard.length === 0 && <p className="text-xs text-gray-500 mt-2">No Fair scores yet.</p>}
                    {leaderboard.length > 0 && (
                      <p className="text-xs text-gray-500 mt-3">
                        Current #1 Fair player: <strong className="text-amber-300">{leaderboard[0].displayName}</strong> —
                        the Fair prize winner unless business rules say otherwise (no automatic payment or drawing logic runs here).
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function QuestTable({
  title,
  rows,
  onToggle,
  busyQuestId,
  showWindow,
}: {
  title: string;
  rows: AdminQuestRow[];
  onToggle: (quest: AdminQuestRow) => void;
  busyQuestId: string | null;
  showWindow?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-white">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left text-gray-400 border-b border-stone-800">
              <th className="py-2 pr-3">Label</th>
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Points</th>
              {showWindow && <th className="py-2 pr-3">Window (UTC)</th>}
              <th className="py-2 pr-3">Placement Note</th>
              <th className="py-2 pr-3">Claims</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="border-b border-stone-900 text-white">
                <td className="py-2 pr-3">{q.title}</td>
                <td className="py-2 pr-3 text-cyan-300">{q.targetCode}</td>
                <td className="py-2 pr-3">{q.pointValue}</td>
                {showWindow && (
                  <td className="py-2 pr-3 text-[10px] text-gray-400">
                    {q.startsAt?.slice(0, 16).replace('T', ' ')} → {q.expiresAt?.slice(0, 16).replace('T', ' ')}
                  </td>
                )}
                <td className="py-2 pr-3 text-gray-400">{q.gmNotes || '—'}</td>
                <td className="py-2 pr-3">{q.uniqueClaimCount}</td>
                <td className="py-2 pr-3">
                  <span className={q.status === 'active' ? 'text-emerald-400' : 'text-stone-500'}>{q.status}</span>
                </td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => onToggle(q)}
                    disabled={busyQuestId === q.id}
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-bold disabled:opacity-50"
                  >
                    {q.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
