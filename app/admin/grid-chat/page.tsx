'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Flag, Radio, RefreshCw, RotateCcw, Send, Trash2 } from 'lucide-react';
import type { GridChatModerationAction, GridChatModerationReport } from '@/lib/grid/server/chat-moderation';

export default function GridChatModerationPage() {
  const [reports, setReports] = useState<GridChatModerationReport[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/grid/chat/reports?status=${encodeURIComponent(status)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load reports');
      setReports(body.reports ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  async function broadcast() {
    if (!broadcastBody.trim() || broadcasting) return;
    setBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const clientNonce = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `commander:${crypto.randomUUID()}`
        : `commander:${Date.now()}`;
      const response = await fetch('/api/admin/grid/chat/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: broadcastBody, clientNonce }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Broadcast failed');
      setBroadcastBody('');
      setBroadcastStatus('Commander transmission sent to CITY // OPEN CHANNEL.');
    } catch (reason) {
      setBroadcastStatus(reason instanceof Error ? reason.message : 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  }

  async function act(reportId: string, action: GridChatModerationAction) {
    setBusyId(reportId);
    try {
      const response = await fetch(`/api/admin/grid/chat/reports/${encodeURIComponent(reportId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Moderation failed');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Moderation failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white"><ArrowLeft size={14} /> Admin</Link>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"><RefreshCw size={13} /> Refresh</button>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">The Grid // Safety Console</div>
            <h1 className="mt-2 text-4xl font-black uppercase">Chat Reports</h1>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm">
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </div>

        <section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-300"><Radio size={17} /></div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Official Grid Signal</div>
              <h2 className="mt-1 text-xl font-black uppercase">Commander Broadcast</h2>
            </div>
          </div>
          <textarea value={broadcastBody} onChange={(event) => setBroadcastBody(event.target.value)} maxLength={1200} rows={3} placeholder="Transmit an official message to CITY // OPEN CHANNEL…" className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-600">Players see this as SYSTEM // COMMANDER</span>
            <button type="button" onClick={() => void broadcast()} disabled={broadcasting || !broadcastBody.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-black disabled:opacity-30"><Send size={13} /> {broadcasting ? 'Transmitting…' : 'Broadcast'}</button>
          </div>
          {broadcastStatus && <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">{broadcastStatus}</div>}
        </section>

        {error && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-600">Loading report queue…</div>
        ) : reports.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-12 text-center">
            <CheckCircle2 className="mx-auto text-emerald-400" size={30} />
            <h2 className="mt-4 text-xl font-black uppercase">Queue Clear</h2>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {reports.map((report) => (
              <article key={report.reportId} className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-6">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300"><Flag size={13} /> {report.reason}</div>
                    <div className="mt-1 text-xs text-slate-600">Reported by {report.reporter.callsign} · {report.channel.displayName} · {report.channel.channelType}</div>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{report.status}</span>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/50 p-4">
                  <div className="text-xs font-black uppercase text-cyan-300">{report.message.sender.callsign}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{report.message.body}</p>
                  <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-700">Message status: {report.message.status}</div>
                </div>
                {report.details && <div className="mt-3 rounded-xl bg-amber-300/5 p-3 text-xs text-amber-100/70">Reporter note: {report.details}</div>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button disabled={busyId === report.reportId} onClick={() => void act(report.reportId, 'hide')} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/10 disabled:opacity-40"><EyeOff size={13} /> Hide</button>
                  <button disabled={busyId === report.reportId} onClick={() => void act(report.reportId, 'remove')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-400/10 disabled:opacity-40"><Trash2 size={13} /> Remove</button>
                  <button disabled={busyId === report.reportId} onClick={() => void act(report.reportId, 'restore')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"><RotateCcw size={13} /> Restore</button>
                  <button disabled={busyId === report.reportId} onClick={() => void act(report.reportId, 'dismiss')} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 disabled:opacity-40"><Eye size={13} /> Dismiss report</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
