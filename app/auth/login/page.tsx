'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, RefreshCw, Mail, Compass } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || searchParams.get('redirectTo') || '/profile';

  const [mode, setMode] = useState<'login' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // If already authenticated, redirect to next or /profile
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
            window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
          }
          router.push(nextParam);
        }
      })
      .catch(() => {});
  }, [router, nextParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
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

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      // Save non-sensitive player profile in localStorage for instant UI display
      // Auth session is persistently secured via HTTP-only cookies
      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        // Clean up legacy token keys if present
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
      }

      router.push(nextParam);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address to receive a recovery link.');
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

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send recovery email.');
      }

      setInfoMessage(data.message || 'Password recovery link sent! Check your inbox to set a new password.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-stone-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 p-6 sm:p-8 shadow-2xl text-left">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            {mode === 'login' ? 'PLAYER ACCESS' : 'PASSWORD RECOVERY'}
          </span>
        </div>
      </div>

      <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mb-2">
        {mode === 'login' ? 'WELCOME BACK' : 'RESTORE ACCOUNT'}
      </h1>

      <p className="text-xs sm:text-sm text-stone-300 font-body mb-5 leading-relaxed">
        {mode === 'login'
          ? 'Enter your email and password to access your Player Command Center.'
          : 'Enter your email address to receive a secure reset link.'}
      </p>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono flex items-start gap-2.5">
          <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-start gap-2.5">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email-input" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Email *
            </label>
            <input
              id="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password-input" className="block text-xs font-mono font-bold text-stone-200">
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
              id="login-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs font-mono">
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
            <span className="text-stone-400 flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Encrypted Session</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-extrabold text-sm uppercase tracking-wider transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound size={16} />
                <span>ENTER CANTON QUESTS</span>
                <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label htmlFor="recovery-email-input" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Account Email Address *
            </label>
            <input
              id="recovery-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
            <p className="text-[11px] text-stone-400 mt-1 font-mono">
              We&apos;ll send a secure reset link to your inbox.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs font-mono">
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
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-extrabold text-sm uppercase tracking-wider transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span>Sending Recovery Link...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Mail size={16} />
                <span>SEND RECOVERY LINK</span>
                <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>
      )}

      {/* Footer link to Sign up */}
      <div className="mt-6 pt-4 border-t border-stone-800 flex items-center justify-between text-xs font-mono">
        <span className="text-stone-400">First time here?</span>
        <Link href="/#choose-path" className="text-amber-400 hover:text-amber-300 underline font-bold flex items-center gap-1">
          <Compass size={13} />
          <span>Create your agent profile</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#080b10] text-stone-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <Image
            src={cqImages.logoNav || '/brand/canton-quests-master-logo.png'}
            alt="Canton Quests Logo"
            width={48}
            height={48}
            priority
            className="rounded-xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <div className="text-left">
            <span className="font-display font-black text-xl text-white tracking-tight block">
              CANTON <span className="text-amber-400">QUESTS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 tracking-wider block uppercase">
              Field Operations // Canton, OH
            </span>
          </div>
        </Link>
      </div>

      <Suspense fallback={
        <div className="w-full max-w-md bg-stone-900/90 rounded-2xl border border-amber-500/30 p-8 text-center">
          <p className="font-mono text-amber-400 text-xs animate-pulse">Loading login terminal...</p>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </main>
  );
}
