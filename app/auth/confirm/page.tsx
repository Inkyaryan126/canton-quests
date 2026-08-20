'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, KeyRound, AlertCircle, ArrowRight, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { showGameMoment } from '@/lib/game-effects';
import { cqImages } from '@/lib/marketing-assets';

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

  const [callsign, setCallsign] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    urlErrorDesc || (urlError ? `Authentication error: ${urlError}` : '')
  );

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
        body: JSON.stringify({
          token_hash: tokenHash,
          type,
          next,
          displayName: callsign.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Email verification failed or link expired.');
      }

      setIsSuccess(true);

      // Save player profile and token in localStorage for instant client state
      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        if (data.session?.access_token) {
          window.localStorage.setItem('canton_auth_token', data.session.access_token);
        }
      }

      const targetDestination = data.redirectTo || next || '/profile';
      const navigateNext = () => {
        if (router && router.push) {
          router.push(targetDestination);
        } else if (typeof window !== 'undefined') {
          window.location.href = targetDestination;
        }
      };

      // Trigger Celebration Game Moment and navigate upon conclusion
      showGameMoment({
        type: 'path-lock',
        path: data.player?.selectedStartingPath || 'family',
        title: `${data.player?.displayName || 'Agent'} Activated`,
        onFinished: navigateNext,
      });

      // Safe fallback timer in case moment dismissal is delayed
      setTimeout(navigateNext, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification link is invalid or has expired.');
      setIsLoading(false);
    }
  };

  return (
    <div className="cq-confirm-card">
      {/* Top Header Badge */}
      <div className="cq-confirm-badge-row">
        <span className="cq-confirm-live-dot" />
        <span className="cq-confirm-eyebrow">CANTON QUESTS // IDENTITY VERIFICATION</span>
      </div>

      <h1 className="cq-confirm-title">
        {isSuccess ? 'EMAIL CONFIRMED!' : 'CONFIRM YOUR EMAIL'}
      </h1>

      <p className="cq-confirm-desc">
        {isSuccess
          ? 'Your email is verified and your player identity is activated. Entering Canton Quests...'
          : 'Click below to verify your email address and activate your player identity for Canton Quests.'}
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
            Player Profile Verified. Launching game board...
          </p>
          <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden border border-emerald-500/30">
            <div className="bg-emerald-400 h-full w-full animate-pulse" />
          </div>
        </div>
      ) : tokenHash ? (
        <form onSubmit={handleConfirm} className="cq-confirm-form">
          <div className="cq-confirm-callsign-box">
            <label htmlFor="confirm-callsign-input" className="cq-confirm-label">
              Player Callsign (Optional / Can be set later)
            </label>
            <input
              id="confirm-callsign-input"
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="e.g. NeonVoyager_330"
              maxLength={30}
              className="cq-confirm-input"
            />
          </div>

          <div className="cq-confirm-security-bar">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs">
              <ShieldCheck size={14} />
              <span>Passwordless Cryptographic Verification</span>
            </div>
            <span className="text-stone-400 font-mono text-[11px]">One-Click Activation</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cq-confirm-submit-btn"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                <span>Verifying Credentials...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <KeyRound size={18} />
                <span>CONFIRM & ENTER CANTON QUESTS</span>
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
            Return to Homepage to Request New Code
          </Link>
        </div>
      )}

      {/* Rules Footer */}
      <div className="cq-confirm-footer">
        <Sparkles size={14} className="text-amber-400 shrink-0" />
        <span>Every verified player gets 1 individual entry for Sunday night prize drawings.</span>
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
