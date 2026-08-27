'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { computeFairDashboardProgress, FairDashboardProgress } from '@/lib/fair-hunt';
import { PublicQuestView } from '@/lib/types';

type ClaimReason =
  | 'secured'
  | 'already_secured'
  | 'not_yet_active'
  | 'expired'
  | 'inactive'
  | 'not_recognized'
  | 'rejected'
  | 'error';

interface ClaimResponse {
  success: boolean;
  reason: ClaimReason;
  message?: string;
  isBonus?: boolean;
  isFair?: boolean;
  pointsAwarded?: number;
  quest?: PublicQuestView;
  eventId?: string;
}

interface FairSummary {
  fairScore: number;
  progress: FairDashboardProgress;
  rank: number | null;
}

function AuthGate({ nextPath }: { nextPath: string }) {
  const next = encodeURIComponent(nextPath);
  return (
    <div className="glass-panel p-8 w-full border-cyan-500/40 glow-cyan text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-cyan-500/20">
        📡
      </div>
      <span className="badge badge-medium bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono">
        CANTON QR SIGNAL DETECTED
      </span>
      <h1 className="text-xl font-extrabold text-white">One Player Identity gets you into every Mission.</h1>
      <p className="text-sm text-gray-300">Create your player identity or access your Command Center to claim this signal.</p>
      <div className="flex flex-col gap-2 pt-2">
        <Link href={`/register?next=${next}`} className="btn btn-primary w-full py-3 text-sm font-bold">
          CREATE PLAYER IDENTITY
        </Link>
        <Link href={`/login?next=${next}`} className="btn btn-secondary w-full py-2.5 text-xs font-mono">
          ACCESS COMMAND CENTER
        </Link>
      </div>
    </div>
  );
}

const REASON_COPY: Partial<Record<ClaimReason, { title: string; icon: string }>> = {
  secured: { title: 'QR SECURED', icon: '✅' },
  already_secured: { title: 'ALREADY SECURED', icon: '📋' },
  not_recognized: { title: 'SIGNAL NOT RECOGNIZED', icon: '❓' },
  rejected: { title: 'CLAIM FAILED', icon: '⚠️' },
  error: { title: 'SIGNAL ERROR', icon: '⚠️' },
};

function getWindowCopy(isBonus?: boolean, expired?: boolean): { title: string; body: string } {
  if (isBonus) {
    return expired
      ? { title: 'BONUS WINDOW CLOSED', body: "This daily bonus signal's window has already ended." }
      : { title: 'BONUS SIGNAL INACTIVE', body: 'This daily bonus signal is not live yet. Check back on its assigned day.' };
  }
  return expired
    ? { title: 'SIGNAL WINDOW CLOSED', body: 'This signal is no longer active.' }
    : { title: 'SIGNAL NOT YET ACTIVE', body: 'This signal is not live yet.' };
}

export default function QrClaimPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const nextPath = `/qr/${encodeURIComponent(code)}`;

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [fairSummary, setFairSummary] = useState<FairSummary | null>(null);
  const [geo, setGeo] = useState<{ userLat?: number; userLon?: number; userAccuracyMeters?: number }>({});

  // Opportunistic, non-blocking GPS — only the small set of existing QR
  // quests that also require location (Quest.requireQrAndLocation) actually
  // need this; the server decides whether it's required. Never blocks or
  // delays the claim waiting on permission.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          userLat: pos.coords.latitude,
          userLon: pos.coords.longitude,
          userAccuracyMeters: pos.coords.accuracy,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setIsAuthenticated(Boolean(data.isAuthenticated));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || claiming || result) return;
    let cancelled = false;
    setClaiming(true);
    fetch('/api/qr/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, ...geo }),
    })
      .then((res) => res.json())
      .then(async (data: ClaimResponse) => {
        if (cancelled) return;
        setResult(data);
        if (data.isFair && (data.reason === 'secured' || data.reason === 'already_secured')) {
          try {
            const dashRes = await fetch('/api/fair/dashboard');
            const dash = await dashRes.json();
            if (!cancelled && dash.success && dash.isAuthenticated) {
              const progress = computeFairDashboardProgress(dash.quests, dash.claimedQuestIds);
              setFairSummary({ fairScore: progress.totalScore, progress, rank: dash.rank });
            }
          } catch {
            // Fair summary is a nice-to-have on the success screen — the claim itself already succeeded.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ success: false, reason: 'error' });
      })
      .finally(() => {
        if (!cancelled) setClaiming(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isAuthenticated]);

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />
      <main className="flex-1 max-w-xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center items-center">
        {!authChecked ? (
          <div className="glass-panel p-8 w-full text-center text-sm text-gray-300 font-mono">Verifying session...</div>
        ) : !isAuthenticated ? (
          <AuthGate nextPath={nextPath} />
        ) : claiming || !result ? (
          <div className="glass-panel p-8 w-full border-cyan-500/40 glow-cyan text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-cyan-500/20 animate-pulse">
              📡
            </div>
            <p className="text-sm font-mono text-cyan-300">Checking signal...</p>
          </div>
        ) : (
          <ClaimResultPanel result={result} fairSummary={fairSummary} />
        )}
      </main>
    </div>
  );
}

function ClaimResultPanel({ result, fairSummary }: { result: ClaimResponse; fairSummary: FairSummary | null }) {
  const isFair = Boolean(result.isFair || result.quest?.category === 'fair_core' || result.quest?.category === 'fair_bonus');
  const backHref = isFair ? '/events/fair-qr-hunt' : '/quests';
  const backLabel = isFair ? 'BACK TO FAIR HUNT DASHBOARD' : 'RETURN TO QUESTS';

  if (result.reason === 'not_yet_active' || result.reason === 'expired') {
    const copy = getWindowCopy(result.isBonus, result.reason === 'expired');
    return (
      <div className="glass-panel p-8 w-full border-amber-500/40 text-center space-y-4">
        <div className="text-3xl">⏳</div>
        <h1 className="text-xl font-extrabold text-white">{copy.title}</h1>
        <p className="text-sm text-gray-300">{copy.body}</p>
        <Link href={backHref} className="btn btn-secondary w-full py-2.5 text-xs font-mono">
          {backLabel}
        </Link>
      </div>
    );
  }

  if (result.reason === 'inactive') {
    return (
      <div className="glass-panel p-8 w-full border-stone-600 text-center space-y-4">
        <div className="text-3xl">🔌</div>
        <h1 className="text-xl font-extrabold text-white">SIGNAL OFFLINE</h1>
        <p className="text-sm text-gray-300">This signal isn&apos;t currently active.</p>
        <Link href={backHref} className="btn btn-secondary w-full py-2.5 text-xs font-mono">
          {backLabel}
        </Link>
      </div>
    );
  }

  if (result.reason === 'not_recognized' || result.reason === 'error' || result.reason === 'rejected') {
    const copy = REASON_COPY[result.reason]!;
    return (
      <div className="glass-panel p-8 w-full border-red-500/40 text-center space-y-4">
        <div className="text-3xl">{copy.icon}</div>
        <h1 className="text-xl font-extrabold text-white">{copy.title}</h1>
        <p className="text-sm text-gray-300">
          {result.reason === 'not_recognized'
            ? "This code doesn't match any active Canton Quests signal."
            : 'Something went wrong verifying this signal. Please try again.'}
        </p>
        <Link href="/" className="btn btn-secondary w-full py-2.5 text-xs font-mono">
          RETURN TO CANTON HUB
        </Link>
      </div>
    );
  }

  // secured | already_secured
  const isSecured = result.reason === 'secured';
  return (
    <div className={`glass-panel p-8 w-full text-center space-y-5 ${isSecured ? 'border-emerald-500/50 glow-emerald' : 'border-cyan-500/40'}`}>
      <div className="text-4xl">{isSecured ? '🎉' : '📋'}</div>
      <span
        className={`badge badge-medium font-mono ${
          isSecured ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        }`}
      >
        {isSecured ? 'QR SECURED' : 'ALREADY SECURED'}
      </span>

      <h1 className="text-2xl font-extrabold text-white">{result.quest?.title || 'Signal'}</h1>

      {!isSecured && <p className="text-sm text-gray-300">This QR is already in your Fair Hunt record.</p>}

      {isSecured && (
        <div className="text-amber-400 font-display font-extrabold text-lg">+{result.pointsAwarded} points</div>
      )}

      {isFair && fairSummary && (
        <div className="p-4 bg-obsidian/70 rounded-xl border border-gray-800 text-left space-y-2 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Fair Score</span>
            <span className="text-white font-bold">{fairSummary.fairScore} pts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Core QRs Found</span>
            <span className="text-white font-bold">
              {fairSummary.progress.coreFoundCount} / {fairSummary.progress.coreTotalCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Daily Bonuses Found</span>
            <span className="text-white font-bold">
              {fairSummary.progress.bonusFoundCount} / {fairSummary.progress.bonusTotalCount}
            </span>
          </div>
          {fairSummary.rank && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Leaderboard Position</span>
              <span className="text-white font-bold">#{fairSummary.rank}</span>
            </div>
          )}
        </div>
      )}

      <Link href={backHref} className="btn btn-primary w-full py-3 text-sm font-bold inline-block">
        {backLabel}
      </Link>
    </div>
  );
}
