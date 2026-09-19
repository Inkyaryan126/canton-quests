'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { GridBuilderOsSnapshot } from '@/lib/grid/ops/grid-builder-os';

type LoadState = 'loading' | 'ready' | 'locked' | 'error';

function ageLabel(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'just now';
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stateLabel(state: GridBuilderOsSnapshot['workers'][number]['state']): string {
  if (state === 'working') return 'Working';
  if (state === 'checkpoint') return 'At checkpoint';
  return 'Needs attention';
}

function healthLabel(status: GridBuilderOsSnapshot['crewHealth'][number]['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'installed') return 'Installed';
  if (status === 'unavailable') return 'Unavailable';
  return 'Needs attention';
}

export default function GridBuilderClient() {
  const [snapshot, setSnapshot] = useState<GridBuilderOsSnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

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
      if (!cancelled) timeout = window.setTimeout(() => void poll(), 30000);
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

  const progressStyle = useMemo(() => ({
    '--cq-builder-progress': `${snapshot?.overall.percent ?? 0}%`,
  } as CSSProperties), [snapshot?.overall.percent]);

  if (loadState === 'locked') {
    return (
      <main className="cq-builder-shell cq-builder-shell--center">
        <section className="cq-builder-lock">
          <span className="cq-builder-kicker">THE GRID / EMPIRE PANEL</span>
          <h1>Command access required</h1>
          <p>Unlock the Game Master area first, then return here.</p>
          <Link className="cq-builder-button cq-builder-button--secondary" href="/admin">Open Game Master</Link>
        </section>
      </main>
    );
  }

  if (loadState === 'loading' && !snapshot) {
    return <main className="cq-builder-shell cq-builder-shell--center"><p className="cq-builder-loading">Opening the Empire Panel…</p></main>;
  }

  if (!snapshot) {
    return (
      <main className="cq-builder-shell cq-builder-shell--center">
        <section className="cq-builder-lock">
          <h1>Empire Panel is offline</h1>
          <p>{error || 'No build state is available yet.'}</p>
          <button className="cq-builder-button cq-builder-button--secondary" onClick={() => void load()}>Try again</button>
        </section>
      </main>
    );
  }

  const runWorking = snapshot.run.status === 'working';
  const buttonDisabled = starting || runWorking || !snapshot.controls.canStartCycle;

  return (
    <main className="cq-builder-shell">
      <header className="cq-builder-topbar">
        <div>
          <span className="cq-builder-kicker">THE GRID / EMPIRE PANEL</span>
          <h1>Build the empire. Command the crew.</h1>
          <p>One gold command panel controls the builders, shows what is proven, and interrupts you only when a real decision is needed.</p>
        </div>
        <div className="cq-builder-live">
          <span className={`cq-builder-live-dot ${runWorking ? 'is-working' : ''}`} />
          {runWorking ? 'Crew working' : 'System ready'}
        </div>
      </header>

      {error && <div className="cq-builder-alert cq-builder-alert--error">{error}</div>}

      <section className="cq-builder-hero">
        <div className="cq-builder-progress-ring" style={progressStyle}>
          <div className="cq-builder-progress-core">
            <strong>{snapshot.overall.percent}%</strong>
            <span>built</span>
          </div>
        </div>
        <div className="cq-builder-hero-copy">
          <span className="cq-builder-eyebrow">GRID CREATION</span>
          <h2>{snapshot.overall.completed} of {snapshot.overall.total} major systems combined</h2>
          <p>{snapshot.overall.readyToCombine > 0
            ? `${snapshot.overall.readyToCombine} more ${snapshot.overall.readyToCombine === 1 ? 'system is' : 'systems are'} ready to combine.`
            : 'Builders are moving the next systems toward safe checkpoints.'}</p>
          <button className="cq-builder-button cq-builder-button--primary" disabled={buttonDisabled} onClick={() => void startCycle()}>
            {starting ? 'STARTING CREW…' : runWorking ? 'CREW IS BUILDING…' : 'BUILD THE GRID'}
          </button>
          {!snapshot.controls.canStartCycle && snapshot.controls.reasons.length > 0 && (
            <p className="cq-builder-button-note">{snapshot.controls.reasons[0]}</p>
          )}
        </div>
        <aside className="cq-builder-loop-card">
          <span>Playable loop</span>
          <strong>{snapshot.playableLoop.score}/100</strong>
          <em>{snapshot.playableLoop.status}</em>
          <p>{snapshot.playableLoop.brokenLink
            ? `Weakest link: ${snapshot.playableLoop.brokenLink}`
            : 'The full player loop has no detected broken link.'}</p>
        </aside>
      </section>

      <section className="cq-builder-health-section">
        <div className="cq-builder-health-heading">
          <div>
            <span className="cq-builder-eyebrow">CREW HEALTH</span>
            <h2>Three builders. One command chain.</h2>
          </div>
          <p>Empire Panel prefers your newest local NVM toolchain instead of stale system-wide copies.</p>
        </div>
        <div className="cq-builder-health-grid">
          {snapshot.crewHealth.map((agent) => (
            <article className={`cq-builder-health-card is-${agent.status}`} key={agent.name}>
              <div className="cq-builder-health-topline">
                <div>
                  <strong>{agent.label}</strong>
                  <span>{agent.role}</span>
                </div>
                <span className="cq-builder-health-status">
                  <i />
                  {healthLabel(agent.status)}
                </span>
              </div>
              <div className="cq-builder-health-version">
                <span>Version</span>
                <b>{agent.version ?? 'Not found'}</b>
              </div>
              <p>{agent.detail}</p>
              <footer>{agent.checkedAt ? `Live checked ${ageLabel(agent.checkedAt)}` : 'Awaiting live model check'}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="cq-builder-section">
        <div className="cq-builder-section-heading">
          <div>
            <span className="cq-builder-eyebrow">THE CREW</span>
            <h2>Who is building what</h2>
          </div>
          <button className="cq-builder-text-button" onClick={() => void load()}>Refresh now</button>
        </div>
        <div className="cq-builder-workers">
          {snapshot.workers.length === 0 ? (
            <div className="cq-builder-empty">No development lanes are active. Press BUILD THE GRID when the system is ready.</div>
          ) : snapshot.workers.map((worker) => (
            <article className={`cq-builder-worker is-${worker.state}`} key={worker.lane}>
              <div className="cq-builder-worker-head">
                <div className="cq-builder-avatar">{worker.role.slice(0, 1)}</div>
                <div>
                  <strong>{worker.role}</strong>
                  <span>{stateLabel(worker.state)}</span>
                </div>
              </div>
              <p>{worker.task}</p>
              <footer>
                <span>Updated {ageLabel(worker.lastUpdate)}</span>
                <span>{worker.dirtyFiles > 0 ? `${worker.dirtyFiles} files in motion` : 'Clean checkpoint'}</span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <div className="cq-builder-two-column">
        <section className="cq-builder-panel">
          <span className="cq-builder-eyebrow">NEXT UP</span>
          <h2>Best work to do next</h2>
          {snapshot.recommendations.length === 0 ? (
            <p className="cq-builder-muted">No safe new work is recommended right now. The crew should finish or combine what is already moving.</p>
          ) : (
            <div className="cq-builder-stack">
              {snapshot.recommendations.map((item, index) => (
                <article className="cq-builder-next" key={item.id}>
                  <span className="cq-builder-number">{index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <em>{item.action}</em>
                    <p>{item.whyNow}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={`cq-builder-panel ${snapshot.needsYou.length ? 'cq-builder-panel--attention' : 'cq-builder-panel--clear'}`}>
          <span className="cq-builder-eyebrow">NEEDS YOU</span>
          <h2>{snapshot.needsYou.length ? 'A human decision is needed' : 'Nothing needed from you'}</h2>
          {snapshot.needsYou.length ? (
            <div className="cq-builder-stack">
              {snapshot.needsYou.map((item) => <p className="cq-builder-need" key={item}>{item}</p>)}
            </div>
          ) : (
            <p className="cq-builder-clear-message">The builders can continue safely without interrupting you.</p>
          )}
        </section>
      </div>

      <section className="cq-builder-section">
        <span className="cq-builder-eyebrow">WHAT THE BUTTON DOES</span>
        <h2>One click, three simple steps</h2>
        <div className="cq-builder-steps">
          <article><b>1</b><strong>Check everything</strong><p>Builder OS checks current work, conflicts, progress, and what matters most next.</p></article>
          <article><b>2</b><strong>Put the crew to work</strong><p>A lead coordinates safe isolated builders and replaces a failed CLI with a healthy backup.</p></article>
          <article><b>3</b><strong>Combine only proven work</strong><p>Finished work must pass its checkpoint before it can be combined. Production stays protected.</p></article>
        </div>
      </section>

      <section className="cq-builder-section">
        <span className="cq-builder-eyebrow">RECENT PROGRESS</span>
        <h2>What changed lately</h2>
        <div className="cq-builder-activity">
          {snapshot.recentActivity.map((item) => (
            <article key={item.commit}>
              <span>{item.commit}</span>
              <strong>{item.summary}</strong>
              <time>{new Date(item.at).toLocaleString()}</time>
            </article>
          ))}
        </div>
      </section>

      <footer className="cq-builder-footer">
        <span>Last checked {new Date(snapshot.generatedAt).toLocaleTimeString()}</span>
        <span>Builder OS never promotes directly to production.</span>
      </footer>
    </main>
  );
}

