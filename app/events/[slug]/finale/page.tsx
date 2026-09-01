'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import CipherFragmentsPanel from '@/components/CipherFragmentsPanel';
import { KeyRound, Lock, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import { QuestEvent, Player, EventParticipation, PlayerCipherProgressView } from '@/lib/types';
import type { PlayerFinaleStatus } from '@/lib/finale-db';
import type { FinaleSubmissionOutcome } from '@/lib/finale';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';
import { cqImages } from '@/lib/marketing-assets';
import { showFounderCipherMessage, getFounderCipherMessage } from '@/lib/gameplay/founders-cipher/message-resolver';

const LOCKED_REASON_TITLE: Record<string, string> = {
  not_configured: 'MASTER CIPHER OFFLINE',
  locks_required: 'FOUNDER LOCKS REQUIRED',
  insufficient_sigils: 'MASTER CIPHER LOCKED',
  watcher_required: 'MASTER CIPHER LOCKED',
  not_yet_open: 'MASTER CIPHER NOT YET OPEN',
  closed: 'MASTER CIPHER CLOSED',
  event_ended: 'MISSION ENDED',
};

export default function FinalePage({ params }: { params: { slug: string } }) {
  const eventSlug = params.slug;
  const isCipher = isKnownCantonLaunchSlug(eventSlug);

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [isPreLaunch, setIsPreLaunch] = useState(false);
  const [cipherProgress, setCipherProgress] = useState<PlayerCipherProgressView | null>(null);
  const [eventLoaded, setEventLoaded] = useState(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [authenticatedPlayer, setAuthenticatedPlayer] = useState<Player | null>(null);
  const [participation, setParticipation] = useState<EventParticipation | null>(null);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  const [finaleStatus, setFinaleStatus] = useState<PlayerFinaleStatus | null>(null);
  const [finaleStatusLoaded, setFinaleStatusLoaded] = useState(false);

  const [answerInput, setAnswerInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptOutcome, setAttemptOutcome] = useState<FinaleSubmissionOutcome | null>(null);

  const path = authenticatedPlayer?.selectedStartingPath;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data: { isAuthenticated?: boolean; player?: Player }) => {
        setAuthenticatedPlayer(data.isAuthenticated && data.player ? data.player : null);
      })
      .catch(() => setAuthenticatedPlayer(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const enterOperation = useCallback(async () => {
    setEntering(true);
    setEnterError(null);
    try {
      const res = await fetch(`/api/game/operations/${eventSlug}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEnterError(data.error || 'Unable to enter this Mission.');
        return;
      }
      setParticipation(data.participation);
      if (data.player) setAuthenticatedPlayer(data.player);
    } catch {
      setEnterError('Unable to enter this Mission. Check your connection and try again.');
    } finally {
      setEntering(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    if (authChecked && authenticatedPlayer && !participation && !entering) {
      enterOperation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authenticatedPlayer]);

  const fetchEvent = useCallback(() => {
    const qs = authenticatedPlayer ? `?playerId=${encodeURIComponent(authenticatedPlayer.id)}` : '';
    fetch(`/api/game/events/${eventSlug}${qs}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: { event?: QuestEvent; cipherProgress?: PlayerCipherProgressView | null; isPreLaunch?: boolean } | null) => {
        setEventLoaded(true);
        if (!data) return;
        if (data.isPreLaunch) setIsPreLaunch(true);
        if (data.event) setEvent(data.event);
        setCipherProgress(data.cipherProgress || null);
      })
      .catch(() => setEventLoaded(true));
  }, [eventSlug, authenticatedPlayer]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const fetchFinaleStatus = useCallback(() => {
    if (!authenticatedPlayer || !participation) return;
    fetch(`/api/game/finale?eventSlug=${encodeURIComponent(eventSlug)}`)
      .then((res) => res.json())
      .then((data: { status?: PlayerFinaleStatus }) => {
        setFinaleStatusLoaded(true);
        if (data.status) setFinaleStatus(data.status);
      })
      .catch(() => setFinaleStatusLoaded(true));
  }, [eventSlug, authenticatedPlayer, participation]);

  useEffect(() => {
    fetchFinaleStatus();
  }, [fetchFinaleStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || submitting || !authenticatedPlayer) return;
    setSubmitting(true);
    setSubmitError(null);
    setAttemptOutcome(null);

    try {
      const res = await fetch('/api/game/finale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, answer: answerInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Unable to submit the Master Cipher right now.');
        fetchFinaleStatus();
        return;
      }

      const outcome: FinaleSubmissionOutcome = data.outcome;
      setAttemptOutcome(outcome);
      setAnswerInput('');

      if (outcome.stage === 'completed') {
        showFounderCipherMessage({
          messageId: 'FINAL_SOLUTION_CORRECT',
          path,
          playerId: authenticatedPlayer.id,
          onContinue: () => {
            showFounderCipherMessage({
              messageId: 'MISSION_COMPLETE',
              path,
              playerId: authenticatedPlayer.id,
              onContinue: () => fetchFinaleStatus(),
            });
          },
        });
        fetchFinaleStatus();
      } else if (outcome.stage === 'already_completed') {
        fetchFinaleStatus();
      }
      // 'incorrect' and 'false_finale_solved' render inline below — see the
      // COMMANDER / SYSTEM FEEDBACK section. Deliberately no overlay here:
      // retries are allowed and unlimited, so a full-screen moment on every
      // guess would be exactly the popup spam the mission report warns
      // against.
    } catch {
      setSubmitError('Unable to reach the Cipher right now. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Loading -------------------------------------------------------
  if (!eventLoaded || !authChecked) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-400 border-t-transparent mb-4" />
        <p className="text-xs text-cyan-300 tracking-wider uppercase">Establishing Cipher Link...</p>
      </div>
    );
  }

  // ---- Not a Founder's Cipher mission / event not found ---------------
  if (!isCipher || (!event && !isPreLaunch)) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          <div className="p-8 rounded-3xl border border-stone-800 bg-stone-900/80 shadow-2xl w-full space-y-4">
            <Lock size={32} className="mx-auto text-stone-600" />
            <h1 className="font-display font-black text-xl text-white uppercase tracking-tight">No Master Cipher Here</h1>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              This Mission doesn&apos;t have a Master Cipher finale.
            </p>
            <Link href={`/events/${eventSlug}`} className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2">
              RETURN TO MISSION
            </Link>
          </div>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // ---- Pre-launch -------------------------------------------------------
  if (isPreLaunch || (event && isPreLaunchEvent(event, eventSlug))) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          <div className="p-8 rounded-3xl border border-cyan-500/30 bg-stone-900/80 shadow-2xl w-full space-y-4">
            <Radio size={32} className="mx-auto text-cyan-500" />
            <h1 className="font-display font-black text-xl text-white uppercase tracking-tight">Master Cipher Not Yet Online</h1>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              This Mission hasn&apos;t started yet. The Master Cipher opens once the Mission is underway and enough signal has been recovered.
            </p>
            <Link href={`/events/${eventSlug}`} className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2">
              RETURN TO MISSION
            </Link>
          </div>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // ---- GATE A: not signed in --------------------------------------------
  if (!authenticatedPlayer) {
    const nextParam = encodeURIComponent(`/events/${eventSlug}/finale`);
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-stone-900/90 shadow-2xl p-8 sm:p-10 w-full space-y-4">
            <Image src={cqImages.questBoardBg} alt="" fill sizes="600px" className="object-cover opacity-15 pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">Master Cipher Access Required</span>
              <h1 className="font-display font-black text-2xl text-white uppercase tracking-tight">Identify Yourself</h1>
              <p className="text-sm text-stone-300 leading-relaxed font-body">
                The Master Cipher only responds to a confirmed Canton Quests Player Identity.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={`/register?next=${nextParam}`} className="cq-gold-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2">
                  CREATE PLAYER IDENTITY
                </Link>
                <Link href={`/login?next=${nextParam}`} className="cq-dark-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2">
                  ACCESS COMMAND CENTER
                </Link>
              </div>
            </div>
          </div>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // ---- GATE B: participation not yet resolved ----------------------------
  if (!participation) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-400 border-t-transparent mb-4" />
        <p className="text-xs text-cyan-300 tracking-wider uppercase">Entering Mission...</p>
        {enterError && (
          <div className="mt-4 text-center space-y-3">
            <p className="text-xs text-red-400">{enterError}</p>
            <button type="button" onClick={() => enterOperation()} className="cq-gold-button text-xs py-2 px-5">
              RETRY
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- GATE C/D/E: finale status not yet loaded --------------------------
  if (!finaleStatusLoaded || !finaleStatus) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-400 border-t-transparent mb-4" />
        <p className="text-xs text-cyan-300 tracking-wider uppercase">Reading Convergence Signal...</p>
      </div>
    );
  }

  const solved = Boolean(finaleStatus.completedAt);
  const ready = !solved && finaleStatus.eligibility.ok;

  const missionStatus = (
    <section className="mb-6 border border-cyan-400/25 bg-[#06090b] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono font-extrabold uppercase tracking-[0.22em] text-cyan-300">Mission Status</span>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-black uppercase text-white">
            {solved ? 'Founder’s Cipher — Solved' : 'Master Cipher Convergence'}
          </h1>
        </div>
        <div
          className={`rounded border px-3 py-2 text-right font-mono ${
            solved ? 'border-emerald-400/40 bg-emerald-400/10' : ready ? 'border-amber-400/40 bg-amber-400/10' : 'border-stone-700 bg-black/30'
          }`}
        >
          <span className="block text-[10px] uppercase tracking-widest text-stone-400">Sigils</span>
          <strong className={`text-lg ${solved ? 'text-emerald-300' : ready ? 'text-amber-300' : 'text-stone-300'}`}>
            {finaleStatus.unlockedSigilCount}
          </strong>
        </div>
      </div>
    </section>
  );

  // ---- STATE: locked (not eligible, for any real reason) -----------------
  if (!solved && !ready) {
    const reason = finaleStatus.eligibility.ok ? null : finaleStatus.eligibility.reason;
    const title = (reason && LOCKED_REASON_TITLE[reason]) || 'MASTER CIPHER LOCKED';
    const message = finaleStatus.eligibility.ok ? '' : finaleStatus.eligibility.message;

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12">
          {missionStatus}
          <section className="border border-stone-800 bg-[#06090b] p-6 sm:p-8 text-center space-y-4">
            <Lock size={32} className="mx-auto text-stone-500" />
            <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-white">{title}</h2>
            <p className="text-sm text-stone-400 leading-relaxed max-w-md mx-auto">{message}</p>

            {reason === 'insufficient_sigils' && cipherProgress && cipherProgress.districts.length > 0 && (
              <div className="pt-2 max-w-sm mx-auto text-left space-y-1.5">
                <span className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 text-center mb-2">
                  Remaining Districts
                </span>
                {cipherProgress.districts
                  .filter((d) => d.status !== 'token_unlocked')
                  .map((d) => (
                    <div key={d.key} className="flex items-center justify-between text-xs font-mono border border-stone-800 bg-black/30 px-3 py-2">
                      <span className="text-stone-300">{d.name}</span>
                      <span className="text-stone-500">
                        {d.collectedCount}/{d.requiredCount}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="pt-3">
              <Link href={`/events/${eventSlug}#quest-board`} className="cq-gold-button text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2">
                CONTINUE OPERATION →
              </Link>
            </div>
          </section>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // ---- STATE: ready (ok to attempt) or solved ----------------------------
  const invalidAnswerCopy = getFounderCipherMessage('INVALID_ANSWER', path);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
      <Header eventSlug={eventSlug} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12">
        {missionStatus}

        {/* RECOVERED INTEL */}
        <section className="mb-6 border border-cyan-400/25 bg-[#06090b] p-4 sm:p-5">
          <span className="text-[10px] font-mono font-extrabold uppercase tracking-[0.22em] text-cyan-300">Recovered Intel</span>
          <h2 className="mt-1 mb-3 font-display text-lg font-black uppercase text-white">Clue Pieces</h2>
          {finaleStatus.cluePieces.length > 0 ? (
            <ul className="space-y-2">
              {finaleStatus.cluePieces.map((piece, i) => (
                <li key={i} className="flex items-start gap-2 border border-cyan-300/25 bg-cyan-300/5 p-3 text-sm text-stone-200">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
                  <span>{piece}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500 font-mono">No additional clue pieces have been recorded for this decode yet.</p>
          )}
        </section>

        {cipherProgress && (
          <CipherFragmentsPanel
            progress={cipherProgress}
            eventSlug={eventSlug}
            onDecodeSuccess={(decodeResult) => {
              fetchFinaleStatus();
              fetchEvent();
              if (decodeResult) {
                const messageId = decodeResult.masterCipherAvailable
                  ? 'MASTER_CIPHER_AVAILABLE'
                  : decodeResult.allSigilsUnlocked
                  ? 'ALL_THREE_SIGILS_DECODED'
                  : 'DISTRICT_SIGIL_UNLOCKED';
                showFounderCipherMessage({
                  messageId,
                  path,
                  playerId: authenticatedPlayer?.id,
                  contextLabel: decodeResult.tokenLabel,
                });
              }
            }}
          />
        )}

        {/* MASTER CIPHER / SOLUTION ENTRY / SOLVED SUMMARY */}
        {solved ? (
          <section className="mb-6 border border-emerald-400/40 bg-emerald-950/15 p-6 sm:p-8 text-center space-y-4">
            <ShieldCheck size={36} className="mx-auto text-emerald-300" />
            <h2 className="font-display text-2xl font-black uppercase text-white">
              {getFounderCipherMessage('CIPHER_SOLVED', path).title}
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed max-w-md mx-auto">
              {getFounderCipherMessage('CIPHER_SOLVED', path).body}
            </p>
            {finaleStatus.destinationReveal && (
              <div className="max-w-md mx-auto border border-emerald-400/30 bg-black/25 p-4 text-left">
                <span className="block text-[10px] font-mono uppercase tracking-widest text-emerald-300 mb-1">Final Reveal</span>
                <p className="text-sm text-stone-200 leading-relaxed">{finaleStatus.destinationReveal}</p>
              </div>
            )}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={`/events/${eventSlug}/transmissions`} className="cq-gold-button text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2">
                VIEW TRANSMISSIONS
              </Link>
              <Link href={`/events/${eventSlug}`} className="cq-dark-button text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2">
                RETURN TO MISSION
              </Link>
            </div>
          </section>
        ) : (
          <section className="mb-6 border border-amber-400/40 bg-[#06090b] p-4 sm:p-5">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-[0.22em] text-amber-300">Master Cipher</span>
            <h2 className="mt-1 mb-4 font-display text-lg font-black uppercase text-white">Submit Your Solution</h2>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Enter the final decode"
                disabled={submitting}
                className="input-field text-sm flex-1 font-mono uppercase tracking-wider"
              />
              <button
                type="submit"
                disabled={submitting || !answerInput.trim()}
                className="cq-gold-button text-xs py-3 px-6 font-mono font-bold whitespace-nowrap disabled:opacity-50"
              >
                {submitting ? 'DECODING...' : 'SUBMIT'}
              </button>
            </form>

            {/* COMMANDER / SYSTEM FEEDBACK */}
            {submitError && (
              <div className="mt-4 border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300 font-mono">{submitError}</div>
            )}
            {attemptOutcome?.stage === 'incorrect' && (
              <div className="mt-4 border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-200">
                {invalidAnswerCopy.body}
              </div>
            )}
            {attemptOutcome?.stage === 'false_finale_solved' && (
              <div className="mt-4 border border-cyan-500/30 bg-cyan-950/20 p-3 text-sm text-cyan-200">
                {attemptOutcome.revealText || 'That signal resolves to something — but not the convergence itself. Keep decoding.'}
              </div>
            )}
          </section>
        )}
      </main>
      <CinematicFooter />
    </div>
  );
}
