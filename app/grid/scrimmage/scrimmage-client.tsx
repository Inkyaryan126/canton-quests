'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Crown,
  Flag,
  LogIn,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Skull,
  Swords,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  GridScrimmageCombatantState,
  GridScrimmageState,
} from '@/lib/grid/core/scrimmage-types';

interface GridScrimmageViewer {
  playerId: string;
  role: 'host' | 'participant';
}

interface GridScrimmageEnvelope {
  success: true;
  scrimmage: GridScrimmageState;
  viewer?: GridScrimmageViewer;
}

interface GridScrimmageErrorEnvelope {
  success: false;
  error?: string;
}

async function requestScrimmage(
  url: string,
  init?: RequestInit,
): Promise<GridScrimmageEnvelope> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as
    | GridScrimmageEnvelope
    | GridScrimmageErrorEnvelope;

  if (!response.ok || body.success !== true) {
    throw new Error(
      'error' in body && body.error
        ? body.error
        : 'Grid scrimmage request failed.',
    );
  }

  return body;
}

function statusTone(status: GridScrimmageState['status']): string {
  if (status === 'active') return 'text-cyan-200 border-cyan-300/30 bg-cyan-300/[.06]';
  if (status === 'completed') return 'text-emerald-200 border-emerald-300/30 bg-emerald-300/[.06]';
  if (status === 'cancelled') return 'text-rose-200 border-rose-300/30 bg-rose-300/[.06]';
  return 'text-amber-200 border-amber-300/30 bg-amber-300/[.06]';
}

function influencePercent(
  combatant: GridScrimmageCombatantState,
  startingInfluence: number,
): number {
  if (startingInfluence <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (combatant.remainingInfluence / startingInfluence) * 100),
  );
}

export default function ScrimmageClient() {
  const [scrimmage, setScrimmage] = useState<GridScrimmageState | null>(null);
  const [viewer, setViewer] = useState<GridScrimmageViewer | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [busy, setBusy] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sessionId = scrimmage?.sessionId ?? null;

  const rememberSession = (next: GridScrimmageState) => {
    setScrimmage(next);
    const url = new URL(window.location.href);
    url.searchParams.set('session', next.sessionId);
    window.history.replaceState({}, '', url);
  };

  const clearSession = () => {
    setScrimmage(null);
    setViewer(null);
    setNotice('');
    setError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url);
  };

  const loadSession = async (id: string, quiet = false) => {
    if (!quiet) setLoadingSession(true);
    try {
      const result = await requestScrimmage(
        `/api/grid/scrimmages/${encodeURIComponent(id)}`,
      );
      setScrimmage(result.scrimmage);
      if (result.viewer) setViewer(result.viewer);
      if (!quiet) setError('');
    } catch (caught) {
      if (!quiet) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load the private scrimmage.',
        );
      }
    } finally {
      if (!quiet) setLoadingSession(false);
    }
  };

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session');
    if (id) void loadSession(id);
  }, []);

  useEffect(() => {
    if (!sessionId || !scrimmage) return;
    if (scrimmage.status !== 'lobby' && scrimmage.status !== 'active') return;

    const timer = window.setInterval(() => {
      void loadSession(sessionId, true);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [sessionId, scrimmage]);

  const ownParticipant = useMemo(
    () =>
      scrimmage && viewer
        ? scrimmage.participants.find(
            (participant) => participant.playerId === viewer.playerId,
          ) ?? null
        : null,
    [scrimmage, viewer],
  );

  const ownCombatant = useMemo(
    () =>
      scrimmage?.match && viewer
        ? scrimmage.match.combatants.find(
            (combatant) => combatant.playerId === viewer.playerId,
          ) ?? null
        : null,
    [scrimmage, viewer],
  );

  const allReady = Boolean(
    scrimmage &&
      scrimmage.participants.length >= scrimmage.rules.minPlayers &&
      (!scrimmage.rules.requireAllReady ||
        scrimmage.participants.every((participant) => participant.ready)),
  );

  const aliveCount =
    scrimmage?.match?.combatants.filter((combatant) => !combatant.eliminated)
      .length ?? 0;

  const playerLabel = (playerId: string): string => {
    if (viewer?.playerId === playerId) return 'YOU';
    if (scrimmage?.hostPlayerId === playerId) return 'HOST';
    const index =
      scrimmage?.participants.findIndex(
        (participant) => participant.playerId === playerId,
      ) ?? -1;
    return index >= 0 ? `PLAYER ${index + 1}` : 'PLAYER';
  };

  const runMutation = async (
    path: string,
    body?: Record<string, unknown>,
    successMessage?: string,
  ) => {
    if (!scrimmage) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await requestScrimmage(
        `/api/grid/scrimmages/${encodeURIComponent(scrimmage.sessionId)}/${path}`,
        {
          method: 'POST',
          body: JSON.stringify(body ?? {}),
        },
      );
      rememberSession(result.scrimmage);
      if (result.viewer) setViewer(result.viewer);
      if (successMessage) setNotice(successMessage);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The Grid rejected that command.',
      );
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await requestScrimmage('/api/grid/scrimmages', {
        method: 'POST',
        body: JSON.stringify({
          citySlug: 'canton-oh',
          minPlayers: 2,
          maxPlayers,
          requireAllReady: true,
        }),
      });
      rememberSession(result.scrimmage);
      if (result.viewer) setViewer(result.viewer);
      setNotice('Private room online. Share the invite code.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create the private room.',
      );
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    const code = inviteCode.trim();
    if (!code) {
      setError('Enter the private invite code.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await requestScrimmage('/api/grid/scrimmages/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code }),
      });
      rememberSession(result.scrimmage);
      if (result.viewer) setViewer(result.viewer);
      setNotice('Private room joined.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to join that private room.',
      );
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!scrimmage) return;
    try {
      await navigator.clipboard.writeText(scrimmage.inviteCode);
      setNotice('Invite code copied.');
    } catch {
      setNotice(`Invite code: ${scrimmage.inviteCode}`);
    }
  };

  const leaveRoom = async () => {
    if (!scrimmage) return;
    setBusy(true);
    setError('');
    try {
      await requestScrimmage(
        `/api/grid/scrimmages/${encodeURIComponent(scrimmage.sessionId)}/leave`,
        { method: 'POST', body: '{}' },
      );
      clearSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to leave.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px]"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(34,211,238,.13), transparent 58%)',
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/grid"
              className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-cyan-200"
            >
              <ArrowLeft size={13} />
              THE GRID
            </Link>
            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
              <Radio size={13} className="animate-pulse" />
              PRIVATE NETWORK // CANTON CITY 001
            </div>
            <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
              SCRIMMAGE
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
              Small-group Signal Duels inside an isolated room. Same combat
              language. Zero permanent city consequences.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.16em] text-emerald-200">
              <ShieldCheck size={14} />
              SESSION-ONLY
            </div>
            <div className="mt-1 text-[11px] text-stone-500">
              No Credits · No city XP · No territory changes
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {error}
            {error === 'Authentication required.' ? (
              <Link
                href="/login"
                className="ml-2 font-black underline decoration-rose-200/50 underline-offset-4"
              >
                SIGN IN
              </Link>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] px-4 py-3 text-sm text-cyan-100">
            <CheckCircle2 size={16} />
            {notice}
          </div>
        ) : null}

        {loadingSession && !scrimmage ? (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/40 py-20 text-sm text-stone-400">
            <RefreshCw size={18} className="animate-spin text-cyan-300" />
            RECONNECTING TO PRIVATE ROOM
          </div>
        ) : null}

        {!scrimmage && !loadingSession ? (
          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-cyan-400/20 bg-black/50 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] text-cyan-200">
                <Plus size={21} />
              </div>
              <p className="mt-5 font-mono text-[10px] font-black tracking-[.18em] text-cyan-300">
                OPEN A PRIVATE ROOM
              </p>
              <h2 className="mt-2 font-display text-3xl font-black uppercase">
                Host a Scrimmage
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Generate a private code, bring in a few players, ready up, then
                fight with session Influence that disappears when the room ends.
              </p>

              <label className="mt-6 block">
                <span className="font-mono text-[10px] font-black tracking-[.14em] text-stone-500">
                  ROOM CAPACITY
                </span>
                <select
                  value={maxPlayers}
                  onChange={(event) => setMaxPlayers(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f15] px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  {[2, 4, 6, 8, 10, 12].map((count) => (
                    <option key={count} value={count}>
                      {count} PLAYERS
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={busy}
                onClick={() => void createRoom()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-display text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
              >
                <Swords size={17} />
                CREATE PRIVATE ROOM
              </button>
            </article>

            <article className="rounded-3xl border border-amber-400/20 bg-black/50 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[.06] text-amber-200">
                <LogIn size={21} />
              </div>
              <p className="mt-5 font-mono text-[10px] font-black tracking-[.18em] text-amber-300">
                ENTER AN EXISTING ROOM
              </p>
              <h2 className="mt-2 font-display text-3xl font-black uppercase">
                Join by Code
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Scrimmages are intentionally private. You need the room code
                from the host before the Grid will let you in.
              </p>

              <label className="mt-6 block">
                <span className="font-mono text-[10px] font-black tracking-[.14em] text-stone-500">
                  INVITE CODE
                </span>
                <input
                  value={inviteCode}
                  onChange={(event) =>
                    setInviteCode(event.target.value.toUpperCase())
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void joinRoom();
                  }}
                  placeholder="GRID-XXXXXXXX"
                  autoCapitalize="characters"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f15] px-4 py-3 font-mono text-sm font-black tracking-[.12em] text-white outline-none placeholder:text-stone-700 focus:border-amber-300/50"
                />
              </label>

              <button
                type="button"
                disabled={busy}
                onClick={() => void joinRoom()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[.08] px-4 py-3 font-display text-sm font-black uppercase text-amber-100 transition hover:bg-amber-300/[.14] disabled:cursor-wait disabled:opacity-50"
              >
                <Zap size={17} />
                ENTER SCRIMMAGE
              </button>
            </article>
          </section>
        ) : null}

        {scrimmage ? (
          <section className="mt-7 space-y-5">
            <div className="rounded-3xl border border-white/10 bg-black/55">
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 font-mono text-[9px] font-black tracking-[.16em] ${statusTone(scrimmage.status)}`}
                    >
                      {scrimmage.status.toUpperCase()}
                    </span>
                    <span className="font-mono text-[9px] text-stone-600">
                      REV {scrimmage.revision}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-3xl font-black uppercase">
                    Private Signal Room
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[.05] px-4 py-3 text-left"
                >
                  <div>
                    <div className="font-mono text-[9px] font-black tracking-[.16em] text-stone-500">
                      INVITE CODE
                    </div>
                    <div className="mt-1 font-mono text-sm font-black tracking-[.15em] text-cyan-100">
                      {scrimmage.inviteCode}
                    </div>
                  </div>
                  <Copy size={16} className="text-cyan-300" />
                </button>
              </div>

              {scrimmage.status === 'lobby' ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                        <Users size={18} className="text-cyan-300" />
                        Roster
                      </div>
                      <div className="font-mono text-[10px] text-stone-500">
                        {scrimmage.participants.length}/{scrimmage.rules.maxPlayers}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {scrimmage.participants.map((participant, index) => (
                        <div
                          key={participant.playerId}
                          className="flex items-center justify-between rounded-2xl border border-white/[.08] bg-white/[.025] px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 font-mono text-[10px] font-black text-stone-400">
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-sm font-black">
                                {playerLabel(participant.playerId)}
                                {participant.playerId === scrimmage.hostPlayerId ? (
                                  <Crown size={13} className="text-amber-300" />
                                ) : null}
                              </div>
                              <div className="mt-1 font-mono text-[9px] text-stone-600">
                                PRIVATE PARTICIPANT
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-full border px-2 py-1 font-mono text-[9px] font-black ${
                              participant.ready
                                ? 'border-emerald-300/25 bg-emerald-300/[.06] text-emerald-200'
                                : 'border-white/10 bg-white/[.03] text-stone-500'
                            }`}
                          >
                            {participant.ready ? 'READY' : 'WAITING'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
                      <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-500">
                        START CONDITION
                      </div>
                      <div className="mt-2 text-sm font-black text-white">
                        {scrimmage.rules.minPlayers}+ PLAYERS
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        {scrimmage.rules.requireAllReady
                          ? 'Every player must be ready.'
                          : 'Host can start when minimum is met.'}
                      </div>
                    </div>

                    {ownParticipant ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runMutation(
                            'ready',
                            { ready: !ownParticipant.ready },
                            ownParticipant.ready
                              ? 'You are no longer marked ready.'
                              : 'You are locked in.',
                          )
                        }
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-display text-sm font-black uppercase transition disabled:opacity-50 ${
                          ownParticipant.ready
                            ? 'border border-white/10 bg-white/[.04] text-stone-300'
                            : 'bg-emerald-300 text-black hover:bg-emerald-200'
                        }`}
                      >
                        <CheckCircle2 size={16} />
                        {ownParticipant.ready ? 'UNREADY' : 'MARK READY'}
                      </button>
                    ) : null}

                    {viewer?.role === 'host' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || !allReady}
                          onClick={() =>
                            void runMutation(
                              'start',
                              undefined,
                              'Signal Duel is live.',
                            )
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-display text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Play size={16} />
                          START SCRIMMAGE
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runMutation(
                              'cancel',
                              undefined,
                              'Scrimmage cancelled.',
                            )
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[.05] px-4 py-3 font-display text-xs font-black uppercase text-rose-200"
                        >
                          <XCircle size={15} />
                          CANCEL ROOM
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void leaveRoom()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 font-display text-xs font-black uppercase text-stone-300"
                      >
                        <ArrowLeft size={15} />
                        LEAVE ROOM
                      </button>
                    )}
                  </aside>
                </div>
              ) : null}

              {scrimmage.status === 'active' && scrimmage.match ? (
                <div className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                        <Swords size={20} className="text-cyan-300" />
                        Signal Duel
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        Round {scrimmage.match.roundNumber} · {aliveCount} players
                        still online
                      </p>
                    </div>
                    <div className="font-mono text-[9px] text-emerald-300">
                      100% SESSION-LOCAL COMBAT STATE
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {scrimmage.match.combatants.map((combatant) => {
                      const isYou = combatant.playerId === viewer?.playerId;
                      const canChallenge =
                        !isYou &&
                        !combatant.eliminated &&
                        !ownCombatant?.eliminated &&
                        !busy;
                      const percent = influencePercent(
                        combatant,
                        scrimmage.match!.startingInfluencePerPlayer,
                      );

                      return (
                        <article
                          key={combatant.playerId}
                          className={`rounded-2xl border p-4 ${
                            combatant.eliminated
                              ? 'border-rose-400/20 bg-rose-400/[.035]'
                              : isYou
                                ? 'border-cyan-300/30 bg-cyan-300/[.05]'
                                : 'border-white/10 bg-white/[.025]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                                {playerLabel(combatant.playerId)}
                                {combatant.playerId === scrimmage.hostPlayerId ? (
                                  <Crown size={13} className="text-amber-300" />
                                ) : null}
                              </div>
                              <div className="mt-1 font-mono text-[9px] text-stone-600">
                                W {combatant.roundWins} · L {combatant.roundLosses} · D{' '}
                                {combatant.draws}
                              </div>
                            </div>
                            {combatant.eliminated ? (
                              <Skull size={18} className="text-rose-300" />
                            ) : (
                              <Activity size={18} className="text-emerald-300" />
                            )}
                          </div>

                          <div className="mt-5 flex items-end justify-between">
                            <div>
                              <div className="font-display text-3xl font-black">
                                {combatant.remainingInfluence}
                              </div>
                              <div className="font-mono text-[9px] text-stone-500">
                                SIGNAL INFLUENCE
                              </div>
                            </div>
                            <div className="font-mono text-[9px] text-stone-600">
                              {Math.round(percent)}%
                            </div>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                combatant.eliminated
                                  ? 'bg-rose-400'
                                  : isYou
                                    ? 'bg-cyan-300'
                                    : 'bg-amber-300'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          {!isYou ? (
                            <button
                              type="button"
                              disabled={!canChallenge}
                              onClick={() =>
                                void runMutation(
                                  'duel',
                                  {
                                    defenderPlayerId: combatant.playerId,
                                  },
                                  `Signal sent at ${playerLabel(
                                    combatant.playerId,
                                  )}.`,
                                )
                              }
                              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.05] px-3 py-2.5 font-display text-xs font-black uppercase text-cyan-100 transition hover:bg-cyan-300/[.1] disabled:cursor-not-allowed disabled:opacity-25"
                            >
                              <Zap size={14} />
                              CHALLENGE
                            </button>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>

                  {scrimmage.match.lastRound ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/45 p-4">
                      <div className="font-mono text-[9px] font-black tracking-[.15em] text-stone-500">
                        LAST SIGNAL // ROUND {scrimmage.match.lastRound.roundNumber}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div>
                          <div className="font-display font-black uppercase">
                            {playerLabel(
                              scrimmage.match.lastRound.attackerPlayerId,
                            )}
                          </div>
                          <div className="mt-1 font-mono text-xs text-cyan-200">
                            [{scrimmage.match.lastRound.attackerRolls.join(' · ')}]
                          </div>
                        </div>
                        <div className="font-display text-xs font-black text-stone-600">
                          VS
                        </div>
                        <div className="sm:text-right">
                          <div className="font-display font-black uppercase">
                            {playerLabel(
                              scrimmage.match.lastRound.defenderPlayerId,
                            )}
                          </div>
                          <div className="mt-1 font-mono text-xs text-amber-200">
                            [{scrimmage.match.lastRound.defenderRolls.join(' · ')}]
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-white/[.06] pt-3 text-xs text-stone-400">
                        Losses: attacker{' '}
                        <strong className="text-white">
                          {scrimmage.match.lastRound.attackerInfluenceLost}
                        </strong>{' '}
                        · defender{' '}
                        <strong className="text-white">
                          {scrimmage.match.lastRound.defenderInfluenceLost}
                        </strong>{' '}
                        · result{' '}
                        <strong className="uppercase text-cyan-200">
                          {scrimmage.match.lastRound.winner}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-5 text-center text-xs text-stone-500">
                      No signals fired yet. Pick another player and challenge them.
                    </div>
                  )}

                  {ownCombatant?.eliminated ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[.05] px-4 py-3 text-xs text-rose-100">
                      <Skull size={15} />
                      Your session Influence hit zero. You can watch the room finish,
                      but you cannot issue another duel.
                    </div>
                  ) : null}

                  {viewer?.role === 'host' ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runMutation(
                            'complete',
                            undefined,
                            'Scrimmage completed.',
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] px-4 py-2.5 font-display text-xs font-black uppercase text-emerald-100 disabled:opacity-50"
                      >
                        <Flag size={15} />
                        END SCRIMMAGE
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runMutation(
                            'cancel',
                            undefined,
                            'Scrimmage cancelled.',
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-4 py-2.5 font-display text-xs font-black uppercase text-rose-200 disabled:opacity-50"
                      >
                        <XCircle size={15} />
                        ABORT SESSION
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {scrimmage.status === 'completed' ||
              scrimmage.status === 'cancelled' ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[.04]">
                    {scrimmage.status === 'completed' ? (
                      <Flag size={23} className="text-emerald-300" />
                    ) : (
                      <XCircle size={23} className="text-rose-300" />
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-3xl font-black uppercase">
                    {scrimmage.status === 'completed'
                      ? 'Scrimmage Complete'
                      : 'Session Cancelled'}
                  </h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
                    The room is closed. All Signal Influence in this session stays
                    here. Permanent Grid progression remains untouched.
                  </p>
                  <button
                    type="button"
                    onClick={clearSession}
                    className="mt-5 rounded-xl bg-white px-5 py-3 font-display text-xs font-black uppercase text-black"
                  >
                    RETURN TO SCRIMMAGE MENU
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <ShieldCheck size={17} className="text-emerald-300" />
                <div className="mt-3 font-display text-sm font-black uppercase">
                  Isolated State
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Scrimmage Influence exists only inside this private session.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <Zap size={17} className="text-cyan-300" />
                <div className="mt-3 font-display text-sm font-black uppercase">
                  Server Dice
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  The browser picks an opponent. The server generates and resolves
                  the Signal Dice.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <Users size={17} className="text-amber-300" />
                <div className="mt-3 font-display text-sm font-black uppercase">
                  Private by Code
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Session state is visible only to players who joined the room.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
