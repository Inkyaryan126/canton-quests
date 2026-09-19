'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgePercent,
  ChevronRight,
  Flame,
  Gauge,
  Loader2,
  LockKeyhole,
  Radio,
  ShieldAlert,
  Target,
  Users,
} from 'lucide-react';

interface HeatEffects {
  neutralFactionPressureBps: number;
  borderRewardBonusBps: number;
  upkeepSurchargeBps: number;
  rivalObjectiveBonusBps: number;
  antiMonopolyContractSlots: number;
}

interface HeatProjection {
  scope: 'player' | 'alliance';
  label: string;
  controlledTerritories: number;
  eligibleTerritories: number;
  territoryShareBps: number;
  dominanceScoreBps: number;
  active: boolean;
  bandId: string | null;
  effects: HeatEffects;
  nextBandId: string | null;
  bpsToNextBand: number | null;
}

interface HeatResponse {
  success: boolean;
  heat?: {
    state: 'unavailable' | 'join-required' | 'ready';
    seasonStatus: string | null;
    measurement: 'territory-share';
    effectEnforcement: 'projected';
    player: HeatProjection | null;
    alliance: HeatProjection | null;
  };
  error?: string;
}

function percent(bps: number): string {
  const value = bps / 100;
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + '%';
}

function bandLabel(value: string | null): string {
  return value ? value.toUpperCase() : 'COOL';
}

function panelTone(value: string | null): string {
  if (value === 'critical') return 'border-rose-400/30 bg-rose-400/[.08]';
  if (value === 'hot') return 'border-orange-300/30 bg-orange-300/[.08]';
  if (value === 'warm') return 'border-amber-300/30 bg-amber-300/[.07]';
  return 'border-cyan-300/20 bg-cyan-300/[.045]';
}

function barTone(value: string | null): string {
  if (value === 'critical') return 'bg-rose-400';
  if (value === 'hot') return 'bg-orange-300';
  if (value === 'warm') return 'bg-amber-300';
  return 'bg-cyan-300';
}

function EffectCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-stone-600">
          {props.label}
        </div>
        <div className="text-amber-200">{props.icon}</div>
      </div>
      <div className="mt-3 font-display text-2xl font-black text-white">
        {props.value}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        {props.note}
      </p>
    </div>
  );
}

function ProjectionPanel(props: { projection: HeatProjection }) {
  const projection = props.projection;
  const width =
    String(Math.max(0, Math.min(100, projection.dominanceScoreBps / 100))) +
    '%';

  return (
    <section
      className={
        'rounded-3xl border p-5 sm:p-7 ' + panelTone(projection.bandId)
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] font-black uppercase tracking-[.18em] text-stone-500">
            {projection.scope === 'player'
              ? 'PERSONAL EXPOSURE'
              : 'ALLIANCE EXPOSURE'}
          </div>
          <h2 className="mt-1 font-display text-3xl font-black uppercase">
            {projection.label}
          </h2>
          <p className="mt-2 text-sm text-stone-400">
            {projection.controlledTerritories} of{' '}
            {projection.eligibleTerritories} Canton territories controlled
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-right">
          <div className="font-mono text-[9px] font-black uppercase tracking-[.16em] text-stone-500">
            Heat Band
          </div>
          <div className="mt-1 font-display text-2xl font-black uppercase">
            {bandLabel(projection.bandId)}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {percent(projection.dominanceScoreBps)} dominance
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between font-mono text-[9px] font-black uppercase tracking-[.12em] text-stone-500">
          <span>City concentration</span>
          <span>{percent(projection.territoryShareBps)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/50">
          <div
            className={'h-full rounded-full ' + barTone(projection.bandId)}
            style={{ width }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-stone-600">
          <span>Warm 35%</span>
          <span>Hot 50%</span>
          <span>Critical 75%</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-400">
        {projection.nextBandId && projection.bpsToNextBand !== null ? (
          <>
            <span className="font-semibold text-stone-200">
              {percent(projection.bpsToNextBand)}
            </span>{' '}
            more concentration reaches{' '}
            <span className="font-semibold uppercase text-stone-200">
              {projection.nextBandId}
            </span>
            .
          </>
        ) : (
          'Highest configured Heat band reached.'
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <EffectCard
          icon={<ShieldAlert size={16} />}
          label="Neutral pressure"
          value={'+' + percent(projection.effects.neutralFactionPressureBps)}
          note="Projected NPC counter-pressure."
        />
        <EffectCard
          icon={<Target size={16} />}
          label="Border rewards"
          value={'+' + percent(projection.effects.borderRewardBonusBps)}
          note="Projected incentive for rivals attacking your edges."
        />
        <EffectCard
          icon={<BadgePercent size={16} />}
          label="Upkeep"
          value={'+' + percent(projection.effects.upkeepSurchargeBps)}
          note="Projected concentration surcharge."
        />
        <EffectCard
          icon={<Gauge size={16} />}
          label="Rival objectives"
          value={'+' + percent(projection.effects.rivalObjectiveBonusBps)}
          note="Projected underdog objective bonus."
        />
        <EffectCard
          icon={<Users size={16} />}
          label="Anti-monopoly slots"
          value={'+' + String(projection.effects.antiMonopolyContractSlots)}
          note="Projected extra counter-play Contract slots."
        />
      </div>
    </section>
  );
}

export default function GridDominanceHeatClient() {
  const [heat, setHeat] = useState<HeatResponse['heat'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [runtimeLocked, setRuntimeLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/grid/dominance-heat', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          setAuthRequired(true);
          return null;
        }
        if (response.status === 404) {
          setRuntimeLocked(true);
          return null;
        }
        const payload = (await response.json()) as HeatResponse;
        if (!response.ok || !payload.success || !payload.heat) {
          throw new Error(payload.error || 'Dominance Heat unavailable.');
        }
        return payload.heat;
      })
      .then((payload) => {
        if (!cancelled && payload) setHeat(payload);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Dominance Heat unavailable.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const highest =
    heat?.alliance &&
    heat.player &&
    heat.alliance.dominanceScoreBps > heat.player.dominanceScoreBps
      ? heat.alliance
      : heat?.player ?? null;

  return (
    <div className="min-h-screen bg-[#070706] text-white">
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7">
        <header className="border-b border-white/10 pb-7">
          <Link
            href="/grid/return"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 hover:text-orange-200"
          >
            <ArrowLeft size={14} />
            RETURN BRIEF
          </Link>
          <div className="mt-6 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[.2em] text-orange-300">
            <Flame size={14} />
            ANTI-SNOWBALL PRESSURE
          </div>
          <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
            DOMINANCE HEAT
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-base">
            The more of Canton one player or alliance controls, the more
            counter-pressure The Grid can apply to keep the city competitive.
          </p>
        </header>

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-orange-200">
              <Loader2 className="animate-spin" size={18} />
              MEASURING CITY CONCENTRATION
            </div>
          </section>
        ) : authRequired ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <LockKeyhole size={30} className="text-orange-300" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-300 px-5 py-3 font-display text-sm font-black uppercase text-slate-950"
            >
              Sign in <ChevronRight size={17} />
            </Link>
          </section>
        ) : runtimeLocked ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <Radio size={30} className="text-stone-600" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Heat signal staged
            </h2>
            <p className="mt-3 text-sm text-stone-400">
              Grid runtime reads are not enabled in this environment.
            </p>
          </section>
        ) : heat?.state === 'join-required' ? (
          <section className="mt-8 rounded-3xl border border-orange-300/20 bg-orange-300/[.045] p-8">
            <Flame size={30} className="text-orange-300" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Join the season first
            </h2>
            <Link
              href="/grid/onboarding"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-300 px-5 py-3 font-display text-sm font-black uppercase text-slate-950"
            >
              Open onboarding <ChevronRight size={17} />
            </Link>
          </section>
        ) : heat?.state !== 'ready' || !heat.player ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <Gauge size={30} className="text-stone-600" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Heat cannot be measured yet
            </h2>
          </section>
        ) : (
          <>
            <section className="mt-7 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-stone-600">
                  Highest Exposure
                </div>
                <div className="mt-2 font-display text-3xl font-black text-orange-100">
                  {highest ? percent(highest.dominanceScoreBps) : '0%'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-stone-600">
                  Measurement
                </div>
                <div className="mt-2 font-display text-2xl font-black uppercase">
                  Territory Share
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black uppercase tracking-[.14em] text-stone-600">
                  Season Status
                </div>
                <div className="mt-2 font-display text-2xl font-black uppercase">
                  {heat.seasonStatus || 'Unknown'}
                </div>
              </div>
            </section>

            <div className="mt-5 space-y-5">
              <ProjectionPanel projection={heat.player} />
              {heat.alliance ? <ProjectionPanel projection={heat.alliance} /> : null}
            </div>

            <section className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="mt-0.5 text-cyan-300" />
                <div>
                  <h2 className="font-display text-xl font-black uppercase">
                    Projection, not silent enforcement
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-relaxed text-stone-400">
                    These are configured anti-snowball rules for downstream NPC,
                    upkeep, border-reward, and Contract systems. This screen does
                    not claim a surcharge or bonus has already been charged or
                    paid.
                  </p>
                  <p className="mt-3 text-xs text-stone-600">
                    Current live measurement uses territory share only.
                    Strategic-value concentration stays disabled until Canton
                    has authoritative strategic-value data.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
