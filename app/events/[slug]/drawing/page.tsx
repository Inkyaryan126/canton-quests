'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { PublicDrawingPageData } from '@/lib/types';
import { showGameMoment } from '@/lib/game-effects';

export default function PublicDrawingPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<PublicDrawingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  useEffect(() => {
    async function fetchDrawingData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/game/events/${params.slug}/drawing`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Failed to load drawing page data');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error loading drawing data');
      } finally {
        setLoading(false);
      }
    }

    fetchDrawingData();
  }, [params.slug]);

  const copyHashToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyNumberToClipboard = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/events/${params.slug}`}
            className="inline-flex items-center text-sm font-mono text-amber-400 hover:text-amber-300 transition-colors"
          >
            ← Back to Quest Details
          </Link>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            AUDITABLE PRIZE DRAWING SYSTEM
          </span>
        </div>

        {loading && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center my-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-400 border-t-transparent mb-4"></div>
            <p className="font-mono text-slate-400">Loading authoritative drawing ledger projection...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-800/80 rounded-2xl p-6 text-center my-8">
            <h2 className="text-lg font-bold text-red-300 mb-2">Unable to Load Drawing Page</h2>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            {/* Event Header Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {data.eventTitle}
                  </h1>
                  <p className="text-sm font-mono text-slate-400 mt-1">Official Quest Prize Drawing</p>
                </div>

                {/* Status Badge */}
                <div>
                  {data.ledgerLockStatus === 'open' || data.ledgerLockStatus === 'review' ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-700/50">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      DRAWING NOT YET FINALIZED
                    </span>
                  ) : data.ledgerLockStatus === 'locked' ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      ENTRY LEDGER LOCKED & HASHED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      DRAWING COMPLETE & PUBLISHED
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                  <span className="block text-xs font-mono text-slate-400 uppercase">Qualified Players</span>
                  <span className="text-xl sm:text-2xl font-black text-white font-mono">{data.totalQualifiedPlayers}</span>
                </div>
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                  <span className="block text-xs font-mono text-slate-400 uppercase">Total Valid Tickets</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">{data.totalQualifiedEntries} tickets</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                  <span className="block text-xs font-mono text-slate-400 uppercase">Ledger State</span>
                  <span className="text-sm font-bold font-mono text-slate-200 capitalize mt-1 block">
                    {data.ledgerLockStatus}
                  </span>
                </div>
              </div>

              {/* Finale Qualification Ceremony Button */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    showGameMoment({
                      type: 'finale-qualified',
                      qualifiedEntries: data.totalQualifiedEntries,
                      snapshotHash: data.snapshotHash || undefined,
                      eventTitle: data.eventTitle,
                      isLocked: data.ledgerLockStatus === 'drawn' || data.ledgerLockStatus === 'published',
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-300 hover:bg-amber-500/30 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>✨ Inspect Official Qualification Ceremony</span>
                </button>
              </div>
            </div>

            {/* Published Winners Ceremonial Section */}
            {data.publishedPrizes && data.publishedPrizes.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-b from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 border-b border-amber-500/20 pb-4">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <h2 className="text-xl font-extrabold text-amber-200">Official Quest Winners</h2>
                      <p className="text-xs text-slate-400 font-mono">
                        Drawn from locked entry pool • {data.publishedPrizes.some((p) => p.drawMethod === 'manual_external' || p.isSystemVerified === false) ? 'Official Quest Results' : 'Audited & System Verified'}
                      </p>
                    </div>
                  </div>

                  {data.publishedPrizes.some((p) => p.drawMethod === 'internal_test') && (
                    <div className="bg-amber-950/80 border border-amber-600/80 text-amber-200 p-4 rounded-xl text-xs font-mono mb-6">
                      ⚠️ <strong>INTERNAL TEST / NON-INDEPENDENT SEED MODE</strong>: The winner result(s) below were generated using an internal deterministic test seed for verification purposes and do NOT represent an official independent public drawing.
                    </div>
                  )}

                  {data.publishedPrizes.some((p) => p.drawMethod === 'manual_external' || p.isSystemVerified === false) && (
                    <div className="bg-amber-950/80 border border-amber-600/80 text-amber-200 p-4 rounded-xl text-xs font-mono mb-6">
                      ℹ️ <strong>UNVERIFIED OR MANUALLY RECORDED RESULT(S) PRESENT</strong>: Winner result(s) marked as Manual External or Not System Verified were entered manually or are unverified by Canton Quests. These entries store any admin-supplied reference string, but are marked <strong>NOT SYSTEM VERIFIED</strong> and <strong>NOT INDEPENDENTLY VERIFIED</strong>.
                    </div>
                  )}

                  <div className="grid gap-4">
                    {data.publishedPrizes.map((prize, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
                            {prize.prizeTitle}
                          </span>
                          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                            <span className="text-amber-400">🏅</span> {prize.winnerPublicLabel}
                          </div>
                        </div>

                        <div className="text-left sm:text-right text-xs font-mono text-slate-400 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0 w-full sm:w-auto">
                          <div className="text-slate-300">Method: {prize.drawMethod === 'final_quest' ? 'The Final Quest Trail' : prize.drawMethod}</div>
                          {prize.drawMethod === 'final_quest' ? (
                            <div className="text-emerald-400/90 text-[11px] mt-0.5 font-bold">Status: Publicly Verifiable Trail</div>
                          ) : prize.drawMethod === 'manual_external' ? (
                            <div className="text-amber-400/90 text-[11px] mt-0.5 font-bold">Status: Manually Recorded (Not System Verified)</div>
                          ) : prize.isSystemVerified === false ? (
                            <div className="text-amber-400/90 text-[11px] mt-0.5 font-bold">Status: Not System Verified</div>
                          ) : (
                            <div className="text-emerald-400/90 text-[11px] mt-0.5 font-bold">Status: System Verified</div>
                          )}
                          {prize.providerReference && (
                            <div className="text-slate-400 text-[11px] mt-0.5">Admin Ref: {prize.providerReference}</div>
                          )}
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            Drawn: {new Date(prize.drawnAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* THE FINAL QUEST PUBLIC DRAW RECEIPT SECTION */}
                {data.publishedPrizes.some((p) => p.finalQuestReceipt) && (
                  <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
                      <span className="text-3xl">📜</span>
                      <div>
                        <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                          PUBLIC TRANSPARENT DRAW RECEIPT
                        </span>
                        <h2 className="text-2xl font-extrabold text-white">THE FINAL QUEST</h2>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">
                          Follow the exact mathematical trail that selected the winning ticket.
                        </p>
                      </div>
                    </div>

                    {data.publishedPrizes
                      .filter((p) => p.finalQuestReceipt)
                      .map((p, pIdx) => {
                        const receipt = p.finalQuestReceipt!;
                        return (
                          <div key={pIdx} className="space-y-5">
                            <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/20 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                              <div>
                                <span className="text-slate-400 uppercase block text-[10px]">Prize:</span>
                                <strong className="text-amber-300 text-sm">{receipt.eventTitle}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 uppercase block text-[10px]">Total Valid Tickets:</span>
                                <strong className="text-white text-sm">{receipt.totalTickets}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 uppercase block text-[10px]">Ticket Number Width:</span>
                                <strong className="text-cyan-300 text-sm">{receipt.ticketWidth} digits</strong>
                              </div>
                            </div>

                            {/* 1. Predetermined Event Numbers */}
                            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                              <h3 className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                                1. Predetermined Event Numbers (Frozen at Event Close)
                              </h3>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">Players</span>
                                  <strong className="text-white text-base">{receipt.eventMetrics.totalPlayers}</strong>
                                </div>
                                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">Valid Prize Tickets</span>
                                  <strong className="text-white text-base">{receipt.eventMetrics.totalValidEntries}</strong>
                                </div>
                                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">Completed Quests</span>
                                  <strong className="text-white text-base">{receipt.eventMetrics.totalCompletedQuests}</strong>
                                </div>
                                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">Finishers</span>
                                  <strong className="text-white text-base">{receipt.eventMetrics.totalFinishers}</strong>
                                </div>
                              </div>
                            </div>

                            {/* 2. Permanent Canton Quests Number */}
                            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2 font-mono text-xs">
                              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                2. Permanent Canton Quests Number
                              </h3>
                              <p className="text-slate-400 text-[11px]">
                                Derived from the letters of CANTON QUESTS (A=1, B=2, ... Z=26): C(3) A(1) N(14) T(20) O(15) N(14) Q(17) U(21) E(5) S(19) T(20) S(19).
                              </p>
                              <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700/80 text-amber-400 font-bold tracking-widest text-sm select-all">
                                {receipt.permanentNumber}
                              </div>
                            </div>

                            {/* 3. The Final Quest Number */}
                            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                                  3. Final Quest Number
                                </h3>
                                <button
                                  onClick={() => copyNumberToClipboard(receipt.finalQuestNumber)}
                                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                                >
                                  {copiedNumber ? '✓ Copied' : 'Copy Number'}
                                </button>
                              </div>
                              <p className="text-slate-400 text-[11px]">
                                Calculated as: {receipt.productFormula}
                              </p>
                              <div className="bg-slate-900 p-3 rounded-lg border border-cyan-900/50 text-cyan-300 font-mono text-xs break-all select-all">
                                {receipt.finalQuestNumber}
                              </div>
                            </div>

                            {/* 4. Follow The Trail (Sliding Window) */}
                            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                4. Follow The Trail (Sliding Window Scan)
                              </h3>
                              <p className="text-slate-400 text-[11px]">
                                Scanned {receipt.ticketWidth}-digit overlapping windows from left to right. The first valid ticket number encountered wins.
                              </p>
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {receipt.trailSteps.map((step, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                                      step.isValid
                                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200 font-bold'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <span className="shrink-0 px-2 py-0.5 bg-slate-950 rounded text-[10px] border border-slate-800">
                                      Step {step.stepIndex}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-bold text-white mr-2">{step.windowString}</span>
                                      <span>— {step.reason}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* WINNER RESULT BANNER */}
                            <div className="bg-gradient-to-r from-amber-950/80 to-emerald-950/80 border border-emerald-500/40 p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                                  🏆 OFFICIAL WINNING TICKET
                                </span>
                                <div className="text-3xl font-black text-white mt-1">
                                  Ticket #{receipt.winningTicket}
                                </div>
                                <span className="text-xs text-emerald-300 mt-1 block">
                                  Held by: <strong>{receipt.winningPublicPlayerLabel}</strong> (Ticket Range #{receipt.winningPlayerTicketRange.start}–#{receipt.winningPlayerTicketRange.end})
                                </span>
                              </div>
                              <div className="text-left sm:text-right text-xs text-slate-300">
                                <span className="block text-[10px] text-slate-400 uppercase">Resolution Method:</span>
                                <span className="font-bold text-amber-300">
                                  {receipt.resolutionMethod === 'forward_trail'
                                    ? 'Standard Forward Trail'
                                    : receipt.resolutionMethod === 'reverse_trail'
                                    ? 'Reverse Fallback Trail'
                                    : 'Deterministic Modulo Fallback'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : data.ledgerLockStatus === 'locked' ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
                <span className="text-4xl block mb-3">⏳</span>
                <h3 className="text-lg font-bold text-white mb-1">Winner Selection Pending</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  The entry pool has been locked and hashed. Game Masters are conducting the transparent Final Quest winner selection. Results will be published here upon completion.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
                <span className="text-4xl block mb-3">🎲</span>
                <h3 className="text-lg font-bold text-white mb-1">Drawing In Progress</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  The event drawing entry pool is currently open. Complete active event quests to earn additional drawing entries before the ledger freezes!
                </p>
              </div>
            )}

            {/* Cryptographic Ledger Freeze Box (Shown if Locked or Published) */}
            {data.snapshotHash && (
              <div className="bg-slate-900/80 border border-cyan-900/40 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <h2 className="text-sm font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>🔒</span> Frozen Ledger Cryptographic Fingerprint (SHA-256)
                </h2>
                <p className="text-xs text-slate-300 mb-3">
                  This fingerprint proves that the drawing entry pool was locked and frozen before any winner was drawn. Any modification to entries changes this hash.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs text-cyan-300 break-all select-all">
                    {data.snapshotHash}
                  </div>
                  <button
                    onClick={() => copyHashToClipboard(data.snapshotHash || '')}
                    className="px-4 py-3 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-200 font-mono text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95"
                  >
                    {copied ? '✓ COPIED!' : '📋 COPY HASH'}
                  </button>
                </div>

                {/* Deterministic Canonical Snapshot Export for Independent Verification */}
                {data.canonicalSnapshot && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-300 font-bold">
                        📄 Deterministic Canonical Snapshot Export (Public Audit Payload)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(data.canonicalSnapshot, null, 2));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                      >
                        Copy Snapshot JSON
                      </button>
                    </div>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-slate-400 font-mono hover:text-slate-200 transition-colors">
                        View canonical snapshot JSON payload ({data.canonicalSnapshot.players.length} entries)
                      </summary>
                      <pre className="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                        {JSON.stringify(data.canonicalSnapshot, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {data.ledgerLockTimestamp && (
                  <p className="text-[11px] font-mono text-slate-400 mt-2">
                    Frozen at: {new Date(data.ledgerLockTimestamp).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Public Entry Pool Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>📊</span> Public Entry Ledger Breakdown & Assigned Ticket Ranges
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {data.publicPlayerEntries.length} Qualified Participant(s)
                </span>
              </div>

              {data.publicPlayerEntries.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 text-center">No qualified entries recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Public Player Label</th>
                        <th className="py-2.5 px-3 text-right">Qualified Tickets</th>
                        {data.ticketRanges && <th className="py-2.5 px-3 text-right">Assigned Ticket Numbers</th>}
                        <th className="py-2.5 px-3 text-right">Drawing Odds (Approx)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data.publicPlayerEntries.map((player, i) => {
                        const pct = data.totalQualifiedEntries > 0
                          ? ((player.totalQualifiedEntries / data.totalQualifiedEntries) * 100).toFixed(1)
                          : '0.0';
                        const matchingRange = data.ticketRanges?.find(
                          (r) => r.publicPlayerLabel === player.playerPublicLabel
                        );
                        return (
                          <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2">
                              <span className="text-amber-400 text-xs">●</span>
                              {player.playerPublicLabel}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-amber-300">
                              {player.totalQualifiedEntries}
                            </td>
                            {data.ticketRanges && (
                              <td className="py-3 px-3 text-right text-xs text-cyan-300">
                                {matchingRange
                                  ? `#${matchingRange.startTicket} – #${matchingRange.endTicket}`
                                  : '—'}
                              </td>
                            )}
                            <td className="py-3 px-3 text-right text-xs text-slate-400">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transparency & Verification Guarantees Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 space-y-3 font-mono">
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>🛡️</span> Canton Quests Transparency & Fairness Guarantees
              </h4>
              <p>
                1. <strong>Fixed Method Beforehand</strong>: Winner selection follows a predetermined, documented sliding-window scan across the Final Quest Number.
              </p>
              <p>
                2. <strong>Frozen Event Totals</strong>: The Final Quest Number is calculated by multiplying predetermined event totals with the permanent Canton Quests number (311420151417215192019). No variable can be altered after the event closes.
              </p>
              <p>
                3. <strong>Automatic & Reproducible</strong>: The process requires zero human intervention or administrator choice. Anyone can replicate the calculation and verify the winning ticket.
              </p>
              <p>
                4. <strong>Privacy Shield</strong>: Public results display only privacy-safe public labels (`Agent #XXXX` or sanitized display names). Private user IDs, emails, phone numbers, and coordinates are never exposed publicly.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
