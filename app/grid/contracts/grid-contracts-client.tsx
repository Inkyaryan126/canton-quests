'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Coins,
  Loader2,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type {
  GridContractDefinition,
  GridContractInstance,
  GridContractKind,
} from '@/lib/grid/core/contract-types';

const GRID_CITY_ID = 'canton-oh';
const GRID_SEASON_ID = 'founding-season';

interface ContractItem {
  contract: GridContractDefinition;
  state: GridContractInstance;
  version: number;
}

interface ContractsResponse {
  success: boolean;
  contracts?: ContractItem[];
  error?: string;
}

interface ContractDetailResponse {
  success: boolean;
  contract?: ContractItem;
  error?: string;
}

type ScreenState = 'loading' | 'auth-required' | 'staged' | 'error' | 'ready';

function contractLabel(kind: GridContractKind): string {
  return kind.replaceAll('-', ' ').toUpperCase();
}

function formatReward(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatExpiry(expiresAtMs: number | null): string {
  if (expiresAtMs === null) return 'NO EXPIRATION';
  const date = new Date(expiresAtMs);
  if (!Number.isFinite(date.getTime())) return 'EXPIRATION UNKNOWN';
  if (date.getTime() <= Date.now()) return 'EXPIRED';
  return `ENDS ${new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date).toUpperCase()}`;
}

function progressValue(state: GridContractInstance, objectiveId: string): number {
  return Math.max(0, state.progress[objectiveId] ?? 0);
}

function objectiveComplete(state: GridContractInstance, objectiveId: string, target: number): boolean {
  return progressValue(state, objectiveId) >= target;
}

function ContractCard({
  item,
  expanded,
  onToggle,
}: {
  item: ContractItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { contract, state } = item;
  const completedObjectives = contract.objectives.filter((objective) =>
    objectiveComplete(state, objective.id, objective.target),
  ).length;

  return (
    <article className="cq-grid-contracts-card">
      <button
        type="button"
        className="cq-grid-contracts-card-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="cq-grid-contracts-card-heading">
          <span className="cq-grid-contracts-card-kicker">{contractLabel(contract.kind)} CONTRACT</span>
          <strong>{contract.id.replaceAll('-', ' ').toUpperCase()}</strong>
        </span>
        <span className="cq-grid-contracts-card-status">
          <span>{completedObjectives}/{contract.objectives.length} OBJECTIVES</span>
          {expanded ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
        </span>
      </button>

      <div className="cq-grid-contracts-card-meta">
        <span><Clock3 size={14} aria-hidden="true" /> {formatExpiry(state.expiresAtMs)}</span>
        <span><Target size={14} aria-hidden="true" /> {state.status.toUpperCase()}</span>
      </div>

      <div className="cq-grid-contracts-objectives" aria-label={`${contract.id} objective progress`}>
        {contract.objectives.map((objective) => {
          const progress = progressValue(state, objective.id);
          const complete = objectiveComplete(state, objective.id, objective.target);
          const percent = Math.min(100, Math.round((progress / objective.target) * 100));
          return (
            <div className="cq-grid-contracts-objective" key={objective.id}>
              <div className="cq-grid-contracts-objective-topline">
                <span>{objective.id.replaceAll('-', ' ').toUpperCase()}</span>
                <strong>{progress} / {objective.target}</strong>
              </div>
              <div className="cq-grid-contracts-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={objective.target} aria-valuenow={Math.min(progress, objective.target)} aria-label={`${objective.id} progress`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              {complete ? <span className="cq-grid-contracts-complete"><CheckCircle2 size={13} aria-hidden="true" /> COMPLETE</span> : null}
            </div>
          );
        })}
      </div>

      <div className="cq-grid-contracts-reward-row" aria-label="Contract rewards">
        <span><Coins size={15} aria-hidden="true" /> {formatReward(contract.reward.credits)} CR</span>
        <span><Sparkles size={15} aria-hidden="true" /> {formatReward(contract.reward.influence)} INFLUENCE</span>
        <span><Zap size={15} aria-hidden="true" /> {formatReward(contract.reward.commandPoints)} CP</span>
      </div>
    </article>
  );
}

export default function GridContractsClient() {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    setScreenState('loading');
    setError(null);
    const response = await fetch(`/api/grid/contracts?cityId=${GRID_CITY_ID}&seasonId=${GRID_SEASON_ID}`, { cache: 'no-store' });
    if (response.status === 401) { setScreenState('auth-required'); return; }
    if (response.status === 404) { setScreenState('staged'); return; }
    const payload = await response.json().catch(() => null) as ContractsResponse | null;
    if (!response.ok || !payload?.success) throw new Error(payload?.error ?? 'Contract ledger unavailable.');
    setContracts(payload.contracts ?? []);
    setScreenState('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadContracts().catch((cause) => {
      if (!cancelled) { setError(cause instanceof Error ? cause.message : 'Contract ledger unavailable.'); setScreenState('error'); }
    });
    return () => { cancelled = true; };
  }, [loadContracts]);

  const toggleDetail = useCallback(async (contractId: string) => {
    if (selectedContractId === contractId) {
      setSelectedContractId(null);
      setContractDetail(null);
      return;
    }
    setSelectedContractId(contractId);
    setContractDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/grid/contracts/${encodeURIComponent(contractId)}?cityId=${GRID_CITY_ID}&seasonId=${GRID_SEASON_ID}`, { cache: 'no-store' });
      if (response.status === 401) { setScreenState('auth-required'); return; }
      const payload = await response.json().catch(() => null) as ContractDetailResponse | null;
      if (!response.ok || !payload?.success || !payload.contract) throw new Error(payload?.error ?? 'Contract detail unavailable.');
      setContractDetail(payload.contract);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Contract detail unavailable.');
    } finally {
      setDetailLoading(false);
    }
  }, [selectedContractId]);

  return (
    <main className="cq-grid-contracts-shell">
      <style jsx global>{`\n        .cq-grid-contracts-shell { min-height: 100vh; background: #05080c; color: #f5f7f8; position: relative; overflow: hidden; }\n        .cq-grid-contracts-grid { position: fixed; inset: 0; pointer-events: none; opacity: .2; background-image: linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px); background-size: 34px 34px; mask-image: linear-gradient(to bottom, #000, transparent 86%); }\n        .cq-grid-contracts-wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 30px 0 76px; position: relative; z-index: 1; }\n        .cq-grid-contracts-header { border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 28px; }\n        .cq-grid-contracts-back, .cq-grid-contracts-kicker { display: inline-flex; align-items: center; gap: 8px; font-family: monospace; font-size: 10px; font-weight: 900; letter-spacing: .18em; }\n        .cq-grid-contracts-back { color: #7b8790; text-decoration: none; font-size: 11px; } .cq-grid-contracts-back:hover, .cq-grid-contracts-back:focus-visible { color: #a5f3fc; outline: none; }\n        .cq-grid-contracts-kicker { margin-top: 30px; color: #67e8f9; } .cq-grid-contracts-title { margin: 12px 0 0; font-family: var(--font-display), Impact, sans-serif; font-size: clamp(48px, 8.5vw, 92px); line-height: .86; letter-spacing: -.04em; } .cq-grid-contracts-title span { color: #a5f3fc; text-shadow: 0 0 40px rgba(34,211,238,.22); }\n        .cq-grid-contracts-intro { max-width: 780px; margin: 20px 0 0; color: #929ca4; font-size: 15px; line-height: 1.75; }\n        .cq-grid-contracts-state { min-height: 360px; margin-top: 28px; border: 1px solid rgba(103,232,249,.18); border-radius: 24px; background: rgba(0,0,0,.42); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 38px; color: #b6c2c9; } .cq-grid-contracts-state h2 { margin: 18px 0 7px; color: #fff; font-family: var(--font-display), Impact, sans-serif; font-size: 28px; letter-spacing: .04em; } .cq-grid-contracts-state p { max-width: 560px; margin: 0; color: #7f8b94; line-height: 1.65; } .cq-grid-contracts-state-error { border-color: rgba(251,113,133,.3); }\n        .cq-grid-contracts-spin { animation: cq-grid-contracts-spin 1s linear infinite; } @keyframes cq-grid-contracts-spin { to { transform: rotate(360deg); } } .cq-grid-contracts-action { margin-top: 22px; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; background: #67e8f9; color: #031118; text-decoration: none; padding: 0 20px; font-family: var(--font-display), Impact, sans-serif; font-weight: 900; letter-spacing: .08em; cursor: pointer; }\n        .cq-grid-contracts-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 22px; } .cq-grid-contracts-summary div { min-height: 104px; border: 1px solid rgba(255,255,255,.09); border-radius: 18px; background: rgba(0,0,0,.42); padding: 17px; } .cq-grid-contracts-summary span, .cq-grid-contracts-section-heading span, .cq-grid-contracts-card-kicker { color: #77838c; font-family: monospace; font-size: 9px; font-weight: 900; letter-spacing: .15em; } .cq-grid-contracts-summary strong { display: block; margin-top: 13px; color: #fff; font-family: var(--font-display), Impact, sans-serif; font-size: 30px; }\n        .cq-grid-contracts-section { margin-top: 28px; } .cq-grid-contracts-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: 12px; } .cq-grid-contracts-section-heading h2 { margin: 0; font-family: var(--font-display), Impact, sans-serif; font-size: 30px; letter-spacing: .02em; } .cq-grid-contracts-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }\n        .cq-grid-contracts-card { border: 1px solid rgba(103,232,249,.2); border-radius: 22px; background: linear-gradient(145deg, rgba(15,22,28,.96), rgba(5,8,11,.96)); padding: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.2); } .cq-grid-contracts-card-toggle { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; border: 0; background: none; color: inherit; padding: 0; text-align: left; cursor: pointer; } .cq-grid-contracts-card-toggle:focus-visible { outline: 2px solid #67e8f9; outline-offset: 5px; } .cq-grid-contracts-card-heading { display: flex; flex-direction: column; gap: 6px; } .cq-grid-contracts-card-heading strong { font-family: var(--font-display), Impact, sans-serif; font-size: 28px; line-height: 1; } .cq-grid-contracts-card-status { display: flex; align-items: center; gap: 6px; color: #a5f3fc; font-family: monospace; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-align: right; }\n        .cq-grid-contracts-card-meta { display: flex; flex-wrap: wrap; gap: 13px; margin-top: 18px; color: #89969e; font-family: monospace; font-size: 9px; font-weight: 800; letter-spacing: .08em; } .cq-grid-contracts-card-meta span, .cq-grid-contracts-reward-row span { display: inline-flex; align-items: center; gap: 6px; } .cq-grid-contracts-objectives { display: grid; gap: 14px; margin-top: 22px; } .cq-grid-contracts-objective-topline { display: flex; justify-content: space-between; gap: 12px; color: #aebbc1; font-family: monospace; font-size: 10px; letter-spacing: .08em; } .cq-grid-contracts-objective-topline strong { color: #f5f7f8; } .cq-grid-contracts-progress-track { height: 7px; margin-top: 8px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.1); } .cq-grid-contracts-progress-track span { display: block; height: 100%; border-radius: inherit; background: #67e8f9; box-shadow: 0 0 16px rgba(103,232,249,.4); transition: width .25s ease; } .cq-grid-contracts-complete { display: inline-flex; align-items: center; gap: 5px; margin-top: 7px; color: #86efac; font-family: monospace; font-size: 9px; font-weight: 900; letter-spacing: .1em; }\n        .cq-grid-contracts-reward-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,.08); color: #fde68a; font-family: monospace; font-size: 10px; font-weight: 900; letter-spacing: .08em; } .cq-grid-contracts-detail { display: flex; align-items: center; gap: 8px; margin: 8px 4px 0; border: 1px solid rgba(103,232,249,.16); border-radius: 10px; padding: 10px 12px; color: #91aab4; font-family: monospace; font-size: 9px; letter-spacing: .08em; } .cq-grid-contracts-inline-error { margin-top: 14px; border: 1px solid rgba(251,113,133,.25); border-radius: 12px; background: rgba(251,113,133,.06); padding: 12px 14px; color: #fecdd3; font-size: 12px; line-height: 1.5; }\n        @media (max-width: 760px) { .cq-grid-contracts-wrap { width: min(100% - 20px, 1120px); padding-top: 20px; } .cq-grid-contracts-summary, .cq-grid-contracts-card-grid { grid-template-columns: 1fr; } .cq-grid-contracts-section-heading { align-items: flex-start; flex-direction: column; gap: 4px; } .cq-grid-contracts-section-heading h2 { font-size: 27px; } .cq-grid-contracts-card-heading strong { font-size: 25px; } .cq-grid-contracts-card-status span { display: none; } }\n        @media (prefers-reduced-motion: reduce) { .cq-grid-contracts-progress-track span { transition: none; } .cq-grid-contracts-spin { animation: none; } }\n      `}</style>
      <div className="cq-grid-contracts-grid" aria-hidden="true" />
      <div className="cq-grid-contracts-wrap">
        <header className="cq-grid-contracts-header">
          <Link href="/grid" className="cq-grid-contracts-back"><ArrowLeft size={15} aria-hidden="true" /> THE GRID</Link>
          <div className="cq-grid-contracts-kicker"><Radio size={13} aria-hidden="true" /> CANTON, OHIO // PRIVATE CONTRACT LEDGER</div>
          <h1 className="cq-grid-contracts-title">CONTRACTS<br /><span>MOVE THE CITY.</span></h1>
          <p className="cq-grid-contracts-intro">Server-issued objectives for your current season. Read your assignments, watch the city respond, and earn the rewards when the work is verified.</p>
        </header>

        {screenState === 'loading' ? (
          <section className="cq-grid-contracts-state"><Loader2 size={25} className="cq-grid-contracts-spin" aria-hidden="true" /><strong>SCANNING CONTRACT LEDGER</strong><p>Reading your active assignments.</p></section>
        ) : screenState === 'auth-required' ? (
          <section className="cq-grid-contracts-state"><LockKeyhole size={30} aria-hidden="true" /><h2>PLAYER AUTHENTICATION REQUIRED</h2><p>Sign in to view contracts assigned to your own Grid identity.</p><Link href="/login" className="cq-grid-contracts-action">SIGN IN <ChevronRight size={16} aria-hidden="true" /></Link></section>
        ) : screenState === 'staged' ? (
          <section className="cq-grid-contracts-state"><ShieldCheck size={30} aria-hidden="true" /><h2>CONTRACT SIGNAL STAGED</h2><p>The private contract ledger is built, but Grid runtime reads are not enabled in this environment yet.</p></section>
        ) : screenState === 'error' ? (
          <section className="cq-grid-contracts-state cq-grid-contracts-state-error"><Radio size={30} aria-hidden="true" /><h2>CONTRACT SIGNAL LOST</h2><p>{error}</p><button type="button" className="cq-grid-contracts-action" onClick={() => void loadContracts()}>RETRY</button></section>
        ) : contracts.length === 0 ? (
          <section className="cq-grid-contracts-state"><Target size={30} aria-hidden="true" /><h2>NO ACTIVE CONTRACTS</h2><p>No assignments are active for your current season. Keep your signal open; new work may arrive as the city changes.</p><Link href="/grid/return" className="cq-grid-contracts-action">RETURN TO CITY <ChevronRight size={16} aria-hidden="true" /></Link></section>
        ) : (
          <>
            {error ? <div className="cq-grid-contracts-inline-error" role="alert">{error}</div> : null}
            <section className="cq-grid-contracts-summary" aria-label="Contract ledger summary">
              <div><span>ACTIVE ASSIGNMENTS</span><strong>{contracts.length}</strong></div>
              <div><span>READ-ONLY SIGNAL</span><strong>LIVE</strong></div>
              <div><span>PLAYER STATE</span><strong>PRIVATE</strong></div>
            </section>
            <section className="cq-grid-contracts-section" aria-labelledby="active-contracts-title">
              <div className="cq-grid-contracts-section-heading"><span>FOUNDING SEASON // CANTON</span><h2 id="active-contracts-title">ACTIVE CONTRACTS</h2></div>
              <div className="cq-grid-contracts-card-grid">
                {contracts.map((item) => (
                  <div key={item.contract.id}>
                    <ContractCard item={item} expanded={selectedContractId === item.contract.id} onToggle={() => void toggleDetail(item.contract.id)} />
                    {selectedContractId === item.contract.id ? <div className="cq-grid-contracts-detail" aria-live="polite">{detailLoading ? <><Loader2 size={15} className="cq-grid-contracts-spin" aria-hidden="true" /> REFRESHING PRIVATE DETAIL</> : contractDetail ? <>PRIVATE DETAIL CONFIRMED // VERSION {contractDetail.version} {contractDetail.state.locationEnhanced ? ' // LOCATION BONUS ACTIVE' : ''}</> : null}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
