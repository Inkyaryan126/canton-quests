'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Quest, QuestEvent, Player, QuestSubmission, SubmitProofResult } from '@/lib/types';
import {
  getQuestById,
  getEventBySlug,
  getCurrentPlayer,
  getSubmissionsForPlayer,
  submitQuestProof,
} from '@/lib/game-engine';

export default function QuestDetailPage({
  params,
}: {
  params: Promise<{ slug: string; questId: string }>;
}) {
  const resolvedParams = use(params);
  const { slug: eventSlug, questId } = resolvedParams;

  const [quest, setQuest] = useState<Quest | null>(null);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<QuestSubmission | null>(null);

  // Form Inputs
  const [textInput, setTextInput] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitProofResult | null>(null);

  useEffect(() => {
    const q = getQuestById(questId);
    const e = getEventBySlug(eventSlug);
    const p = getCurrentPlayer();

    if (q) setQuest(q);
    if (e) setEvent(e);
    if (p) {
      setPlayer(p);
      if (e && q) {
        const subs = getSubmissionsForPlayer(p.id, e.id);
        const match = subs.find((s) => s.questId === q.id);
        if (match) setExistingSubmission(match);
      }
    }
  }, [eventSlug, questId]);

  if (!quest || !event || !player) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-white flex flex-col justify-center items-center p-4">
        <h1 className="text-2xl font-bold mb-2">Quest Not Found</h1>
        <p className="text-gray-400 text-sm mb-4">Unable to locate quest details.</p>
        <Link href={`/events/${eventSlug}`} className="btn btn-primary text-sm">
          Return to Event Hub
        </Link>
      </div>
    );
  }

  const isAlreadyCompleted = existingSubmission?.status === 'verified' || submissionResult?.submission?.status === 'verified';
  const isAlreadyPending = existingSubmission?.status === 'pending' || submissionResult?.submission?.status === 'pending';

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isAlreadyCompleted) return;

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      let content = textInput.trim();
      let url = mediaUrlInput.trim();

      if (quest.verificationType === 'checkin') {
        content = 'Centennial Check-In GPS Verified';
      }

      const result = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: event.id,
        proofType: quest.verificationType,
        submittedContent: content,
        proofUrl: url,
      });

      setSubmissionResult(result);
      if (result.success) {
        setExistingSubmission(result.submission);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-6">
        <Link
          href={`/events/${eventSlug}`}
          className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline mb-4"
        >
          ← Back to Event Quests
        </Link>

        {/* Quest Title Card */}
        <div className="glass-panel p-6 mb-6 border-amber-500/30 glow-amber relative">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className={`badge badge-${quest.difficulty}`}>{quest.difficulty}</span>
            <span className="font-display font-extrabold text-2xl text-amber-400">
              +{quest.pointValue} <span className="text-xs text-amber-500/80">XP</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{quest.title}</h1>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">{quest.description}</p>

          {/* Location Info */}
          {quest.location && (
            <div className="p-3 bg-obsidian/80 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono space-y-1">
              <div className="text-white font-bold flex items-center gap-1">
                📍 {quest.location.name}
              </div>
              {quest.location.address && <div className="text-gray-400">{quest.location.address}</div>}
              {quest.location.locationNotes && (
                <div className="text-amber-400/90 text-[11px] pt-1">
                  💡 Hint / Note: {quest.location.locationNotes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submission / Completion Status Card */}
        {isAlreadyCompleted ? (
          <div className="glass-panel p-6 border-emerald-500/50 bg-emerald-950/20 text-center space-y-3 animate-fade-in mb-6">
            <span className="text-4xl block">🎉</span>
            <h2 className="text-2xl font-extrabold text-emerald-400">QUEST COMPLETED!</h2>
            <p className="text-sm text-gray-200 font-mono">
              You cracked this mission and earned <strong className="text-amber-400">+{quest.pointValue} XP</strong>!
            </p>
            <div className="pt-2">
              <Link href={`/events/${eventSlug}`} className="btn btn-primary text-sm px-6">
                Choose Another Quest →
              </Link>
            </div>
          </div>
        ) : isAlreadyPending ? (
          <div className="glass-panel p-6 border-amber-500/50 bg-amber-950/20 text-center space-y-3 animate-fade-in mb-6">
            <span className="text-4xl block">⏳</span>
            <h2 className="text-2xl font-extrabold text-amber-300">SUBMISSION UNDER REVIEW</h2>
            <p className="text-sm text-gray-200 font-mono">
              Your media proof has been submitted to the Game Master review queue. Points will be awarded once verified.
            </p>
            <div className="pt-2">
              <Link href={`/events/${eventSlug}`} className="btn btn-secondary text-sm px-6">
                Return to Event Hub →
              </Link>
            </div>
          </div>
        ) : (
          /* ACTIVE SUBMISSION FORM */
          <div className="glass-panel p-6 space-y-5 mb-6 border-cyan-500/30">
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📋 Proof Verification
              </h2>
              <p className="text-xs text-gray-400 font-mono">{quest.instructions}</p>
            </div>

            {submissionResult && !submissionResult.success && (
              <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono rounded-xl animate-fade-in">
                ❌ {submissionResult.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Proof Form Variant by verificationType */}
              {quest.verificationType === 'checkin' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-3xl mx-auto animate-pulse">
                    📍
                  </div>
                  <p className="text-xs text-gray-300 font-mono">
                    Ensure location permission is active on your mobile phone and tap below to verify physical presence.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-cyan w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Scanning Signal...' : '📡 VERIFY CHECK-IN SIGNAL'}
                  </button>
                </div>
              )}

              {(quest.verificationType === 'passphrase' || quest.verificationType === 'qr') && (
                <div className="space-y-3">
                  <label className="text-xs font-mono text-gray-300 block">
                    {quest.verificationType === 'qr'
                      ? 'Scan QR Emblem Passcode or Enter Token Code:'
                      : 'Enter Decoded Cipher Passphrase:'}
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      quest.verificationType === 'qr'
                        ? 'e.g. AURA-BREW-2026'
                        : 'e.g. 1897, ONESTO, or CYPHER-77'
                    }
                    className="input-field font-mono uppercase tracking-wider text-amber-300 font-bold"
                    required
                  />

                  {quest.verificationType === 'qr' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setTextInput(quest.targetCode || 'AURA-BREW-2026')}
                        className="text-[11px] font-mono text-cyan-400 hover:underline bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded"
                      >
                        ⚡ Simulate Camera Scan
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !textInput.trim()}
                    className="btn btn-primary w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Verifying Cipher...' : '🔓 TRANSMIT VERIFICATION CODE'}
                  </button>
                </div>
              )}

              {(quest.verificationType === 'photo' || quest.verificationType === 'video') && (
                <div className="space-y-3">
                  <label className="text-xs font-mono text-gray-300 block">
                    Media Proof File / Image URL / Link:
                  </label>

                  <input
                    type="text"
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg or media link..."
                    className="input-field text-xs font-mono"
                  />

                  <div className="p-3 bg-obsidian/60 border border-dashed border-gray-700 rounded-xl text-center cursor-pointer hover:border-amber-500/50 transition-colors">
                    <span className="text-2xl block mb-1">📷</span>
                    <span className="text-xs text-gray-400 font-mono block">
                      Tap to capture or upload photo/video from your camera
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Uploading Proof...' : '📤 SUBMIT MEDIA PROOF FOR REVIEW'}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
