'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Crown,
  Loader2,
  LockKeyhole,
  Radio,
  RefreshCw,
  Shield,
  Swords,
  Users,
  Zap,
} from 'lucide-react';

interface AllianceDirectoryEntry {
  allianceId: string;
  slug: string;
  name: string;
  activeMemberCount: number;
  isCurrent: boolean;
}

interface CurrentAlliance {
  allianceId: string;
  slug: string;
  name: string;
  role: 'leader' | 'member';
  influencePool: number;
  revision: number;
  activeMemberCount: number;
  joinedAt: string;
}

interface AllianceRules {
  maxMembers: number;
  leaveCooldownSeconds: number;
  influencePoolCap: number;
  baseUpkeepInfluencePerTick: number;
  memberUpkeepInfluencePerTick: number;
  disconnectedComponentUpkeepInfluencePerTick: number;
  largeAllianceThreshold: number;
  largeAllianceSurchargeInfluencePerMemberPerTick: number;
}

interface AllianceDirectory {
  seasonId: string;
  alliances: AllianceDirectoryEntry[];
  current: CurrentAlliance | null;
}

interface DirectoryResponse {
  success: boolean;
  directory?: AllianceDirectory;
  rules?: AllianceRules;
  error?: string;
}

interface MutationResponse {
  success: boolean;
  error?: string;
}

interface ContributionResponse extends MutationResponse {
  contribution?: {
    acceptedInfluence: number;
    poolInfluenceAfter: number;
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function commandKey(scope: string): string {
  const storageKey = 'grid:alliance:' + scope + ':idempotency';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:alliance:' + scope + ':idempotency');
}

function cooldownLabel(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  return `${Math.ceil(seconds / 60)}m`;
}

export default function GridAlliancesClient() {
  const [directory, setDirectory] = useState<AllianceDirectory | null>(null);
  const [rules, setRules] = useState<AllianceRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [runtimeLocked, setRuntimeLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [contribution, setContribution] = useState('25');
  const [confirmDisband, setConfirmDisband] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/grid/alliances', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthRequired(true);
        setDirectory(null);
        setRules(null);
        return;
      }
      if (response.status === 404) {
        setRuntimeLocked(true);
        setDirectory(null);
        setRules(null);
        return;
      }

      const payload = (await response.json()) as DirectoryResponse;
      if (!response.ok || !payload.success || !payload.directory || !payload.rules) {
        throw new Error(payload.error ?? 'Alliance network unavailable.');
      }

      setAuthRequired(false);
      setRuntimeLocked(false);
      setDirectory(payload.directory);
      setRules(payload.rules);
      setConfirmDisband(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Alliance network unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const current = directory?.current ?? null;
  const mutate = useCallback(
    async (
      action: string,
      url: string,
      body?: Record<string, unknown>,
      idempotencyScope?: string,
      successMessage?: string,
    ) => {
      setBusy(action);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const payload = (await response.json().catch(() => ({}))) as MutationResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Alliance command failed.');
        }
        if (idempotencyScope) clearCommandKey(idempotencyScope);
        setNotice(successMessage ?? 'Alliance state updated.');
        await loadDirectory();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Alliance command failed.');
      } finally {
        setBusy(null);
      }
    },
    [loadDirectory],
  );

  const createAlliance = () => {
    const cleanName = name.trim();
    const cleanSlug = slugify(slugTouched ? slug : cleanName);
    void mutate(
      'create',
      '/api/grid/alliances',
      { name: cleanName, slug: cleanSlug },
      undefined,
      `${cleanName || 'Alliance'} is online.`,
    );
  };

  const joinAlliance = (alliance: AllianceDirectoryEntry) => {
    void mutate(
      `join:${alliance.allianceId}`,
      `/api/grid/alliances/${encodeURIComponent(alliance.allianceId)}/join`,
      undefined,
      undefined,
      `Joined ${alliance.name}.`,
    );
  };

  const leaveAlliance = () => {
    if (!current) return;
    void mutate(
      'leave',
      `/api/grid/alliances/${encodeURIComponent(current.allianceId)}/leave`,
      undefined,
      undefined,
      'Alliance membership closed. Cooldown is now active.',
    );
  };

  const contributeInfluence = async () => {
    if (!current) return;
    const amount = Number(contribution);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError('Enter a whole-number Influence contribution greater than zero.');
      return;
    }

    const scope = 'contribute:' + current.allianceId + ':' + amount;
    setBusy('contribute');
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/grid/alliances/${encodeURIComponent(current.allianceId)}/contribute`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requestedInfluence: amount,
            idempotencyKey: commandKey('contribute:' + current.allianceId + ':' + amount),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as ContributionResponse;
      if (!response.ok || !payload.success || !payload.contribution) {
        throw new Error(payload.error ?? 'Influence contribution failed.');
      }

      clearCommandKey(scope);
      setNotice(
        `${payload.contribution.acceptedInfluence} Influence accepted into the Alliance pool · ${payload.contribution.poolInfluenceAfter} pooled now.`,
      );
      await loadDirectory();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Influence contribution failed.',
      );
    } finally {
      setBusy(null);
    }
  };

  const disbandAlliance = () => {
    if (!current || current.role !== 'leader') return;
    const scope = 'disband:' + current.allianceId;
    void mutate(
      'disband',
      `/api/grid/alliances/${encodeURIComponent(current.allianceId)}/disband`,
      { idempotencyKey: commandKey('disband:' + current.allianceId) },
      scope,
      `${current.name} was disbanded.`,
    );
  };

  const poolPercent =
    current && rules && rules.influencePoolCap > 0
      ? Math.min(100, Math.round((current.influencePool / rules.influencePoolCap) * 100))
      : 0;

  return (
    <div className="cq-grid-alliance">
      <div className="cq-grid-alliance__grid" aria-hidden="true" />
      <main className="cq-grid-alliance__shell">
        <header className="cq-grid-alliance__header">
          <Link href="/grid" className="cq-grid-alliance__back">
            <ArrowLeft size={14} aria-hidden="true" />
            THE GRID
          </Link>

          <div className="cq-grid-alliance__hero-row">
            <div>
              <div className="cq-grid-alliance__eyebrow">
                <Radio size={13} aria-hidden="true" />
                CANTON // FOUNDING SEASON // STRATEGIC PACTS
              </div>
              <h1 className="cq-grid-alliance__title">ALLIANCES</h1>
              <p className="cq-grid-alliance__lede">
                Coordinate territory pressure, reinforce the same streets, and
                fund a shared Influence reserve without merging individual scores.
              </p>
            </div>
            <div className="cq-grid-alliance__principle">
              <Shield size={18} aria-hidden="true" />
              <strong>Your score stays yours.</strong>
              <span>Alliance means coordination — not shared ranking.</span>
            </div>
          </div>
        </header>

        <div className="cq-grid-alliance__messages" aria-live="polite">
          {error ? (
            <div className="cq-grid-alliance__message cq-grid-alliance__message--error">
              <CircleAlert size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {notice ? (
            <div className="cq-grid-alliance__message cq-grid-alliance__message--success">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{notice}</span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <section className="cq-grid-alliance__state">
            <Loader2 size={20} className="cq-grid-alliance__spin" aria-hidden="true" />
            <strong>SYNCING ALLIANCE NETWORK</strong>
          </section>
        ) : authRequired ? (
          <section className="cq-grid-alliance__state cq-grid-alliance__state--card">
            <LockKeyhole size={30} aria-hidden="true" />
            <h2>PLAYER AUTHENTICATION REQUIRED</h2>
            <p>Sign in before entering the Founding Season Alliance network.</p>
            <Link href="/login" className="cq-grid-alliance__primary-action">
              SIGN IN
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : runtimeLocked ? (
          <section className="cq-grid-alliance__state cq-grid-alliance__state--card">
            <Radio size={30} aria-hidden="true" />
            <h2>ALLIANCE NETWORK STAGED</h2>
            <p>The player surface is built, but Alliance runtime access is not enabled here yet.</p>
          </section>
        ) : directory && rules ? (
          <>
            {current ? (
              <section className="cq-grid-alliance__current">
                <div className="cq-grid-alliance__section-heading">
                  <div>
                    <span className="cq-grid-alliance__kicker">YOUR ACTIVE ALLIANCE</span>
                    <h2>{current.name}</h2>
                  </div>
                  <span className="cq-grid-alliance__role">
                    {current.role === 'leader' ? <Crown size={14} aria-hidden="true" /> : <Shield size={14} aria-hidden="true" />}
                    {current.role.toUpperCase()}
                  </span>
                </div>

                <div className="cq-grid-alliance__current-grid">
                  <article className="cq-grid-alliance__pool-card">
                    <div className="cq-grid-alliance__pool-topline">
                      <span>POOLED INFLUENCE</span>
                      <strong>{current.influencePool} / {rules.influencePoolCap}</strong>
                    </div>
                    <div className="cq-grid-alliance__meter" aria-label={`${poolPercent}% of Alliance Influence capacity`}>
                      <span style={{ width: `${poolPercent}%` }} />
                    </div>
                    <p>
                      This reserve pays coordination upkeep. It is Alliance state,
                      not a personal wallet.
                    </p>

                    <div className="cq-grid-alliance__contribute">
                      <label htmlFor="alliance-contribution">Influence to commit</label>
                      <div className="cq-grid-alliance__input-action">
                        <input
                          id="alliance-contribution"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={contribution}
                          onChange={(event) => setContribution(event.target.value)}
                          disabled={busy !== null}
                        />
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void contributeInfluence()}
                          className="cq-grid-alliance__primary-action"
                        >
                          {busy === 'contribute' ? <Loader2 size={16} className="cq-grid-alliance__spin" /> : <Zap size={16} />}
                          CONTRIBUTE INFLUENCE
                        </button>
                      </div>
                    </div>
                  </article>

                  <aside className="cq-grid-alliance__facts">
                    <div>
                      <Users size={18} aria-hidden="true" />
                      <strong>{current.activeMemberCount} / {rules.maxMembers}</strong>
                      <span>ACTIVE PLAYERS</span>
                    </div>
                    <div>
                      <RefreshCw size={18} aria-hidden="true" />
                      <strong>{cooldownLabel(rules.leaveCooldownSeconds)}</strong>
                      <span>LEAVE COOLDOWN</span>
                    </div>
                    <div>
                      <Swords size={18} aria-hidden="true" />
                      <strong>REV {current.revision}</strong>
                      <span>ALLIANCE STATE</span>
                    </div>
                  </aside>
                </div>

                <div className="cq-grid-alliance__membership-actions">
                  {current.role === 'leader' ? (
                    confirmDisband ? (
                      <div className="cq-grid-alliance__danger-confirm">
                        <div>
                          <strong>DISBAND {current.name.toUpperCase()}?</strong>
                          <p>
                            Every member receives the leave cooldown and pooled Influence is not refunded.
                          </p>
                        </div>
                        <div className="cq-grid-alliance__danger-buttons">
                          <button type="button" disabled={busy !== null} onClick={() => setConfirmDisband(false)}>
                            KEEP ALLIANCE
                          </button>
                          <button type="button" disabled={busy !== null} onClick={disbandAlliance} className="cq-grid-alliance__danger-action">
                            {busy === 'disband' ? <Loader2 size={15} className="cq-grid-alliance__spin" /> : null}
                            DISBAND ALLIANCE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => setConfirmDisband(true)} className="cq-grid-alliance__quiet-danger">
                        DISBAND ALLIANCE
                      </button>
                    )
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={leaveAlliance} className="cq-grid-alliance__quiet-danger">
                      {busy === 'leave' ? <Loader2 size={15} className="cq-grid-alliance__spin" /> : null}
                      LEAVE ALLIANCE
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="cq-grid-alliance__create">
                <div className="cq-grid-alliance__section-heading">
                  <div>
                    <span className="cq-grid-alliance__kicker">NO ACTIVE ALLIANCE</span>
                    <h2>FORM YOUR OWN PACT</h2>
                  </div>
                </div>
                <p className="cq-grid-alliance__section-copy">
                  Build a small strategic network for Canton. Founding Season caps Alliances at {rules.maxMembers} players.
                </p>
                <div className="cq-grid-alliance__form-grid">
                  <label>
                    Alliance name
                    <input
                      value={name}
                      maxLength={48}
                      placeholder="North Market Pact"
                      onChange={(event) => {
                        const nextName = event.target.value;
                        setName(nextName);
                        if (!slugTouched) setSlug(slugify(nextName));
                      }}
                    />
                  </label>
                  <label>
                    Signal slug
                    <input
                      value={slug}
                      maxLength={32}
                      placeholder="north-market-pact"
                      onChange={(event) => {
                        setSlugTouched(true);
                        setSlug(slugify(event.target.value));
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy !== null || name.trim().length < 3 || slugify(slug).length < 3}
                  onClick={createAlliance}
                  className="cq-grid-alliance__primary-action"
                >
                  {busy === 'create' ? <Loader2 size={16} className="cq-grid-alliance__spin" /> : <Shield size={16} />}
                  CREATE ALLIANCE
                </button>
              </section>
            )}

            <section className="cq-grid-alliance__directory">
              <div className="cq-grid-alliance__section-heading">
                <div>
                  <span className="cq-grid-alliance__kicker">CANTON NETWORK</span>
                  <h2>ACTIVE ALLIANCES</h2>
                </div>
                <span className="cq-grid-alliance__count">{directory.alliances.length} ONLINE</span>
              </div>

              {directory.alliances.length === 0 ? (
                <div className="cq-grid-alliance__empty">
                  No Alliance signals are active yet. You can establish the first one.
                </div>
              ) : (
                <div className="cq-grid-alliance__cards">
                  {directory.alliances.map((alliance) => (
                    <article key={alliance.allianceId} className={alliance.isCurrent ? 'cq-grid-alliance__card cq-grid-alliance__card--current' : 'cq-grid-alliance__card'}>
                      <div>
                        <span className="cq-grid-alliance__slug">/{alliance.slug}</span>
                        <h3>{alliance.name}</h3>
                        <p>{alliance.activeMemberCount} active player{alliance.activeMemberCount === 1 ? '' : 's'}</p>
                      </div>
                      {alliance.isCurrent ? (
                        <span className="cq-grid-alliance__current-badge">YOUR ALLIANCE</span>
                      ) : !current ? (
                        <button
                          type="button"
                          disabled={busy !== null || alliance.activeMemberCount >= rules.maxMembers}
                          onClick={() => joinAlliance(alliance)}
                          className="cq-grid-alliance__join-action"
                        >
                          {busy === `join:${alliance.allianceId}` ? <Loader2 size={15} className="cq-grid-alliance__spin" /> : null}
                          JOIN ALLIANCE
                        </button>
                      ) : (
                        <span className="cq-grid-alliance__locked-badge">ONE PACT AT A TIME</span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
