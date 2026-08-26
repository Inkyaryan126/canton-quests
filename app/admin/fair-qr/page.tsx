'use client';

import { Fragment, useEffect, useState } from 'react';
import CinematicNav from '@/components/CinematicNav';

type DeploymentStatus = 'placement_tbd' | 'ready_to_print' | 'placed' | 'disabled';

interface PlacementDetails {
  description?: string;
  setupNotes?: string;
  retrievalNotes?: string;
}

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
  placementDetails?: PlacementDetails | null;
  placedAt?: string | null;
  deploymentStatus: DeploymentStatus;
  uniqueClaimCount: number;
  lastClaimedAt?: string | null;
}

interface LeaderboardRow {
  rank: number;
  playerId: string;
  displayName: string;
  totalPoints: number;
  questsCompletedCount: number;
}

const DEPLOYMENT_BADGE: Record<DeploymentStatus, { label: string; className: string }> = {
  placement_tbd: { label: 'PLACEMENT TBD', className: 'bg-stone-800 text-stone-400 border-stone-700' },
  ready_to_print: { label: 'READY TO PRINT', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
  placed: { label: 'PLACED', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  disabled: { label: 'DISABLED', className: 'bg-red-500/15 text-red-300 border-red-500/40' },
};

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const DEPLOYMENT_SAFETY_REMINDERS = [
  'Do not obstruct signage, walkways, or emergency/safety equipment.',
  'Do not place on or near emergency/safety equipment of any kind.',
  'Avoid damaging surfaces — no nails/screws/permanent adhesive on property that is not ours.',
  'Do not move or relocate someone else’s property to make room for a card.',
  'Weather-protect the physical card (lamination/sleeve) — Fair week can be wet.',
  'Retrieve/remove every card after the Fair ends (Sept 7) — nothing stays behind.',
];

export default function FairQrAdminPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [authError, setAuthError] = useState('');
  const [quests, setQuests] = useState<AdminQuestRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

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

  const runAction = async (questId: string, payload: Record<string, unknown>) => {
    setBusyQuestId(questId);
    setActionError('');
    try {
      const res = await fetch('/api/admin/fair-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId, ...payload }),
      });
      const data = await res.json();
      if (data.success && data.quest) {
        setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, ...data.quest } : q)));
      } else {
        setActionError(data.error || 'Update failed.');
      }
    } catch {
      setActionError('Update failed — network error.');
    } finally {
      setBusyQuestId(null);
    }
  };

  const toggleStatus = (quest: AdminQuestRow) =>
    runAction(quest.id, { action: 'set_status', status: quest.status === 'active' ? 'inactive' : 'active' });

  const core = quests.filter((q) => q.category === 'fair_core');
  const bonus = quests.filter((q) => q.category === 'fair_bonus');
  const readyCount = quests.filter((q) => q.deploymentStatus !== 'placement_tbd').length;

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
                {actionError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs font-mono text-red-300">{actionError}</div>
                )}

                <div className="text-xs font-mono text-gray-400">
                  Deployment progress: <span className="text-white font-bold">{readyCount}</span> / {quests.length} Signals have a
                  real placement note or are already placed.
                </div>

                <QuestTable
                  title="Core Signals (20)"
                  rows={core}
                  onToggleStatus={toggleStatus}
                  onRunAction={runAction}
                  busyQuestId={busyQuestId}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                />
                <QuestTable
                  title="Daily Bonus Signals (7)"
                  rows={bonus}
                  onToggleStatus={toggleStatus}
                  onRunAction={runAction}
                  busyQuestId={busyQuestId}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  showWindow
                />

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

                <section className="glass-panel p-5 border-amber-500/30 space-y-2">
                  <h2 className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">Physical Deployment Safety — Internal Only</h2>
                  <ul className="text-xs font-mono text-gray-300 space-y-1 list-disc list-inside">
                    {DEPLOYMENT_SAFETY_REMINDERS.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
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
  onToggleStatus,
  onRunAction,
  busyQuestId,
  expandedId,
  setExpandedId,
  showWindow,
}: {
  title: string;
  rows: AdminQuestRow[];
  onToggleStatus: (quest: AdminQuestRow) => void;
  onRunAction: (questId: string, payload: Record<string, unknown>) => Promise<void>;
  busyQuestId: string | null;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
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
              <th className="py-2 pr-3">Deployment</th>
              <th className="py-2 pr-3">Claims</th>
              <th className="py-2 pr-3">Last Claim</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const badge = DEPLOYMENT_BADGE[q.deploymentStatus];
              const isExpanded = expandedId === q.id;
              return (
                <Fragment key={q.id}>
                  <tr className="border-b border-stone-900 text-white">
                    <td className="py-2 pr-3">{q.title}</td>
                    <td className="py-2 pr-3 text-cyan-300">{q.targetCode}</td>
                    <td className="py-2 pr-3">{q.pointValue}</td>
                    {showWindow && (
                      <td className="py-2 pr-3 text-[10px] text-gray-400">
                        {q.startsAt?.slice(0, 16).replace('T', ' ')} → {q.expiresAt?.slice(0, 16).replace('T', ' ')}
                      </td>
                    )}
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="py-2 pr-3">{q.uniqueClaimCount}</td>
                    <td className="py-2 pr-3 text-[10px] text-gray-400">{formatTime(q.lastClaimedAt)}</td>
                    <td className="py-2 pr-3">
                      <span className={q.status === 'active' ? 'text-emerald-400' : 'text-stone-500'}>{q.status}</span>
                    </td>
                    <td className="py-2 pr-3 space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : q.id)}
                        className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-bold"
                      >
                        {isExpanded ? 'CLOSE' : 'PLACEMENT'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(q)}
                        disabled={busyQuestId === q.id}
                        className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-bold disabled:opacity-50"
                      >
                        {q.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-stone-900 bg-stone-950/60">
                      <td colSpan={showWindow ? 9 : 8} className="py-3 px-3">
                        <PlacementEditor quest={q} busy={busyQuestId === q.id} onRunAction={onRunAction} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlacementEditor({
  quest,
  busy,
  onRunAction,
}: {
  quest: AdminQuestRow;
  busy: boolean;
  onRunAction: (questId: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [gmNotes, setGmNotes] = useState(quest.gmNotes || '');
  const [description, setDescription] = useState(quest.placementDetails?.description || '');
  const [setupNotes, setSetupNotes] = useState(quest.placementDetails?.setupNotes || '');
  const [retrievalNotes, setRetrievalNotes] = useState(quest.placementDetails?.retrievalNotes || '');

  const save = () =>
    onRunAction(quest.id, {
      action: 'update_placement',
      gmNotes,
      placementDetails: { description, setupNotes, retrievalNotes },
    });

  return (
    <div className="space-y-3 max-w-2xl">
      <label className="block">
        <span className="block text-[10px] text-gray-400 uppercase mb-1">Internal Placement Note (short)</span>
        <input
          value={gmNotes}
          onChange={(e) => setGmNotes(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-white text-xs"
          placeholder="e.g. Funnel cake stand, north post, eye level"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] text-gray-400 uppercase mb-1">Precise Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-white text-xs"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] text-gray-400 uppercase mb-1">Setup Notes (optional)</span>
        <textarea
          value={setupNotes}
          onChange={(e) => setSetupNotes(e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-white text-xs"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] text-gray-400 uppercase mb-1">Retrieval / Removal Notes (optional)</span>
        <textarea
          value={retrievalNotes}
          onChange={(e) => setRetrievalNotes(e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-white text-xs"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold disabled:opacity-50"
        >
          SAVE PLACEMENT NOTES
        </button>
        {quest.placedAt ? (
          <button
            type="button"
            onClick={() => onRunAction(quest.id, { action: 'mark_unplaced' })}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-bold disabled:opacity-50"
          >
            MARK UNPLACED
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRunAction(quest.id, { action: 'mark_placed' })}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold disabled:opacity-50"
          >
            MARK PHYSICALLY PLACED
          </button>
        )}
        {quest.placedAt && <span className="text-[10px] text-gray-500">Placed {formatTime(quest.placedAt)}</span>}
      </div>
    </div>
  );
}
