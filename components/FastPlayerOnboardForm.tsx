'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, Sparkles, UserCheck, Zap, Eye, EyeOff } from 'lucide-react';
import { StartingPath } from '@/lib/types';
import { showGameMoment } from '@/lib/game-effects';

interface FastPlayerOnboardFormProps {
  /**
   * Optional — Canton Quests permanent account creation never requires a
   * path. Only set this when the form is embedded in an Operation-specific
   * flow that already collected a path (e.g. the Sept 11 Main Operation's
   * ThreePathSelector door confirmation).
   */
  startingPath?: StartingPath;
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
  redirectTo = '/profile',
  themeAccent = '#f59e0b',
}: FastPlayerOnboardFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot_password'>('signup');
  const [callsign, setCallsign] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('⚡');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isVerificationPending, setIsVerificationPending] = useState(false);

  const pathTitles: Record<StartingPath, string> = {
    family: 'Family Adventure Path',
    challenge: 'Kinetic Challenge Path',
    secret: 'Secret Mystery Path',
  };

  // 1. Password Signup Flow
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCallsign = callsign.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanCallsign || cleanCallsign.length < 2) {
      setErrorMessage('Please choose an agent callsign (at least 2 characters).');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (cleanPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both password fields.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: cleanCallsign,
          email: cleanEmail,
          password: cleanPassword,
          selectedStartingPath: startingPath,
          acquisitionSource,
          avatarUrl: selectedAvatar,
          redirectTo,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Registration failed. Please check your details.');
      }

      // If email confirmation link was sent
      if (data.confirmationRequired) {
        setIsVerificationPending(true);
        setInfoMessage(data.message || 'Verification link sent to your email! Click the link in your inbox to enter Canton Quests.');
        return;
      }

      // If session is immediately established
      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
      }

      // Trigger Path Lock Game Moment and navigate smoothly
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
          router.push(redirectTo);
        } else if (typeof window !== 'undefined') {
          window.location.href = redirectTo;
        }
      };

      if (startingPath) {
        showGameMoment({
          type: 'path-lock',
          path: startingPath,
          onFinished: navigateNext,
        });
        fallbackTimer = setTimeout(navigateNext, 3500);
      } else {
        navigateNext();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Returning Player Login Flow (Email + Password only)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('Please enter your password.');
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
          action: 'password_login',
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
      }

      if (router && router.push) {
        router.push(redirectTo);
      } else if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Forgot Password / Recovery Flow
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your email address to receive a recovery link.');
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
          action: 'forgot_password',
          email: cleanEmail,
          redirectTo: '/auth/reset-password',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Failed to send recovery email.');
      }

      setInfoMessage(data.message || 'Password recovery link sent! Check your inbox to set a new password.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-stone-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 p-5 shadow-2xl text-left">
      {/* Top Header & Tab Navigation */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            {mode === 'signup'
              ? 'New Player Signup'
              : mode === 'login'
              ? 'Returning Player Login'
              : 'Password Recovery'}
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          {startingPath ? pathTitles[startingPath] : 'Create Player Identity'}
        </span>
      </div>

      {/* Mode Selector Tabs */}
      {!isVerificationPending && (
        <div className="flex items-center gap-2 mb-3 p-1 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage('');
              setInfoMessage('');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            CREATE ACCOUNT
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setInfoMessage('');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            LOG IN
          </button>
        </div>
      )}

      {/* Info / Status Banner */}
      {infoMessage && (
        <div className="p-3 mb-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-start gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-2.5 mb-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono">
          ⚠️ {errorMessage}
        </div>
      )}

      {isVerificationPending ? (
        <div className="space-y-3 py-2 text-center">
          <div className="p-4 rounded-xl bg-stone-950 border border-amber-500/30">
            <Mail size={32} className="mx-auto text-amber-400 mb-2 animate-bounce" />
            <h3 className="font-display font-black text-sm text-white uppercase mb-1">
              Check Your Inbox
            </h3>
            <p className="text-xs text-stone-300 font-body leading-relaxed">
              We sent a verification link to <strong>{email}</strong>. Click the link in the email to activate your account and enter the Player Command Center.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsVerificationPending(false);
              setMode('login');
            }}
            className="text-xs font-mono text-amber-400 hover:text-amber-300 underline"
          >
            Already verified? Enter via Log In →
          </button>
        </div>
      ) : mode === 'signup' ? (
        /* MODE 1: SIGN UP */
        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label htmlFor="onboard-callsign" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Choose Your Callsign / Player Name *
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="onboard-callsign"
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
            <label htmlFor="onboard-email" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Email Address (For Verification & Prizes) *
            </label>
            <input
              id="onboard-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="onboard-password" className="block text-xs font-mono font-bold text-stone-200">
                Password (Min 6 Characters) *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-mono text-stone-400 hover:text-amber-300 flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <input
              id="onboard-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="onboard-confirm-password" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Confirm Password *
            </label>
            <input
              id="onboard-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck size={13} />
              Verified Player Security
            </span>
            {startingPath && <span>Path: {startingPath.toUpperCase()}</span>}
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
                <RefreshCw size={16} className="animate-spin" />
                Creating Player Account...
              </span>
            ) : (
              <>
                <span>{buttonLabel || (startingPath ? `JOIN ON ${startingPath.toUpperCase()}` : 'CREATE PLAYER IDENTITY')}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      ) : mode === 'login' ? (
        /* MODE 2: RETURNING LOGIN */
        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label htmlFor="returning-login-email" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Email *
            </label>
            <input
              id="returning-login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="returning-login-password" className="block text-xs font-mono font-bold text-stone-200">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-mono text-stone-400 hover:text-amber-300 flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <input
              id="returning-login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <button
              type="button"
              onClick={() => {
                setMode('forgot_password');
                setErrorMessage('');
                setInfoMessage('');
              }}
              className="text-amber-400 hover:text-amber-300 underline"
            >
              FORGOT PASSWORD?
            </button>
            <span className="text-stone-400 flex items-center gap-1 text-[11px]">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Encrypted Session</span>
            </span>
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
                <RefreshCw size={16} className="animate-spin" />
                Authenticating...
              </span>
            ) : (
              <>
                <KeyRound size={18} />
                <span>ENTER CANTON QUESTS</span>
              </>
            )}
          </button>
        </form>
      ) : (
        /* MODE 3: FORGOT PASSWORD */
        <form onSubmit={handleForgotPassword} className="space-y-3.5">
          <div>
            <label htmlFor="recovery-email" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Account Email Address *
            </label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
            <p className="text-[11px] text-stone-400 mt-1 font-mono">
              We will send a scanner-safe recovery link to set a new password.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setInfoMessage('');
              }}
              className="text-stone-400 hover:text-amber-300 underline"
            >
              ← Back to Log In
            </button>
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
                <RefreshCw size={16} className="animate-spin" />
                Sending Recovery Link...
              </span>
            ) : (
              <>
                <Mail size={18} />
                <span>SEND RECOVERY LINK</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
