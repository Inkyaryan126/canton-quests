'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, CheckCircle2, Trophy, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import PageHeader from '@/components/PageHeader';
import PlayerAvatar from '@/components/PlayerAvatar';
import { computeFairDashboardProgress, FairOperationPhase, MAX_FAIR_SCORE } from '@/lib/fair-hunt';
import { LeaderboardEntry, PublicQuestView, QuestEvent } from '@/lib/types';

interface DashboardData {
  event: QuestEvent;
  phase: FairOperationPhase;
  todayDateKey: string;
  quests: PublicQuestView[];
  leaderboardPreview: LeaderboardEntry[];
  leaderboardSize: number;
  isAuthenticated: boolean;
  player?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    profileImageCropZoom?: number;
    profileImageCropX?: number;
    profileImageCropY?: number;
  };
  claimedQuestIds?: string[];
  rank?: number | null;
}

function fairQuestDateKey(quest: PublicQuestView): string | null {
  const match = quest.slug.match(/^fair-bonus-(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

export default function FairQrHuntDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fair/dashboard')
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setData(payload);
      })
      .finally(() => setLoading(false));
  }, []);

  const nextParam = encodeURIComponent('/events/fair-qr-hunt');

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <CinematicNav eventHref="/events/fair-qr-hunt" context="fair-operation" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        <PageHeader
          eyebrow="MISSION: FAIR QR HUNT"
          title="CANTON QUESTS: FAIR QR HUNT"
          body="A path-free QR scavenger hunt across the fairgrounds — 20 permanent Signals plus one daily bonus Signal each day, Sept 4–5. $100 prize on the line."
          accent="cyan"
          divider
        />

        {loading ? (
          <div className="text-center text-sm font-mono text-cyan-300 py-12">Loading Fair Hunt status...</div>
        ) : !data ? (
          <div className="text-center text-sm font-mono text-red-300 py-12">Fair QR Hunt is unavailable right now.</div>
        ) : (
          <>
            {data.phase === 'pre_launch' && (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-5 text-sm font-mono text-cyan-200">
                MISSION UPCOMING — the Fair QR Hunt opens September 4, 2026 and runs through September 5.
              </div>
            )}
            {data.phase === 'ended' && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 text-sm font-mono text-amber-200">
                MISSION COMPLETE — the Fair QR Hunt has ended. Final standings remain viewable below.
              </div>
            )}

            <ScoreStructure />

            {!data.isAuthenticated ? (
              <div className="glass-panel p-8 text-center space-y-4 border-cyan-500/40">
                <h2 className="text-xl font-extrabold text-white">Enter the Fair QR Hunt</h2>
                <p className="text-sm text-gray-300">Create your permanent Player Identity — no starting path required — to track your Fair progress.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href={`/register?next=${nextParam}`} className="btn btn-primary py-3 px-6 text-sm font-bold">
                    CREATE PLAYER IDENTITY
                  </Link>
                  <Link href={`/login?next=${nextParam}`} className="btn btn-secondary py-3 px-6 text-sm font-mono">
                    ACCESS COMMAND CENTER
                  </Link>
                </div>
              </div>
            ) : (
              <PlayerStatusPanel data={data} />
            )}

            <CoreHuntGrid quests={data.quests} claimedQuestIds={data.claimedQuestIds || []} />

            <DailyBonusArea quests={data.quests} claimedQuestIds={data.claimedQuestIds || []} todayDateKey={data.todayDateKey} />

            <LeaderboardPreview entries={data.leaderboardPreview} total={data.leaderboardSize} />
          </>
        )}
      </main>

      <CinematicFooter />
    </div>
  );
}

function ScoreStructure() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center font-mono text-xs">
      <div className="glass-panel p-4 border-cyan-500/30">
        <div className="text-2xl font-black text-white">20 × 100</div>
        <div className="text-gray-400 mt-1">Core Signals — 2,000 pts max</div>
      </div>
      <div className="glass-panel p-4 border-amber-500/30">
        <div className="text-2xl font-black text-white">7 × 300</div>
        <div className="text-gray-400 mt-1">Daily Bonus Signals — 2,100 pts max</div>
      </div>
      <div className="glass-panel p-4 border-emerald-500/30">
        <div className="text-2xl font-black text-white">{MAX_FAIR_SCORE.toLocaleString()}</div>
        <div className="text-gray-400 mt-1">Maximum Possible Fair Score</div>
      </div>
    </div>
  );
}

function PlayerStatusPanel({ data }: { data: DashboardData }) {
  const claimed = new Set(data.claimedQuestIds || []);
  const progress = computeFairDashboardProgress(data.quests, claimed);

  return (
    <div className="glass-panel p-6 border-cyan-500/40 flex flex-col sm:flex-row items-center gap-6">
      <PlayerAvatar
        avatarUrl={data.player?.avatarUrl}
        cropZoom={data.player?.profileImageCropZoom}
        cropX={data.player?.profileImageCropX}
        cropY={data.player?.profileImageCropY}
        size={56}
        fallback="⚡"
        ariaLabel={`${data.player?.displayName} avatar`}
      />
      <div className="flex-1 text-center sm:text-left">
        <h3 className="text-lg font-extrabold text-white">{data.player?.displayName}</h3>
        <p className="text-xs font-mono text-gray-400">
          Fair Rank: {data.rank ? `#${data.rank}` : 'Unranked'} · {progress.totalScore} pts
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center font-mono">
        <div>
          <div className="text-xl font-black text-white">
            {progress.coreFoundCount}/{progress.coreTotalCount}
          </div>
          <div className="text-[10px] text-gray-400 uppercase">Core Found</div>
        </div>
        <div>
          <div className="text-xl font-black text-white">
            {progress.bonusFoundCount}/{progress.bonusTotalCount}
          </div>
          <div className="text-[10px] text-gray-400 uppercase">Bonuses Found</div>
        </div>
        <div>
          <div className="text-xl font-black text-white">{progress.totalFoundCount}</div>
          <div className="text-[10px] text-gray-400 uppercase">Total Secured</div>
        </div>
      </div>
    </div>
  );
}

function CoreHuntGrid({ quests, claimedQuestIds }: { quests: PublicQuestView[]; claimedQuestIds: string[] }) {
  const claimed = new Set(claimedQuestIds);
  const core = quests.filter((q) => q.category === 'fair_core').sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap size={18} className="text-cyan-400" />
        <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Core Hunt Progress</h2>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {core.map((quest) => {
          const found = claimed.has(quest.id);
          return (
            <div
              key={quest.id}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[10px] ${
                found ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-stone-900/60 border-stone-700 text-stone-500'
              }`}
              title={quest.title}
            >
              {found ? <CheckCircle2 size={16} /> : <Lock size={16} />}
              <span>{quest.title}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DailyBonusArea({
  quests,
  claimedQuestIds,
  todayDateKey,
}: {
  quests: PublicQuestView[];
  claimedQuestIds: string[];
  todayDateKey: string;
}) {
  const claimed = new Set(claimedQuestIds);
  const bonuses = quests
    .filter((q) => q.category === 'fair_bonus')
    .map((q) => ({ quest: q, dateKey: fairQuestDateKey(q) }))
    .filter((entry): entry is { quest: PublicQuestView; dateKey: string } => Boolean(entry.dateKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-amber-400" />
        <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Daily Bonus Signals</h2>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {bonuses.map(({ quest, dateKey }) => {
          const found = claimed.has(quest.id);
          const isToday = dateKey === todayDateKey;
          const isPast = dateKey < todayDateKey;
          const dayLabel = dateKey.slice(-2);
          const status = found ? 'secured' : isToday ? 'today' : isPast ? 'missed' : 'locked';

          return (
            <div
              key={quest.id}
              className={`rounded-xl border p-2 text-center font-mono text-[10px] space-y-1 ${
                found
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : isToday
                    ? 'bg-amber-500/15 border-amber-400 text-amber-300 animate-pulse'
                    : 'bg-stone-900/60 border-stone-700 text-stone-500'
              }`}
            >
              <div className="text-lg font-black">{dayLabel}</div>
              <div className="uppercase">
                {status === 'secured' ? 'Secured' : status === 'today' ? 'Live Today' : status === 'missed' ? 'Missed' : 'Locked'}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 font-mono">
        Each day&apos;s bonus Signal is only claimable during that Canton, Ohio calendar day. A missed day&apos;s bonus cannot be
        claimed later.
      </p>
    </section>
  );
}

function LeaderboardPreview({ entries, total }: { entries: LeaderboardEntry[]; total: number }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Fair Leaderboard</h2>
        <Link href="/leaderboard?operation=fair-qr-hunt" className="text-xs font-mono text-cyan-400 hover:text-cyan-300">
          View Full Leaderboard →
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 font-mono">No Fair scores yet — be the first to secure a Signal.</p>
      ) : (
        <div className="cq-rank-list">
          {entries.map((entry) => (
            <article key={entry.playerId}>
              <div className="cq-rank-number">#{entry.rank}</div>
              <PlayerAvatar avatarUrl={entry.avatarUrl} size={40} fallback="⚡" className="cq-rank-avatar" />
              <div className="cq-rank-name">
                <h3>{entry.displayName}</h3>
              </div>
              <strong>{entry.totalPoints} pts</strong>
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 font-mono">{total} ranked Fair agent{total === 1 ? '' : 's'}.</p>
    </section>
  );
}
