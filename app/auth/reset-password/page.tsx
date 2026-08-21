'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('canton_auth_token');
      if (token) setSessionToken(token);
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = sessionToken || (typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          password: password.trim(),
          authToken: token || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password. Your recovery session may have expired.');
      }

      setIsSuccess(true);

      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Password update failed. Please request a new recovery link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-stone-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-6 sm:p-8 shadow-2xl text-left">
      {/* Top Header Badge */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-800">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
          CANTON QUESTS // SECURITY RECOVERY
        </span>
      </div>

      <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mb-2">
        {isSuccess ? 'PLAYER ACCESS RESTORED' : 'RESTORE PLAYER ACCESS'}
      </h1>

      <p className="text-xs sm:text-sm text-stone-300 font-body mb-6 leading-relaxed">
        {isSuccess
          ? 'Your new password has been securely saved. You can now enter the Player Command Center.'
          : 'Choose a new password for your Canton Quests account to restore full player access.'}
      </p>

      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono flex items-start gap-2.5">
          <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
          <div>
            <strong className="block font-bold">Security Notice</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
            <div className="text-xs font-mono">
              <span className="font-bold block text-sm text-emerald-200">Credentials Updated</span>
              <span>All progress, XP, and badge credentials preserved.</span>
            </div>
          </div>

          <Link
            href="/profile"
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-extrabold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <KeyRound size={16} />
            <span>ENTER COMMAND CENTER</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="reset-new-password" className="block text-xs font-mono font-bold text-stone-200">
                New Password (Min 6 Characters) *
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
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-xs font-mono font-bold text-stone-200 mb-1">
              Confirm New Password *
            </label>
            <input
              id="reset-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs pt-1">
            <ShieldCheck size={14} />
            <span>Supabase Auth Encrypted Credential Vault</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-extrabold text-sm uppercase tracking-wider transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span>Updating Password...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound size={16} />
                <span>SET NEW PASSWORD</span>
                <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-stone-800 text-center">
        <Link href="/" className="text-xs font-mono text-stone-400 hover:text-amber-300">
          ← Return to Canton Quests Home
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#080b10] text-stone-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
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
          <p className="font-mono text-amber-400 text-xs animate-pulse">Loading recovery interface...</p>
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
