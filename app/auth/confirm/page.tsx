'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, KeyRound, AlertCircle, ArrowRight, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { showGameMoment } from '@/lib/game-effects';
import { cqImages } from '@/lib/marketing-assets';
import { Player } from '@/lib/types';

function sanitizeNextPath(rawNext?: string | null): string {
  if (!rawNext || typeof rawNext !== 'string') return '/profile';
  const trimmed = rawNext.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes('\0')) {
    return trimmed;
  }
  return '/profile';
}

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get('token_hash') || searchParams.get('token') || '';
  const type = searchParams.get('type') || 'email';
  const next = sanitizeNextPath(searchParams.get('next') || searchParams.get('redirectTo'));
  const urlError = searchParams.get('error') || '';
  const urlErrorDesc = searchParams.get('error_description') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    urlErrorDesc || (urlError ? `Authentication error: ${urlError}` : '')
  );

  // Set only when the server (not a guessed URL `type`) determines this
  // verified account genuinely never collected a callsign anywhere — see
  // needsCallsign in app/api/auth/confirm/route.ts. Holds verification
  // results until the player either sets a callsign or skips.
  const [awaitingCallsign, setAwaitingCallsign] = useState<{ player: Player; targetDestination: string } | null>(null);
  const [callsignInput, setCallsignInput] = useState('');
  const [isSavingCallsign, setIsSavingCallsign] = useState(false);

  const isRecovery = type === 'recovery';

  const proceedToGame = (player: Player | undefined, targetDestination: string) => {
    setIsSuccess(true);

    // Save player profile in localStorage for instant UI display
    // Persistent authentication is secured via HTTP-only cookies
    if (typeof window !== 'undefined' && window.localStorage) {
      if (player) {
        window.localStorage.setItem('canton_quests_current_player', JSON.stringify(player));
        window.localStorage.setItem('canton_player_profile', JSON.stringify(player));
      }
      window.localStorage.removeItem('canton_auth_token');
      window.localStorage.removeItem('canton_refresh_token');
    }

    let hasNavigated = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const navigateNext = () => {
      if (hasNavigated) return;
      hasNavigated = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (router && router.push) {
        router.push(targetDestination);
      } else if (typeof window !== 'undefined') {
        window.location.href = targetDestination;
      }
    };

    // Trigger Celebration Game Moment and navigate upon conclusion. Path is
    // Operation-specific now (event_players.path) — a brand-new player has
    // no path yet at this account-level confirmation step, so the
    // path-locked cinematic only fires when one is genuinely already set
    // (e.g. a pre-reorg legacy account). Otherwise just navigate on.
    if (player?.selectedStartingPath) {
      showGameMoment({
        type: 'path-lock',
        path: player.selectedStartingPath,
        title: `${player?.displayName || 'Agent'} Activated`,
        onFinished: navigateNext,
      });

      // Safe fallback timer in case moment dismissal is delayed or unmounted
      fallbackTimer = setTimeout(navigateNext, 3500);
    } else {
      navigateNext();
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenHash) {
      setErrorMessage('No verification token found in this link. Please request a new confirmation email.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, type, next }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Email verification failed or link expired.');
      }

      const targetDestination = data.redirectTo || next || (isRecovery ? '/auth/reset-password' : '/profile');

      if (isRecovery) {
        setIsSuccess(true);
        if (typeof window !== 'undefined' && window.localStorage) {
          if (data.player) {
            window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
            window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
          }
        }
        if (router && router.push) {
          router.push(targetDestination);
        } else if (typeof window !== 'undefined') {
          window.location.href = targetDestination;
        }
        return;
      }

      // Only a genuinely callsign-less account (verified server-side, never
      // guessed from the link's `type`) pauses here — a normal password
      // signup, which already has a real callsign, goes straight through.
      if (data.needsCallsign && data.player) {
        setIsLoading(false);
        setAwaitingCallsign({ player: data.player, targetDestination });
        return;
      }

      proceedToGame(data.player, targetDestination);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification link is invalid or has expired.');
      setIsLoading(false);
    }
  };

  const handleSetCallsign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awaitingCallsign) return;
    const cleanCallsign = callsignInput.trim();
    if (cleanCallsign.length < 2) {
      setErrorMessage('Choose a callsign at least 2 characters, or skip for now.');
      return;
    }

    setIsSavingCallsign(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/player/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: cleanCallsign }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save callsign.');
      }
      proceedToGame(data.player || awaitingCallsign.player, awaitingCallsign.targetDestination);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save callsign. You can also set it later in Profile Settings.');
    } finally {
      setIsSavingCallsign(false);
    }
  };

  const handleSkipCallsign = () => {
    if (!awaitingCallsign) return;
    proceedToGame(awaitingCallsign.player, awaitingCallsign.targetDestination);
  };

  return (
    <div className="cq-confirm-card">
      {/* Top Header Badge */}
      <div className="cq-confirm-badge-row">
        <span className="cq-confirm-live-dot" />
        <span className="cq-confirm-eyebrow">
          {isRecovery ? 'CANTON QUESTS // IDENTITY RECOVERY' : 'CANTON QUESTS // IDENTITY VERIFICATION'}
        </span>
      </div>

      <h1 className="cq-confirm-title">
        {isSuccess
          ? (isRecovery ? 'RECOVERY VERIFIED!' : 'EMAIL CONFIRMED!')
          : awaitingCallsign
          ? 'CHOOSE YOUR CALLSIGN'
          : (isRecovery ? 'RESTORE PLAYER ACCESS' : 'CONFIRM YOUR EMAIL')}
      </h1>

      <p className="cq-confirm-desc">
        {isSuccess
          ? (isRecovery
              ? 'Recovery verified. Redirecting to set new password...'
              : 'Your email is verified and your player identity is activated. Entering Canton Quests...')
          : awaitingCallsign
          ? 'Your email is verified. Pick the public callsign other players will see — or skip and set it later in Profile Settings.'
          : (isRecovery
              ? 'Click below to securely verify your recovery link and choose a new password.'
              : 'Click below to verify your email address and activate your player identity for Canton Quests.')}
      </p>

      {errorMessage && (
        <div className="cq-confirm-error">
          <AlertCircle size={18} className="shrink-0 text-red-400" />
          <div>
            <strong>Verification Notice</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {isSuccess ? (
        <div className="cq-confirm-success">
          <CheckCircle2 size={32} className="text-emerald-400" />
          <p className="font-mono text-sm text-emerald-300 font-bold">
            {isRecovery ? 'Recovery Session Established. Redirecting...' : 'Player Profile Verified. Launching game board...'}
          </p>
          <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden border border-emerald-500/30">
            <div className="bg-emerald-400 h-full w-full animate-pulse" />
          </div>
        </div>
      ) : awaitingCallsign ? (
        // Shown only when the server (never the link's guessed `type`)
        // confirms this verified account has no real callsign anywhere —
        // the passwordless magic-link/OTP case. A normal password signup
        // already has one and skips straight past this to proceedToGame.
        <form onSubmit={handleSetCallsign} className="cq-confirm-form">
          <div className="cq-confirm-callsign-box">
            <label htmlFor="confirm-callsign-input" className="cq-confirm-label">
              Player Callsign
            </label>
            <input
              id="confirm-callsign-input"
              type="text"
              value={callsignInput}
              onChange={(e) => setCallsignInput(e.target.value)}
              placeholder="e.g. NeonVoyager_330"
              maxLength={30}
              autoFocus
              className="cq-confirm-input"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingCallsign}
            className="cq-confirm-submit-btn"
          >
            {isSavingCallsign ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <KeyRound size={18} />
                <span>SAVE & ENTER CANTON QUESTS</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkipCallsign}
            disabled={isSavingCallsign}
            className="text-xs font-mono text-stone-400 hover:text-amber-300 underline w-full text-center mt-1"
          >
            Skip for now — set it later in Profile Settings
          </button>
        </form>
      ) : tokenHash ? (
        <form onSubmit={handleConfirm} className="cq-confirm-form">
          <div className="cq-confirm-security-bar">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs">
              <ShieldCheck size={14} />
              <span>{isRecovery ? 'Encrypted Account Recovery' : 'Cryptographic Email Verification'}</span>
            </div>
            <span className="text-stone-400 font-mono text-[11px]">One-Click Action</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cq-confirm-submit-btn"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                <span>{isRecovery ? 'Verifying Recovery...' : 'Verifying Credentials...'}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <KeyRound size={18} />
                <span>{isRecovery ? 'VERIFY & SET NEW PASSWORD' : 'CONFIRM & ENTER CANTON QUESTS'}</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>
      ) : (
        <div className="cq-confirm-missing-box">
          <p className="font-mono text-xs text-stone-300 mb-4">
            No verification token was detected in this link, or the link has expired.
          </p>
          <Link href="/" className="cq-confirm-home-btn">
            Return to Homepage to Request New Link
          </Link>
        </div>
      )}

      {/* Rules Footer */}
      <div className="cq-confirm-footer">
        <Sparkles size={14} className="text-amber-400 shrink-0" />
        <span>Every verified completed core quest earns a drawing entry toward the cash prize drawings — account creation alone doesn&apos;t.</span>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <main className="cq-confirm-page">
      {/* Background Ambience */}
      <div className="cq-confirm-bg-glow" />

      {/* Brand Header */}
      <div className="cq-confirm-brand">
        <Link href="/" className="cq-confirm-logo-link">
          <Image
            src={cqImages.logoNav || '/brand/canton-quests-master-logo.png'}
            alt="Canton Quests Logo"
            width={48}
            height={48}
            priority
            className="cq-confirm-logo-img"
          />
          <div className="cq-confirm-brand-text">
            <span className="cq-confirm-brand-title">CANTON QUESTS</span>
            <span className="cq-confirm-brand-subtitle">CITY ADVENTURE</span>
          </div>
        </Link>
      </div>

      <Suspense fallback={
        <div className="cq-confirm-card text-center p-8">
          <p className="font-mono text-amber-400 text-sm animate-pulse">Loading verification details...</p>
        </div>
      }>
        <ConfirmEmailContent />
      </Suspense>
    </main>
  );
}
