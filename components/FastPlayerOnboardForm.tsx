'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, Sparkles, UserCheck, Zap } from 'lucide-react';
import { StartingPath } from '@/lib/types';
import { showGameMoment } from '@/lib/game-effects';
import { ACQUISITION_ENTRY_HREF } from '@/lib/acquisition-landing-content';

interface FastPlayerOnboardFormProps {
  startingPath: StartingPath;
  acquisitionSource: string;
  buttonLabel?: string;
  redirectTo?: string;
  themeAccent?: string;
}

const AVATAR_OPTIONS = ['⚡', '🧭', '🔍', '🏆', '🎯', '🦅', '👾', '🔥'];

export default function FastPlayerOnboardForm({
  startingPath,
  acquisitionSource,
  buttonLabel,
  redirectTo = ACQUISITION_ENTRY_HREF,
  themeAccent = '#f59e0b',
}: FastPlayerOnboardFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [callsign, setCallsign] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚡');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const pathTitles: Record<StartingPath, string> = {
    family: 'Family Adventure Path',
    challenge: 'Kinetic Challenge Path',
    secret: 'Secret Mystery Path',
  };

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCallsign = callsign.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCallsign || cleanCallsign.length < 2) {
      setErrorMessage('Please enter a callsign (at least 2 characters).');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address for instant account verification.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: cleanEmail,
          selectedStartingPath: startingPath,
          acquisitionSource,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setInfoMessage(data.message || 'Verification code sent to your email.');
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send code. Please check your email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and Enter Game
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = otpCode.trim();

    if (!cleanToken || cleanToken.length < 4) {
      setErrorMessage('Please enter the verification code from your email.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: email.trim().toLowerCase(),
          token: cleanToken,
          displayName: callsign.trim(),
          selectedStartingPath: startingPath,
          acquisitionSource,
          avatarUrl: selectedAvatar,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Verification code failed or expired.');
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        if (data.session?.access_token) {
          window.localStorage.setItem('canton_auth_token', data.session.access_token);
        }
      }

      // Trigger Path Lock Game Moment and navigate smoothly when finished
      const navigateNext = () => {
        if (router && router.push) {
          router.push(redirectTo);
        } else if (typeof window !== 'undefined') {
          window.location.href = redirectTo;
        }
      };

      showGameMoment({
        type: 'path-lock',
        path: startingPath,
        onFinished: navigateNext,
      });

      // Safe fallback timer in case moment is interrupted
      setTimeout(navigateNext, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the confirmation code and try again.');
      setIsLoading(false);
    }
  };

  // Resend code handler
  const handleResend = async () => {
    setIsResending(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: email.trim().toLowerCase(),
          selectedStartingPath: startingPath,
          acquisitionSource,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to resend code');
      setInfoMessage('New verification code sent! Check your inbox.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-stone-900/90 backdrop-blur-md rounded-2xl border border-amber-500/30 p-5 shadow-2xl text-left">
      {/* Top Status Header */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            {step === 1 ? 'Instant Player Onboarding' : 'Step 2: Enter Verification Code'}
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          {pathTitles[startingPath]}
        </span>
      </div>

      {step === 1 ? (
        <form onSubmit={handleSendOtp} className="space-y-3.5">
          <div>
            <label htmlFor="fast-callsign-input" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Choose Your Callsign / Player Name *
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="fast-callsign-input"
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  placeholder="e.g. ApexHunter_330"
                  maxLength={30}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-1 bg-stone-950 border border-stone-700 rounded-xl p-1 shrink-0">
                {AVATAR_OPTIONS.slice(0, 4).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                      selectedAvatar === emoji
                        ? 'bg-amber-500/30 border border-amber-400 scale-110'
                        : 'hover:bg-stone-800 opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Select avatar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="fast-email-input" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Email for Passwordless Verification & Prizes *
            </label>
            <div className="relative">
              <input
                id="fast-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@example.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono text-sm"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-1 font-mono">
              We will send a confirmation code. No passwords to remember.
            </p>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono">
              ⚠️ {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck size={13} />
              Verified Player Security
            </span>
            <span>Path: {startingPath.toUpperCase()}</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl font-display font-extrabold text-base uppercase tracking-wider text-black transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: themeAccent || '#f59e0b',
              boxShadow: `0 4px 20px ${themeAccent || '#f59e0b'}40`,
            }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Sending Magic Code...
              </span>
            ) : (
              <>
                <span>{buttonLabel || `START ADVENTURE ON ${startingPath.toUpperCase()}`}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3.5 animate-fadeIn">
          {infoMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono">
              ✉️ {infoMessage}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="fast-otp-input" className="block text-xs font-mono font-bold text-amber-300">
                Enter Confirmation Code sent to:
              </label>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] font-mono text-stone-400 hover:text-amber-300 underline"
              >
                Change ({email})
              </button>
            </div>
            <input
              id="fast-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter confirmation code"
              autoFocus
              required
              className="w-full px-4 py-3 rounded-xl bg-stone-950 border-2 border-amber-500/60 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-xl tracking-widest text-center"
            />
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono">
              ⚠️ {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-1">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-amber-400 hover:text-amber-300 underline disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
              <span>{isResending ? 'Resending...' : 'Resend Code'}</span>
            </button>
            <span className="text-stone-400 text-[11px]">Valid for 15 min</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl font-display font-extrabold text-base uppercase tracking-wider text-black transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: themeAccent || '#f59e0b',
              boxShadow: `0 4px 20px ${themeAccent || '#f59e0b'}40`,
            }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Verifying Credentials...
              </span>
            ) : (
              <>
                <KeyRound size={18} />
                <span>VERIFY & ENTER CANTON QUESTS</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
