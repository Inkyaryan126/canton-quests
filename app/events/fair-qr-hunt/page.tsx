'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, CheckCircle2, DollarSign } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import PageHeader from '@/components/PageHeader';
import PlayerAvatar from '@/components/PlayerAvatar';
import FairLiveMapWrapper from '@/components/FairLiveMapWrapper';
import { formatCents } from '@/lib/fair-hunt';
import type { FairMysteryBoard, FairMysteryWinner, FairOperationPhase } from '@/lib/fair-hunt';
import type { QuestEvent } from '@/lib/types';

interface DashboardData {
  event: QuestEvent;
  phase: FairOperationPhase;
  board: FairMysteryBoard;
  winners: FairMysteryWinner[];
  isAuthenticated: boolean;
  player?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    profileImageCropZoom?: number;
    profileImageCropX?: number;
    profileImageCropY?: number;
  };
  myWinnings?: { signalsFound: number; totalCents: number };
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
          title="$300 MYSTERY MONEY HUNT"
          body="A path-free QR scavenger hunt across the fairgrounds — 20 Signals, each hiding a real cash prize. First authenticated scanner to find a Signal wins its money, revealed the moment it's claimed."
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
                MISSION COMPLETE — the Fair QR Hunt has ended. Final results remain viewable below.
              </div>
            )}

            <MysterySummary board={data.board} />

            {!data.isAuthenticated ? (
              <div className="glass-panel p-8 text-center space-y-4 border-cyan-500/40">
                <h2 className="text-xl font-extrabold text-white">Enter the Fair QR Hunt</h2>
                <p className="text-sm text-gray-300">Create your permanent Player Identity — no starting path required — to start finding Signals.</p>
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

            <FairLiveMapWrapper />

            <MysteryBoard board={data.board} />

            <FairHuntersList winners={data.winners} />
          </>
        )}
      </main>

      <CinematicFooter />
    </div>
  );
}

function MysterySummary({ board }: { board: FairMysteryBoard }) {
  return (
    <div className="glass-panel p-6 border-emerald-500/30 space-y-4">
      <div className="text-center">
        <div className="text-3xl font-black text-white">$300 MYSTERY MONEY HUNT</div>
        <div className="text-sm font-mono text-gray-400 mt-1">
          {board.foundCount} / {board.totalCount} SIGNALS FOUND
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center font-mono text-xs">
        <div className="glass-panel p-4 border-emerald-500/30">
          <div className="text-2xl font-black text-emerald-300">{formatCents(board.revealedCents)}</div>
          <div className="text-gray-400 mt-1">Revealed</div>
        </div>
        <div className="glass-panel p-4 border-cyan-500/30">
          <div className="text-2xl font-black text-cyan-300">{formatCents(board.hiddenCents)}</div>
          <div className="text-gray-400 mt-1">Still Hidden</div>
        </div>
      </div>
    </div>
  );
}

function PlayerStatusPanel({ data }: { data: DashboardData }) {
  const winnings = data.myWinnings || { signalsFound: 0, totalCents: 0 };
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
        <p className="text-xs font-mono text-gray-400">Your Mystery Money earnings so far</p>
      </div>
      <div className="grid grid-cols-2 gap-6 text-center font-mono">
        <div>
          <div className="text-xl font-black text-white">{winnings.signalsFound}</div>
          <div className="text-[10px] text-gray-400 uppercase">Signals Found</div>
        </div>
        <div>
          <div className="text-xl font-black text-emerald-300">{formatCents(winnings.totalCents)}</div>
          <div className="text-[10px] text-gray-400 uppercase">Won</div>
        </div>
      </div>
    </div>
  );
}

function MysteryBoard({ board }: { board: FairMysteryBoard }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign size={18} className="text-emerald-400" />
        <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Mystery Money Board</h2>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {board.signals.map((signal) => (
          <div
            key={signal.questId}
            className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[10px] p-1 text-center ${
              signal.found
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-stone-900/60 border-stone-700 text-stone-500'
            }`}
            title={signal.title}
          >
            {signal.found ? <CheckCircle2 size={16} /> : <Lock size={16} />}
            <span>SIGNAL {String(signal.number).padStart(2, '0')}</span>
            {signal.found ? (
              <>
                <span className="text-white font-bold truncate max-w-full">{signal.finderDisplayName}</span>
                <span className="text-emerald-300 font-bold">{formatCents(signal.cashCents || 0)}</span>
              </>
            ) : (
              <span className="text-stone-500">$???</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FairHuntersList({ winners }: { winners: FairMysteryWinner[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Fair Hunters</h2>
      <p className="text-xs font-mono text-gray-500">
        Each hunter&apos;s total earnings so far — the real prizes are the dollar values hidden in the Signals themselves, not this list.
      </p>
      {winners.length === 0 ? (
        <p className="text-sm text-gray-400 font-mono">No Signals found yet — be the first to secure one.</p>
      ) : (
        <div className="cq-rank-list">
          {winners.map((winner) => (
            <article key={winner.playerId}>
              <PlayerAvatar avatarUrl={winner.avatarUrl} size={40} fallback="⚡" className="cq-rank-avatar" />
              <div className="cq-rank-name">
                <h3>{winner.displayName}</h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  {winner.signalsFound} Find{winner.signalsFound === 1 ? '' : 's'}
                </span>
              </div>
              <strong>{formatCents(winner.totalCents)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
