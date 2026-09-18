'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Castle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  Loader2,
  LockKeyhole,
  MapPinned,
  Radio,
  Shield,
  Sparkles,
  Stamp,
  Swords,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface ReturnHighlight {
  at: string;
  kind: string;
  message: string;
}
interface ReturnSummary {
  since: string;
  generatedAt: string;
  timeAwayMinutes: number;
  truncated: boolean;
  eventsScanned: number;
  pendingResources: {
    creditsProduced: number;
    influenceGenerated: number;
    commandPointsRestored: number;
    projectedCredits: number;
    projectedInfluence: number;
    projectedCommandPoints: number;
    billableMinutes: number;
    offlineAccrualCapped: boolean;
  };
  cityActivity: {
    territoryClaims: number;
    propertyAcquisitions: number;
    propertyDevelopments: number;
    contestsStarted: number;
    contestRounds: number;
    territoryCaptures: number;
  };
  yourActivity: {
    territoryClaims: number;
    propertyAcquisitions: number;
    propertyDevelopments: number;
    attacksStarted: number;
    defensesFaced: number;
    contestsWon: number;
    contestsLost: number;
  };
  highlights: ReturnHighlight[];
}

interface ReturnResponse {
  success: boolean;
  summary?: ReturnSummary | null;
  error?: string;
}

function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hourRemainder = hours % 24;
  return hourRemainder ? `${days}d ${hourRemainder}h` : `${days}d`;
}
function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function StatCard(props: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] font-black tracking-[.16em] text-stone-500">
          {props.label}
        </div>
        <div className="text-cyan-300">{props.icon}</div>
      </div>
      <div className="mt-3 font-display text-3xl font-black text-white">
        {props.value}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-stone-500">
        {props.note}
      </div>
    </div>
  );
}

function highlightIcon(kind: string): React.ReactNode {
  if (kind.includes('won') || kind.includes('defended')) {
    return <Shield size={15} aria-hidden="true" />;
  }
  if (kind.includes('lost') || kind.includes('attack')) {
    return <Swords size={15} aria-hidden="true" />;
  }
  if (kind.includes('territory')) {
    return <MapPinned size={15} aria-hidden="true" />;
  }
  if (kind.includes('property')) {
    return <TrendingUp size={15} aria-hidden="true" />;
  }
  return <Sparkles size={15} aria-hidden="true" />;
}

export default function GridReturnClient() {
  const [summary, setSummary] = useState<ReturnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [runtimeLocked, setRuntimeLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/grid/return-summary', { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return null;
        if (response.status === 401) {
          setAuthRequired(true);
          return null;
        }
        if (response.status === 404) {
          setRuntimeLocked(true);
          return null;
        }

        const payload = (await response.json()) as ReturnResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Return briefing unavailable.');
        }
        return payload.summary ?? null;
      })
      .then((nextSummary) => {
        if (!cancelled && nextSummary !== undefined) setSummary(nextSummary);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Return briefing unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-7">
        <header className="border-b border-white/10 pb-7">
          <Link
            href="/grid"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-cyan-200"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            THE GRID
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
                <Radio size={13} className="animate-pulse" aria-hidden="true" />
                CANTON, OHIO // CITY 001 // RETURN SIGNAL
              </div>
              <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
                CITY REMEMBERS
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
                A private recap of what your persistent city produced and what
                changed while you were away.
              </p>
            </div>

            {summary ? (
              <div className="cq-grid-return-tools">
                <Link href="/grid/passport" className="cq-grid-return-passport-link">
                  <Stamp size={17} aria-hidden="true" />
                  <span>GRID PASSPORT</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/grid/strongholds" className="cq-grid-return-strongholds-link">
                  <Castle size={17} aria-hidden="true" />
                  <span>STRONGHOLDS</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/grid/defense" className="cq-grid-return-strongholds-link">
                  <Shield size={17} aria-hidden="true" />
                  <span>DEFENSE</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] px-5 py-4">
                  <div className="font-mono text-[10px] font-black tracking-[.18em] text-stone-500">
                    TIME AWAY
                  </div>
                  <div className="mt-2 font-display text-3xl font-black text-cyan-100">
                    {humanizeMinutes(summary.timeAwayMinutes)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        {error ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-cyan-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              RECONSTRUCTING CITY STATE
            </div>
          </section>
        ) : authRequired ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Sign in to receive a private return brief for your own Grid state.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : runtimeLocked ? (
          <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[.045] p-7 sm:p-10">
            <Radio size={30} className="text-amber-200" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Return signal staged
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              The private return feed is built, but Grid runtime reads are not
              enabled in this environment yet.
            </p>
          </section>
        ) : !summary ? (
          <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[.045] p-7 sm:p-10">
            <MapPinned size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              No city history yet
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Enter the Founding Season and claim your first Canton territory
              before a return briefing can be generated.
            </p>
            <Link
              href="/grid/onboarding"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Begin onboarding
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="CREDITS PRODUCED"
                value={`+${summary.pendingResources.creditsProduced}`}
                note={`${summary.pendingResources.projectedCredits} projected wallet`}
                icon={<Coins size={18} aria-hidden="true" />}
              />
              <StatCard
                label="INFLUENCE GENERATED"
                value={`+${summary.pendingResources.influenceGenerated}`}
                note={`${summary.pendingResources.projectedInfluence} projected Influence`}
                icon={<TrendingUp size={18} aria-hidden="true" />}
              />
              <StatCard
                label="COMMAND POINTS"
                value={`+${summary.pendingResources.commandPointsRestored}`}
                note={`${summary.pendingResources.projectedCommandPoints} projected CP`}
                icon={<Zap size={18} aria-hidden="true" />}
              />
              <StatCard
                label="BILLABLE OFFLINE TIME"
                value={humanizeMinutes(summary.pendingResources.billableMinutes)}
                note={
                  summary.pendingResources.offlineAccrualCapped
                    ? 'Offline accrual cap reached'
                    : 'Within offline accrual cap'
                }
                icon={<Clock3 size={18} aria-hidden="true" />}
              />
            </section>

            <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/[.045] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[10px] font-black tracking-[.18em] text-cyan-300">
                  READY TO MOVE
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
                  Your private recap is complete. Re-enter the Canton City
                  Board with your current territory, property, and wallet state.
                </p>
              </div>
              <Link
                href="/grid/preview"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
              >
                Re-enter City Board
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="rounded-3xl border border-white/10 bg-black/45 p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] font-black tracking-[.18em] text-stone-500">
                      WHAT HAPPENED
                    </div>
                    <h2 className="mt-1 font-display text-3xl font-black uppercase">
                      Return highlights
                    </h2>
                  </div>
                  <div className="font-mono text-[9px] text-stone-600">
                    SINCE {formatTimestamp(summary.since)}
                  </div>
                </div>

                {summary.highlights.length > 0 ? (
                  <ol className="mt-6 space-y-3">
                    {summary.highlights.map((highlight, index) => (
                      <li
                        key={`${highlight.at}:${highlight.kind}:${index}`}
                        className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 text-cyan-200">
                          {highlightIcon(highlight.kind)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-stone-200">
                            {highlight.message}
                          </div>
                          <div className="mt-1 font-mono text-[9px] text-stone-600">
                            {formatTimestamp(highlight.at)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-5 text-sm text-stone-500">
                    No player-specific highlight events were detected while you
                    were away.
                  </div>
                )}

                {summary.truncated ? (
                  <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.05] px-4 py-3 text-xs text-amber-100">
                    This brief reached its bounded event window. Older activity
                    remains in the immutable event ledger.
                  </div>
                ) : null}
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <Radio size={18} className="text-cyan-300" />
                    City activity
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <ActivityRow label="Territory claims" value={summary.cityActivity.territoryClaims} />
                    <ActivityRow label="Property acquisitions" value={summary.cityActivity.propertyAcquisitions} />
                    <ActivityRow label="Property upgrades" value={summary.cityActivity.propertyDevelopments} />
                    <ActivityRow label="Contests started" value={summary.cityActivity.contestsStarted} />
                    <ActivityRow label="Contest rounds" value={summary.cityActivity.contestRounds} />
                    <ActivityRow label="Territory captures" value={summary.cityActivity.territoryCaptures} />
                  </dl>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <Shield size={18} className="text-emerald-300" />
                    Your activity
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <ActivityRow label="Claims" value={summary.yourActivity.territoryClaims} />
                    <ActivityRow label="Properties acquired" value={summary.yourActivity.propertyAcquisitions} />
                    <ActivityRow label="Properties upgraded" value={summary.yourActivity.propertyDevelopments} />
                    <ActivityRow label="Attacks started" value={summary.yourActivity.attacksStarted} />
                    <ActivityRow label="Defenses faced" value={summary.yourActivity.defensesFaced} />
                    <ActivityRow label="Contests won" value={summary.yourActivity.contestsWon} />
                    <ActivityRow label="Contests lost" value={summary.yourActivity.contestsLost} />
                  </dl>
                </div>
                <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[.04] p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <CheckCircle2 size={18} className="text-emerald-300" />
                    Private projection
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">
                    This screen receives sanitized counts and your own activity
                    only. Raw event payloads and rival player IDs stay on the server.
                  </p>
                  <div className="mt-3 font-mono text-[9px] text-stone-600">
                    {summary.eventsScanned} EVENTS SCANNED
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ActivityRow(props: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-stone-500">{props.label}</dt>
      <dd className="font-mono font-black text-stone-200">{props.value}</dd>
    </div>
  );
}
