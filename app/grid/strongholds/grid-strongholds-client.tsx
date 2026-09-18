'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Castle,
  ChevronDown,
  Dices,
  Flag,
  Loader2,
  LockKeyhole,
  Radio,
  RefreshCw,
  Route,
  Shield,
  Swords,
  Trophy,
  Undo2,
} from 'lucide-react';
import type { GridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';
import type { GridPveStrongholdContestView } from '@/lib/grid/server/pve-stronghold-read-service';
import type { GridPveStrongholdHistoryViewEvent } from '@/lib/grid/server/pve-stronghold-history-service';
import type { GridWorldProjection } from '@/lib/grid/server/world-projection';

type StrongholdView = GridNpcStrongholdWorldProjection & {
  targetNeutral: boolean;
  attackSourceTerritorySlugs: string[];
};

interface StrongholdsResponse {
  success: boolean;
  strongholds?: StrongholdView[];
  error?: string;
}

interface ContestsResponse {
  success: boolean;
  contests?: GridPveStrongholdContestView[];
  error?: string;
}

interface WorldResponse {
  projection?: GridWorldProjection;
  contestWriteEnabled?: boolean;
  runtimeEnabled?: boolean;
  error?: string;
}

interface HistoryResponse {
  success: boolean;
  history?: { events: GridPveStrongholdHistoryViewEvent[] };
  error?: string;
}

interface ActionResponse {
  success: boolean;
  error?: string;
}

function idempotency(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function label(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date).toUpperCase();
}

function BattleLog({ events }: { events: GridPveStrongholdHistoryViewEvent[] }) {
  if (events.length === 0) {
    return <p className="cq-grid-strongholds-muted">No battle events recorded yet.</p>;
  }
  return (
    <ol className="cq-grid-strongholds-log">
      {events.map((event, index) => {
        if (event.kind === 'started') {
          return (
            <li key={`${event.kind}-${event.createdAt}-${index}`}>
              <span>DEPLOYMENT</span>
              <strong>{event.attackerCommittedInfluence} Influence committed</strong>
              <small>Garrison {event.garrisonCommittedInfluence} · {formatTime(event.createdAt)}</small>
            </li>
          );
        }
        if (event.kind === 'withdrawn') {
          return (
            <li key={`${event.kind}-${event.createdAt}-${index}`}>
              <span>RETREAT</span>
              <strong>{event.attackerRefundedInfluence} Influence recovered</strong>
              <small>Garrison remaining {event.garrisonRemainingInfluence} · {formatTime(event.createdAt)}</small>
            </li>
          );
        }
        return (
          <li key={`${event.kind}-${event.createdAt}-${index}`}>
            <span>ROUND {event.roundNumber}</span>
            <strong>
              You {event.attackerRolls.join(' · ')} · Garrison {event.garrisonRolls.join(' · ')}
            </strong>
            <small>
              Losses: you −{event.attackerInfluenceLost}, garrison −{event.garrisonInfluenceLost}
              {' · '}{event.status.toUpperCase()} · {formatTime(event.createdAt)}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

export default function GridStrongholdsClient() {
  const [strongholds, setStrongholds] = useState<StrongholdView[]>([]);
  const [contests, setContests] = useState<GridPveStrongholdContestView[]>([]);
  const [world, setWorld] = useState<GridWorldProjection | null>(null);
  const [contestWriteEnabled, setContestWriteEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [runtimeLocked, setRuntimeLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<Record<string, string>>({});
  const [selectedCommit, setSelectedCommit] = useState<Record<string, number>>({});
  const [historyByContest, setHistoryByContest] = useState<Record<string, GridPveStrongholdHistoryViewEvent[]>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const [strongholdResponse, contestResponse, worldResponse] = await Promise.all([
        fetch('/api/grid/strongholds', { cache: 'no-store' }),
        fetch('/api/grid/stronghold-contests', { cache: 'no-store' }),
        fetch('/api/grid/world', { cache: 'no-store' }),
      ]);

      if ([strongholdResponse.status, contestResponse.status].includes(401)) {
        setAuthRequired(true);
        return;
      }
      if ([strongholdResponse.status, contestResponse.status].includes(404)) {
        setRuntimeLocked(true);
        return;
      }

      const strongholdPayload = (await strongholdResponse.json()) as StrongholdsResponse;
      const contestPayload = (await contestResponse.json()) as ContestsResponse;
      const worldPayload = (await worldResponse.json()) as WorldResponse;
      if (!strongholdResponse.ok || !strongholdPayload.success) {
        throw new Error(strongholdPayload.error ?? 'Stronghold signal unavailable.');
      }
      if (!contestResponse.ok || !contestPayload.success) {
        throw new Error(contestPayload.error ?? 'Active stronghold contests unavailable.');
      }
      if (!worldResponse.ok || !worldPayload.projection) {
        throw new Error(worldPayload.error ?? 'Grid world state unavailable.');
      }

      setStrongholds(strongholdPayload.strongholds ?? []);
      setContests(contestPayload.contests ?? []);
      setWorld(worldPayload.projection);
      setContestWriteEnabled(Boolean(worldPayload.contestWriteEnabled));
      setAuthRequired(false);
      setRuntimeLocked(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Stronghold signal unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const affordableCommitOptions = useMemo(
    () => (world?.player.attackCommitOptions ?? []).filter((option) => option.affordable),
    [world],
  );

  useEffect(() => {
    setSelectedSource((current) => {
      const next = { ...current };
      for (const stronghold of strongholds) {
        if (!next[stronghold.strongholdId] && stronghold.attackSourceTerritorySlugs[0]) {
          next[stronghold.strongholdId] = stronghold.attackSourceTerritorySlugs[0];
        }
      }
      return next;
    });
    setSelectedCommit((current) => {
      const next = { ...current };
      const defaultCommit = affordableCommitOptions.at(-1)?.influence;
      if (!defaultCommit) return next;
      for (const stronghold of strongholds) {
        if (!next[stronghold.strongholdId]) next[stronghold.strongholdId] = defaultCommit;
      }
      return next;
    });
  }, [strongholds, affordableCommitOptions]);

  async function runAction(
    busy: string,
    request: () => Promise<Response>,
    successMessage: string,
  ) {
    setBusyKey(busy);
    setError(null);
    setNotice(null);
    try {
      const response = await request();
      const payload = (await response.json()) as ActionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Grid command failed.');
      }
      setNotice(successMessage);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Grid command failed.');
    } finally {
      setBusyKey(null);
    }
  }

  async function loadHistory(contestId: string) {
    const nextOpen = !openHistory[contestId];
    setOpenHistory((current) => ({ ...current, [contestId]: nextOpen }));
    if (!nextOpen || historyByContest[contestId]) return;
    setBusyKey(`history:${contestId}`);
    try {
      const response = await fetch(`/api/grid/stronghold-contests/${encodeURIComponent(contestId)}/history`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as HistoryResponse;
      if (!response.ok || !payload.success || !payload.history) {
        throw new Error(payload.error ?? 'Battle history unavailable.');
      }
      setHistoryByContest((current) => ({ ...current, [contestId]: payload.history?.events ?? [] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Battle history unavailable.');
    } finally {
      setBusyKey(null);
    }
  }

  const walletInfluence = world?.player.wallet?.influence ?? 0;
  const joined = world?.player.joined ?? false;

  return (
    <main className="cq-grid-strongholds-shell">
      <div className="cq-grid-strongholds-grid" aria-hidden="true" />
      <div className="cq-grid-strongholds-wrap">
        <header className="cq-grid-strongholds-header">
          <div className="cq-grid-strongholds-topline">
            <Link href="/grid/return" className="cq-grid-strongholds-back">
              <ArrowLeft size={15} aria-hidden="true" /> RETURN BRIEF
            </Link>
            <button type="button" className="cq-grid-strongholds-refresh" onClick={() => void load()} disabled={loading || busyKey !== null}>
              <RefreshCw size={14} aria-hidden="true" /> REFRESH SIGNAL
            </button>
          </div>
          <div className="cq-grid-strongholds-kicker"><Radio size={13} aria-hidden="true" /> LIVE PVE // NPC STRONGHOLDS</div>
          <h1 className="cq-grid-strongholds-title">BREAK THE<br /><span>STRONGHOLDS.</span></h1>
          <p className="cq-grid-strongholds-intro">
            NPC factions hold strategic ground. Deploy Influence from an adjacent territory, roll server-side Signal Dice, and take the position before the garrison stops you.
          </p>
        </header>

        {loading ? (
          <section className="cq-grid-strongholds-state"><Loader2 className="cq-grid-strongholds-spin" size={28} /><strong>LOCATING STRONGHOLDS</strong></section>
        ) : authRequired ? (
          <section className="cq-grid-strongholds-state"><LockKeyhole size={30} /><h2>PLAYER AUTHENTICATION REQUIRED</h2><p>Sign in before opening a private combat channel.</p><Link href="/login" className="cq-grid-strongholds-primary">SIGN IN</Link></section>
        ) : runtimeLocked ? (
          <section className="cq-grid-strongholds-state"><Shield size={30} /><h2>STRONGHOLD SIGNAL STAGED</h2><p>The runtime is not enabled on this environment yet.</p></section>
        ) : error && !world ? (
          <section className="cq-grid-strongholds-state cq-grid-strongholds-error"><h2>STRONGHOLD SIGNAL LOST</h2><p>{error}</p></section>
        ) : (
          <>
            <section className="cq-grid-strongholds-metrics">
              <article><Castle size={19} /><span>LIVE STRONGHOLDS</span><strong>{strongholds.filter((item) => item.status === 'active').length}</strong></article>
              <article><Swords size={19} /><span>YOUR ACTIVE BATTLES</span><strong>{contests.length}</strong></article>
              <article><Flag size={19} /><span>YOUR INFLUENCE</span><strong>{walletInfluence}</strong></article>
              <article><Trophy size={19} /><span>CAPTURED NOW</span><strong>{strongholds.filter((item) => item.status === 'captured').length}</strong></article>
            </section>

            {notice ? <div className="cq-grid-strongholds-notice">{notice}</div> : null}
            {error ? <div className="cq-grid-strongholds-inline-error">{error}</div> : null}

            {contests.length > 0 ? (
              <section className="cq-grid-strongholds-section">
                <div className="cq-grid-strongholds-section-heading"><span>ACTIVE CHANNELS</span><h2>YOUR BATTLES</h2></div>
                <div className="cq-grid-strongholds-battle-grid">
                  {contests.map((contest) => (
                    <article key={contest.contestId} className="cq-grid-strongholds-battle">
                      <div className="cq-grid-strongholds-battle-head">
                        <div><span>ROUND {contest.roundNumber}</span><h3>{label(contest.strongholdId)}</h3></div>
                        <strong>ACTIVE</strong>
                      </div>
                      <div className="cq-grid-strongholds-versus">
                        <div><span>YOU</span><strong>{contest.attackerRemainingInfluence}</strong><small>Influence remaining</small></div>
                        <b>VS</b>
                        <div><span>{label(contest.factionId)}</span><strong>{contest.garrisonRemainingInfluence}</strong><small>Garrison remaining</small></div>
                      </div>
                      <p className="cq-grid-strongholds-route"><Route size={14} /> {label(contest.sourceTerritorySlug)} → {label(contest.targetTerritorySlug)}</p>
                      <div className="cq-grid-strongholds-actions">
                        <button
                          type="button"
                          className="cq-grid-strongholds-primary"
                          disabled={!contestWriteEnabled || busyKey !== null}
                          onClick={() => void runAction(
                            `round:${contest.contestId}`,
                            () => fetch(`/api/grid/stronghold-contests/${encodeURIComponent(contest.contestId)}/round`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ idempotencyKey: idempotency('pve-round') }),
                            }),
                            'Signal Dice resolved. Battle state refreshed.',
                          )}
                        >
                          {busyKey === `round:${contest.contestId}` ? <Loader2 size={15} className="cq-grid-strongholds-spin" /> : <Dices size={15} />} ROLL SIGNAL DICE
                        </button>
                        <button
                          type="button"
                          className="cq-grid-strongholds-secondary"
                          disabled={!contestWriteEnabled || busyKey !== null}
                          onClick={() => void runAction(
                            `withdraw:${contest.contestId}`,
                            () => fetch(`/api/grid/stronghold-contests/${encodeURIComponent(contest.contestId)}/withdraw`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ idempotencyKey: idempotency('pve-withdraw') }),
                            }),
                            'Retreat complete. Surviving Influence returned.',
                          )}
                        >
                          <Undo2 size={15} /> RETREAT
                        </button>
                      </div>
                      <button type="button" className="cq-grid-strongholds-history-toggle" onClick={() => void loadHistory(contest.contestId)} disabled={busyKey === `history:${contest.contestId}`}>
                        {busyKey === `history:${contest.contestId}` ? <Loader2 size={14} className="cq-grid-strongholds-spin" /> : <ChevronDown size={14} />} BATTLE LOG
                      </button>
                      {openHistory[contest.contestId] ? (
                        <BattleLog events={historyByContest[contest.contestId] ?? []} />
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="cq-grid-strongholds-section">
              <div className="cq-grid-strongholds-section-heading"><span>CITY DEFENSE NETWORK</span><h2>AVAILABLE STRONGHOLDS</h2></div>
              {!joined ? (
                <div className="cq-grid-strongholds-empty"><Shield size={26} /><h3>JOIN THE FOUNDING SEASON FIRST</h3><p>You need a seasonal wallet and territory before deploying against a stronghold.</p><Link href="/grid/onboarding" className="cq-grid-strongholds-primary">BEGIN ONBOARDING</Link></div>
              ) : strongholds.length === 0 ? (
                <div className="cq-grid-strongholds-empty"><Castle size={26} /><h3>NO ACTIVE STRONGHOLDS</h3><p>No NPC positions are currently broadcasting a contestable signal.</p></div>
              ) : (
                <div className="cq-grid-strongholds-card-grid">
                  {strongholds.map((stronghold) => {
                    const sourceOptions = stronghold.attackSourceTerritorySlugs;
                    const canAttack = stronghold.status === 'active' && stronghold.contestable && stronghold.targetNeutral && sourceOptions.length > 0 && affordableCommitOptions.length > 0;
                    return (
                      <article key={stronghold.strongholdId} className={`cq-grid-strongholds-card cq-grid-strongholds-card-${stronghold.status}`}>
                        <div className="cq-grid-strongholds-card-head">
                          <div><span>{stronghold.target.kind === 'pve-landmark' ? 'LANDMARK STRONGHOLD' : 'TERRITORY STRONGHOLD'}</span><h3>{stronghold.target.kind === 'pve-landmark' ? stronghold.target.landmark.name : stronghold.target.territoryName}</h3></div>
                          <strong>{stronghold.status.toUpperCase()}</strong>
                        </div>
                        <p className="cq-grid-strongholds-faction">{label(stronghold.factionId)} · {label(stronghold.target.districtSlug)}</p>
                        <div className="cq-grid-strongholds-garrison"><span>GARRISON</span><strong>{stronghold.garrisonInfluence}</strong><small>Influence</small></div>

                        {stronghold.status === 'captured' ? (
                          <div className="cq-grid-strongholds-card-note">Position already captured this season.</div>
                        ) : !stronghold.targetNeutral ? (
                          <div className="cq-grid-strongholds-card-note">Target is no longer neutral.</div>
                        ) : sourceOptions.length === 0 ? (
                          <div className="cq-grid-strongholds-card-note">Capture an adjacent territory to open an attack route.</div>
                        ) : (
                          <>
                            <label className="cq-grid-strongholds-field">
                              <span>DEPLOY FROM</span>
                              <select value={selectedSource[stronghold.strongholdId] ?? ''} onChange={(event) => setSelectedSource((current) => ({ ...current, [stronghold.strongholdId]: event.target.value }))}>
                                {sourceOptions.map((slug) => <option key={slug} value={slug}>{label(slug)}</option>)}
                              </select>
                            </label>
                            <label className="cq-grid-strongholds-field">
                              <span>COMMIT INFLUENCE</span>
                              <select value={selectedCommit[stronghold.strongholdId] ?? ''} onChange={(event) => setSelectedCommit((current) => ({ ...current, [stronghold.strongholdId]: Number(event.target.value) }))}>
                                {affordableCommitOptions.map((option) => <option key={option.influence} value={option.influence}>{option.influence} Influence // {option.dice} Dice</option>)}
                              </select>
                            </label>
                            <button
                              type="button"
                              className="cq-grid-strongholds-primary cq-grid-strongholds-deploy"
                              disabled={!canAttack || !contestWriteEnabled || busyKey !== null}
                              onClick={() => void runAction(
                                `start:${stronghold.strongholdId}`,
                                () => fetch(`/api/grid/strongholds/${encodeURIComponent(stronghold.strongholdId)}/contest`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    sourceTerritorySlug: selectedSource[stronghold.strongholdId],
                                    attackerCommittedInfluence: selectedCommit[stronghold.strongholdId],
                                    idempotencyKey: idempotency('pve-start'),
                                  }),
                                }),
                                'Stronghold assault launched. Battle channel opened.',
                              )}
                            >
                              {busyKey === `start:${stronghold.strongholdId}` ? <Loader2 size={15} className="cq-grid-strongholds-spin" /> : <Swords size={15} />} DEPLOY AGAINST STRONGHOLD
                            </button>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
