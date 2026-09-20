'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { GridBuilderOsSnapshot } from '@/lib/grid/ops/grid-builder-os';

type LoadState = 'loading' | 'ready' | 'locked' | 'error';

type BossMeta = {
  branch: string;
  environment: string;
  dirtyFiles: number;
  coordinationWarnings: number;
  boardroom: {
    counts: Record<string, number>;
    active: number;
    blocked: number;
    rejected: number;
  };
  lanes: Array<{
    lane: string;
    owner: string;
    task: string;
    branch: string;
    claimedAt: string;
    heartbeatAt: string;
    state: GridBuilderOsSnapshot['workers'][number]['state'];
  }>;
  commits: Array<{
    sha: string;
    at: string;
    author: string;
    summary: string;
  }>;
};

function ageLabel(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'now';
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function runLabel(status: GridBuilderOsSnapshot['run']['status']): string {
  if (status === 'working') return 'BUILDING';
  if (status === 'finished') return 'COMPLETE';
  if (status === 'needs_attention') return 'CHECK';
  return 'IDLE';
}
function healthLabel(status: GridBuilderOsSnapshot['crewHealth'][number]['status']): string {
  if (status === 'ready') return 'READY';
  if (status === 'installed') return 'CHECK';
  if (status === 'unavailable') return 'OFFLINE';
  return 'ATTN';
}

function laneLabel(state: GridBuilderOsSnapshot['workers'][number]['state']): string {
  if (state === 'working') return 'ACTIVE';
  if (state === 'checkpoint') return 'CHECKPOINT';
  return 'ATTN';
}

export default function GridBuilderClient() {
  const [snapshot, setSnapshot] = useState<GridBuilderOsSnapshot | null>(null);
  const [meta, setMeta] = useState<BossMeta | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [healthStarting, setHealthStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/grid-builder/status', { cache: 'no-store' });
      if (response.status === 401) {
        setLoadState('locked');
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to read Builder OS.');
      setSnapshot(body.snapshot);
      setMeta(body.meta ?? null);
      setLoadState('ready');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read Builder OS.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    const poll = async () => {
      await load();
      if (!cancelled) timeout = window.setTimeout(() => void poll(), 10000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [load]);

  const startCycle = useCallback(async () => {
    setStarting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/grid-builder/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-cycle' }),
      });
      const body = await response.json();
      if (!response.ok) {
        const details = Array.isArray(body.reasons) ? ` ${body.reasons.join(' ')}` : '';
        throw new Error((body.error || 'Unable to start the crew.') + details);
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start the crew.');
    } finally {
      setStarting(false);
    }
  }, [load]);

  const refreshHealth = useCallback(async () => {
    setHealthStarting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/grid-builder/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh-health' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to check the crew.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to check the crew.');
    } finally {
      setHealthStarting(false);
    }
  }, [load]);

  const progressStyle = useMemo(() => ({
    '--cq-progress': `${snapshot?.overall.percent ?? 0}%`,
  } as CSSProperties), [snapshot?.overall.percent]);

  if (loadState === 'locked') {
    return (
      <main className="cq-art-state">
        <h1>Empire Panel locked</h1>
        <p>Unlock Game Master access, then return to the command center.</p>
        <Link href="/admin">Open Game Master</Link>
      </main>
    );
  }
  if (!snapshot) {
    return (
      <main className="cq-art-state">
        <h1>{loadState === 'loading' ? 'Opening the Empire Panel…' : 'Empire Panel offline'}</h1>
        {error && <p>{error}</p>}
        {loadState === 'error' && <button onClick={() => void load()}>Try again</button>}
      </main>
    );
  }

  const runWorking = snapshot.run.status === 'working';
  const healthWorking = snapshot.crewHealthRun.status === 'working';
  const buttonDisabled = starting || runWorking || !snapshot.controls.canStartCycle;
  const doneCount = meta?.boardroom.counts.DONE;
  const activeCount = meta?.boardroom.active;
  const blockedCount = meta?.boardroom.blocked;
  const rejectedCount = meta?.boardroom.rejected;
  const readyCrew = snapshot.crewHealth.filter((item) => item.status === 'ready').length;
  const nextTask = snapshot.recommendations[0]?.title ?? '';
  const lanes = meta?.lanes.slice(0, 3) ?? [];
  const commits = meta?.commits.slice(0, 5) ?? [];

  const healthValues = [
    `${readyCrew}/${snapshot.crewHealth.length} READY`,
    runLabel(snapshot.run.status),
    '',
    meta ? (meta.dirtyFiles === 0 ? 'CLEAN' : `${meta.dirtyFiles} CHANGES`) : '',
    meta ? (meta.coordinationWarnings === 0 ? 'CLEAR' : `${meta.coordinationWarnings} WARN`) : '',
  ];

  const loopValues = [
    snapshot.recommendations.length ? 'READY' : 'CLEAR',
    runLabel(snapshot.run.status),
    '',
    snapshot.overall.readyToCombine ? `${snapshot.overall.readyToCombine} READY` : 'CLEAR',
    nextTask,
  ];
  return (
    <main className="cq-builder-shell cq-builder-command-center cq-art-shell">
      {error && <div className="cq-art-error">{error}</div>}
      <div className="cq-art-scroll">
        <section className="cq-artboard" style={progressStyle} aria-label="The Grid Empire Panel">
          <Image
            className="cq-artboard-image"
            src="/grid/boss-panel/empire-panel-approved.png"
            alt=""
            width="1536"
            height="1024"
            unoptimized
            draggable={false}
          />

          <nav className="cq-art-hotnav" aria-label="Empire Panel navigation">
            <a className="cq-hot cq-hot-command" href="#command-center" aria-label="Command Center" />
            <Link className="cq-hot cq-hot-live" href="/admin/live" aria-label="Live Operations" />
            <a className="cq-hot cq-hot-crew" href="#agent-crew" aria-label="Agent Crew" />
            <Link className="cq-hot cq-hot-board" href="/admin/grid" aria-label="Grid Board" />
            <a className="cq-hot cq-hot-worktrees" href="#active-lanes" aria-label="Worktrees" />
            <a className="cq-hot cq-hot-commits" href="#latest-commits" aria-label="Commits" />
            <a className="cq-hot cq-hot-tests" href="#test-build" aria-label="Tests and Build" />
            <a className="cq-hot cq-hot-health" href="#system-health" aria-label="System Health" />
            <Link className="cq-hot cq-hot-settings" href="/admin" aria-label="Settings" />
          </nav>
          <div id="command-center" className="cq-art-top-field cq-art-grid-status">
            <span>{snapshot.overall.percent}% · {runLabel(snapshot.run.status)}</span>
            {snapshot.needsYou.length > 0 && <i>{snapshot.needsYou.length}</i>}
          </div>
          <div className="cq-art-top-field cq-art-branch" title={meta?.branch ?? ''}>
            {meta?.branch ?? ''}
          </div>
          <div className="cq-art-top-field cq-art-environment">
            {meta?.environment?.toUpperCase() ?? ''}
          </div>
          <div className="cq-art-top-field cq-art-updated">
            {timeLabel(snapshot.generatedAt)}
          </div>
          <button
            className="cq-art-build-hotspot"
            aria-label="Build the Grid"
            disabled={buttonDisabled}
            onClick={() => void startCycle()}
          >
            <span>{starting ? 'STARTING…' : runWorking ? 'BUILDING…' : ''}</span>
          </button>

          <section className="cq-art-overview" aria-label="Grid Overview">
            <strong>{doneCount ?? ''}</strong>
            <strong>{activeCount ?? ''}</strong>
            <strong>{blockedCount ?? ''}</strong>
            <strong>{rejectedCount ?? ''}</strong>
          </section>
          <section id="agent-crew" className="cq-art-agent-layer" aria-label="Agent Crew">
            {snapshot.crewHealth.map((agent) => (
              <article
                key={agent.name}
                className={`cq-art-agent cq-art-agent--${agent.name} is-${agent.status}`}
                title={`${agent.label}: ${agent.detail}`}
              >
                <span className="cq-art-agent-dot" />
                <b>{healthLabel(agent.status)}</b>
                <em>{agent.version ?? ''}</em>
              </article>
            ))}
          </section>
          <button
            className="cq-art-crew-check"
            onClick={() => void refreshHealth()}
            disabled={healthStarting || healthWorking}
            aria-label="Check crew health now"
          >
            {healthStarting || healthWorking ? 'CHECKING' : 'CHECK CREW'}
          </button>

          <section id="system-health" className="cq-art-health-values" aria-label="System Health">
            {healthValues.map((value, index) => (
              <span key={index} className={value ? 'has-value' : ''}>{value}</span>
            ))}
          </section>
          <section className="cq-art-loop-values" aria-label="Playable Loop">
            {loopValues.map((value, index) => (
              <span key={index} title={value}>{value}</span>
            ))}
          </section>

          <section id="active-lanes" className="cq-art-lanes" aria-label="Active Lanes">
            {lanes.map((lane) => (
              <div className="cq-art-lane-row" key={lane.lane}>
                <span title={lane.lane}>{lane.lane}</span>
                <span title={lane.owner}>{lane.owner}</span>
                <span title={lane.task}>{lane.task}</span>
                <span className={`is-${lane.state}`}>{laneLabel(lane.state)}</span>
                <span>{ageLabel(lane.claimedAt)}</span>
              </div>
            ))}
          </section>
          <section className="cq-art-activity" aria-label="Recent Activity">
            {commits.slice(0, 3).map((commit) => (
              <div className="cq-art-activity-row" key={commit.sha}>
                <span>{timeLabel(commit.at)}</span>
                <span title={commit.author}>{commit.author}</span>
                <span title={commit.summary}>{commit.summary}</span>
              </div>
            ))}
          </section>

          <section id="latest-commits" className="cq-art-commits" aria-label="Latest Commits">
            {commits.slice(0, 4).map((commit) => (
              <div className="cq-art-commit-row" key={commit.sha}>
                <span>{commit.sha}</span>
                <span title={commit.author}>{commit.author}</span>
                <span title={commit.summary}>{commit.summary}</span>
                <span>{ageLabel(commit.at)}</span>
              </div>
            ))}
          </section>
          <section id="test-build" className="cq-art-test-build" aria-label="Test and Build">
            <button
              className="cq-art-disabled-hotspot"
              type="button"
              disabled
              aria-label="Run checks unavailable"
            />
          </section>

          <section className="cq-art-tower-values" aria-label="Control Tower">
            <span>{snapshot.controls.canStartCycle ? 'CLEAR' : 'CHECK'}</span>
            <span>{meta ? String(meta.lanes.length) : ''}</span>
            <span>{String(snapshot.overall.readyToCombine)}</span>
            <span>{meta ? (meta.coordinationWarnings === 0 ? 'CLEAR' : 'WARN') : ''}</span>
            <span>{meta ? (meta.coordinationWarnings === 0 ? 'CLEAR' : 'ATTN') : ''}</span>
          </section>
        </section>
      </div>
      <section className="cq-art-mobile-summary" aria-label="Live Empire Panel summary">
        <div>
          <strong>{snapshot.overall.percent}%</strong>
          <span>Grid built</span>
        </div>
        <div>
          <strong>{snapshot.playableLoop.score}/100</strong>
          <span>Playable loop</span>
        </div>
        <div>
          <strong>{meta?.lanes.length ?? ''}</strong>
          <span>Live lanes</span>
        </div>
        <button disabled={buttonDisabled} onClick={() => void startCycle()}>
          {runWorking ? 'Crew building…' : 'Build the Grid'}
        </button>
      </section>
    </main>
  );
}
