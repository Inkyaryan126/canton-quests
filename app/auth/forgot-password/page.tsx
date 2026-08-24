'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, ArrowLeft } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

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

      setSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="bg-stone-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 p-6 sm:p-8 shadow-2xl text-left">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-800">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            PASSWORD RECOVERY
          </span>
        </div>

        {sent ? (
          <div className="space-y-4">
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              CHECK YOUR INBOX
            </h1>
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs font-mono">
                <span className="font-bold block text-sm text-emerald-200 mb-1">Recovery Link Sent</span>
                <span>
                  If an account exists for <strong>{email}</strong>, a secure reset link has been sent to that inbox.
                  Check your spam folder if it doesn&apos;t arrive within a minute.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mb-1">
              RESTORE ACCOUNT
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 font-body mb-5 leading-relaxed">
              Enter your account email and we&apos;ll send a secure link to set a new password.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono text-sm"
                />
                <p className="text-[11px] text-stone-400 mt-1.5 font-mono">
                  We&apos;ll send a secure reset link to this address.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-display font-extrabold text-base uppercase tracking-wider transition-all transform active:scale-98 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    <span>Sending Recovery Link...</span>
                  </>
                ) : (
                  <>
                    <Mail size={17} />
                    <span>SEND RECOVERY LINK</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Back to login — separate */}
      <Link
        href="/auth/login"
        className="flex items-center justify-center gap-2 w-full bg-stone-900/70 hover:bg-stone-900 border border-stone-700 hover:border-stone-600 rounded-xl px-5 py-3.5 transition-all group"
      >
        <ArrowLeft size={14} className="text-stone-400 group-hover:text-white transition-colors" />
        <span className="text-sm font-mono text-stone-300 group-hover:text-white transition-colors">
          Back to Log In
        </span>
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#080b10] text-stone-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

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
        <ForgotPasswordContent />
      </Suspense>
    </main>
  );
}
