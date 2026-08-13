'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { QuestEvent, DrawingLedgerReview, PrizeDrawRecord } from '@/lib/types';
import { getEvents } from '@/lib/game-engine';

export default function AdminDrawingPage() {
  const [adminPassphrase, setAdminPassphrase] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [review, setReview] = useState<DrawingLedgerReview | null>(null);
  const [publicData, setPublicData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Controls
  const [lockReason, setLockReason] = useState('Official Event Finale Freeze');
  const [confirmPendingBypass, setConfirmPendingBypass] = useState(false);
  const [drawMethod, setDrawMethod] = useState<'internal_test' | 'manual_external'>('internal_test');
  const [prizeTitle, setPrizeTitle] = useState('Grand Prize — Canton Adventure Package');
  const [testSeed, setTestSeed] = useState('TEST-SEED-2026-ALPHA');
  const [providerReference, setProviderReference] = useState('');
  const [manualWinnerPublicLabel, setManualWinnerPublicLabel] = useState('');
  const [manualWinnerPublicParticipantId, setManualWinnerPublicParticipantId] = useState('');
  const [voidRecordId, setVoidRecordId] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  // 1. Authenticate GM session
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassphrase) return;

    fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: adminPassphrase }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.isAdmin) {
          setIsAuthenticated(true);
          setAuthError('');
        } else {
          setAuthError('Invalid Game Master passphrase.');
        }
      })
      .catch(() => setAuthError('Authentication request failed.'));
  };

  // Check existing session cookie on mount
  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAdmin) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});
  }, []);

  // Load events
  useEffect(() => {
    if (isAuthenticated) {
      const allEvents = getEvents();
      setEvents(allEvents);
      if (allEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(allEvents[0].id);
      }
    }
  }, [isAuthenticated, selectedEventId]);

  // Load drawing status for selected event
  const fetchDrawingStatus = useCallback(async (eventId: string) => {
    if (!eventId || !isAuthenticated) return;
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (adminPassphrase) {
        headers['x-admin-key'] = adminPassphrase;
      }
      const res = await fetch(`/api/admin/drawing?eventId=${eventId}`, { headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load drawing status');
      }
      const data = await res.json();
      setReview(data.review);
      setPublicData(data.publicData);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching drawing data');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, adminPassphrase]);

  useEffect(() => {
    if (selectedEventId && isAuthenticated) {
      fetchDrawingStatus(selectedEventId);
    }
  }, [selectedEventId, isAuthenticated, fetchDrawingStatus]);

  // Admin Actions
  const handleLockLedger = async () => {
    try {
      setActionMessage(null);
      setErrorMessage(null);
      const res = await fetch('/api/admin/drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPassphrase,
        },
        body: JSON.stringify({
          action: 'lock',
          eventId: selectedEventId,
          lockReason,
          confirmPendingBypass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lock failed');
      setActionMessage(`Ledger locked successfully! Hash: ${data.lock.snapshotHash}`);
      fetchDrawingStatus(selectedEventId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to lock drawing ledger');
    }
  };

  const handleExecuteDraw = async () => {
    try {
      setActionMessage(null);
      setErrorMessage(null);
      const res = await fetch('/api/admin/drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPassphrase,
        },
        body: JSON.stringify({
          action: 'draw',
          eventId: selectedEventId,
          prizeTitle,
          testSeed,
          drawMethod,
          providerReference,
          manualWinnerPublicLabel,
          manualWinnerPublicParticipantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draw execution failed');
      const methodLabel = drawMethod === 'manual_external' ? 'Manual External Result Recorded' : 'Internal Test Draw Complete';
      setActionMessage(
        `${methodLabel}! Winner: ${data.drawRecord.winningPublicPlayerLabel} (${data.drawRecord.providerReference || 'Index: ' + data.drawRecord.selectedWeightedEntryIndex})`
      );
      fetchDrawingStatus(selectedEventId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute prize draw');
    }
  };

  const handlePublishResults = async () => {
    try {
      setActionMessage(null);
      setErrorMessage(null);
      const res = await fetch('/api/admin/drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPassphrase,
        },
        body: JSON.stringify({
          action: 'publish',
          eventId: selectedEventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setActionMessage(`Official Drawing Results Published to Public Page!`);
      fetchDrawingStatus(selectedEventId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish results');
    }
  };

  const handleVoidDraw = async () => {
    if (!voidRecordId || !cancellationReason) {
      setErrorMessage('Please select a draw record and enter an explicit audit cancellation reason.');
      return;
    }
    try {
      setActionMessage(null);
      setErrorMessage(null);
      const res = await fetch('/api/admin/drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPassphrase,
        },
        body: JSON.stringify({
          action: 'void',
          eventId: selectedEventId,
          drawRecordId: voidRecordId,
          cancellationReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Void failed');
      setActionMessage(`Draw record ${voidRecordId} voided with audit reason logged.`);
      fetchDrawingStatus(selectedEventId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to void draw record');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Header />
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-16">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <h1 className="text-xl font-bold text-white mb-2 font-mono">Game Master Login</h1>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              Enter your GM security passphrase to access prize drawing controls.
            </p>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Passphrase</label>
                <input
                  type="password"
                  value={adminPassphrase}
                  onChange={(e) => setAdminPassphrase(e.target.value)}
                  placeholder="e.g. canton-gm-2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {authError && <p className="text-xs font-mono text-red-400">{authError}</p>}

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-sm rounded-xl transition-all"
              >
                Authenticate Game Master
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white font-mono">Game Master — Prize Drawing Console</h1>
            <p className="text-xs font-mono text-slate-400">
              Audit, Freeze Entry Ledgers & Run Deterministic Prize Drawings
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white rounded-xl"
          >
            ← Back to Admin Console
          </Link>
        </div>

        {/* Notifications */}
        {actionMessage && (
          <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs font-mono p-4 rounded-xl mb-6">
            ✓ {actionMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-950/80 border border-red-700 text-red-200 text-xs font-mono p-4 rounded-xl mb-6">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Event Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Select Active Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.slug}) — Status: {ev.status}
              </option>
            ))}
          </select>
        </div>

        {review && (
          <div className="space-y-6">
            {/* Ledger Audit & Readiness Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white font-mono">1. Drawing Readiness & Ledger State</h2>
                <span className="px-3 py-1 bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-300 rounded-full capitalize">
                  Status: {review.ledgerStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="block text-[11px] font-mono text-slate-400 uppercase">Qualified Players</span>
                  <span className="text-xl font-bold font-mono text-white">{review.totalQualifiedPlayers}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="block text-[11px] font-mono text-slate-400 uppercase">Total Entry Pool</span>
                  <span className="text-xl font-bold font-mono text-amber-300">{review.totalQualifiedEntries}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="block text-[11px] font-mono text-slate-400 uppercase">Pending Submissions</span>
                  <span className={`text-xl font-bold font-mono ${review.pendingSubmissionsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {review.pendingSubmissionsCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="block text-[11px] font-mono text-slate-400 uppercase">Public View</span>
                  {selectedEvent && (
                    <Link
                      href={`/events/${selectedEvent.slug}/drawing`}
                      target="_blank"
                      className="text-xs font-mono text-cyan-400 underline block mt-1 hover:text-cyan-300"
                    >
                      Open Public Draw Page ↗
                    </Link>
                  )}
                </div>
              </div>

              {review.hasPendingSubmissionsWarning && (
                <div className="bg-amber-950/50 border border-amber-800/80 p-3 rounded-xl text-xs font-mono text-amber-200 mb-4">
                  ⚠️ WARNING: {review.pendingSubmissionsCount} submission(s) remain pending review. Locking the ledger now may exclude eligible entries.
                </div>
              )}
            </div>

            {/* Lock Control Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white font-mono mb-2">2. Freeze & Lock Drawing Ledger</h2>
              <p className="text-xs text-slate-400 font-mono mb-4">
                Locks the entry pool, generates a canonical deterministic snapshot, and calculates SHA-256 fingerprint. Prevents post-lock reward entry additions.
              </p>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Lock Reason</label>
                  <input
                    type="text"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                  />
                </div>

                {review.hasPendingSubmissionsWarning && (
                  <label className="flex items-center gap-2 text-xs font-mono text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmPendingBypass}
                      onChange={(e) => setConfirmPendingBypass(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                    />
                    I confirm bypassing pending submissions to lock the ledger.
                  </label>
                )}

                <button
                  onClick={handleLockLedger}
                  disabled={review.ledgerStatus !== 'open' && review.ledgerStatus !== 'review'}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold font-mono text-sm rounded-xl transition-all"
                >
                  🔒 LOCK DRAWING LEDGER & HASH
                </button>
              </div>
            </div>

            {/* Draw Execution Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white font-mono mb-2">3. Execute Prize Draw / Record External Result</h2>
              <p className="text-xs text-slate-400 font-mono mb-4">
                Execute a deterministic internal test draw using a seed, or record a manually entered external provider drawing result (not system verified).
              </p>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Draw Method / Provider</label>
                  <select
                    value={drawMethod}
                    onChange={(e) => setDrawMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                  >
                    <option value="internal_test">INTERNAL TEST DRAW (Seeded / Dev & Test Only)</option>
                    <option value="manual_external">RECORD MANUAL EXTERNAL RESULT (Manually Recorded / Unverified)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Prize Title</label>
                  <input
                    type="text"
                    value={prizeTitle}
                    onChange={(e) => setPrizeTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                  />
                </div>

                {drawMethod === 'internal_test' ? (
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Test Seed (Explicit TEST / INTERNAL ONLY)</label>
                    <input
                      type="text"
                      value={testSeed}
                      onChange={(e) => setTestSeed(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">External Provider Reference (Admin Supplied / Manually Entered)</label>
                      <input
                        type="text"
                        value={providerReference}
                        onChange={(e) => setProviderReference(e.target.value)}
                        placeholder="e.g. RANDOM.ORG Ticket #784920 or Physical Wheel Spin #1"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                      />
                      <p className="text-[11px] font-mono text-amber-300/90 mt-1">
                        ⚠️ Disclaimer: Manually entered external results store the admin-supplied reference string, but are marked NOT SYSTEM VERIFIED by Canton Quests.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Winner Public Player Label (Required if unique)</label>
                      <input
                        type="text"
                        value={manualWinnerPublicLabel}
                        onChange={(e) => setManualWinnerPublicLabel(e.target.value)}
                        placeholder="e.g. Agent #1234 or Player Display Name"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Public Participant ID (Required for duplicate labels / Disambiguation)</label>
                      <input
                        type="text"
                        value={manualWinnerPublicParticipantId}
                        onChange={(e) => setManualWinnerPublicParticipantId(e.target.value)}
                        placeholder="e.g. 5a1b3c7d (from canonical snapshot)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExecuteDraw}
                    disabled={review.ledgerStatus === 'open' || review.ledgerStatus === 'review'}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold font-mono text-sm rounded-xl transition-all"
                  >
                    {drawMethod === 'manual_external' ? '📝 RECORD UNVERIFIED EXTERNAL RESULT' : '🎲 EXECUTE TEST DRAW'}
                  </button>

                  <button
                    onClick={handlePublishResults}
                    disabled={review.ledgerStatus !== 'drawn'}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold font-mono text-sm rounded-xl transition-all"
                  >
                    🚀 PUBLISH RESULTS TO PUBLIC
                  </button>
                </div>
              </div>
            </div>

            {/* Void / Audit Panel */}
            {publicData && publicData.publishedPrizes && publicData.publishedPrizes.length > 0 && (
              <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-6">
                <h2 className="text-base font-bold text-red-400 font-mono mb-2">4. Void / Cancel Draw Record</h2>
                <p className="text-xs text-slate-400 font-mono mb-4">
                  Preserves original draw record for audit history while marking status as cancelled.
                </p>

                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Prize Result to Void</label>
                    <select
                      value={voidRecordId}
                      onChange={(e) => setVoidRecordId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                    >
                      <option value="">Select Prize Draw Result</option>
                      {publicData.publishedPrizes.map((p: any, idx: number) => (
                        <option key={idx} value={p.drawRecordId || p.prizeId}>
                          {p.prizeTitle} — Winner: {p.winnerPublicLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Audit Cancellation Reason (Required)</label>
                    <input
                      type="text"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="e.g. Incorrect seed configuration entered"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono text-white"
                    />
                  </div>

                  <button
                    onClick={handleVoidDraw}
                    className="px-6 py-2.5 bg-red-800 hover:bg-red-700 text-white font-bold font-mono text-xs rounded-xl transition-all"
                  >
                    ⚠️ VOID DRAWING RECORD
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
