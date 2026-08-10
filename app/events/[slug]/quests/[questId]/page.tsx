'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import LocationVerifier from '@/components/LocationVerifier';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import { Quest, QuestEvent, Player, QuestSubmission, SubmitProofResult } from '@/lib/types';
import {
  getQuestById,
  getEventBySlug,
  getCurrentPlayer,
  getSubmissionsForPlayer,
  submitQuestProof,
  calculateQuestState,
  getQuestsForEvent,
} from '@/lib/game-engine';

export default function QuestDetailPage({
  params,
}: {
  params: { slug: string; questId: string };
}) {
  const { slug: eventSlug, questId } = params;

  const [quest, setQuest] = useState<Quest | null>(null);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allEventQuests, setAllEventQuests] = useState<Quest[]>([]);
  const [existingSubmission, setExistingSubmission] = useState<QuestSubmission | null>(null);

  // Form Inputs & Geolocation
  const [textInput, setTextInput] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);
  const [isProximityOk, setIsProximityOk] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitProofResult | null>(null);
  const [feedback, setFeedback] = useState<any | null>(null);

  useEffect(() => {
    const q = getQuestById(questId);
    const e = getEventBySlug(eventSlug);
    const p = getCurrentPlayer();

    if (q) setQuest(q);
    if (e) {
      setEvent(e);
      setAllEventQuests(getQuestsForEvent(e.id));
    }
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

  // Calculate Quest State
  const playerSubmissions = getSubmissionsForPlayer(player.id, event.id);
  const completedIds = playerSubmissions.filter((s) => s.status === 'verified').map((s) => s.questId);
  const pendingIds = playerSubmissions.filter((s) => s.status === 'pending').map((s) => s.questId);
  const questState = calculateQuestState(quest, completedIds, pendingIds);

  const isAlreadyCompleted = existingSubmission?.status === 'verified' || submissionResult?.submission?.status === 'verified';
  const isAlreadyPending = existingSubmission?.status === 'pending' || submissionResult?.submission?.status === 'pending';
  const isLocked = questState === 'locked';

  const handleLocationVerified = (lat: number, lon: number, proximityOk: boolean) => {
    setUserLat(lat);
    setUserLon(lon);
    setIsProximityOk(proximityOk);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isAlreadyCompleted || isLocked) return;

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      let content = textInput.trim();
      let url = mediaUrlInput.trim();

      if (quest.verificationType === 'checkin') {
        content = 'Centennial GPS Location Checked In';
      }

      const result = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: event.id,
        proofType: quest.verificationType,
        submittedContent: content,
        proofUrl: url,
        userLat,
        userLon,
      });

      setSubmissionResult(result);
      if (result.success) {
        setExistingSubmission(result.submission);

        // Check if completing this quest unlocked the next chain quest!
        const nextInChain = allEventQuests.find((q) => q.prerequisiteQuestId === quest.id);

        setFeedback({
          type: 'quest_completed',
          title: `QUEST SOLVED!`,
          message: result.message,
          pointsAwarded: result.awardedPoints,
          unlockedQuestTitle: nextInChain ? nextInChain.title : undefined,
          unlockedQuestUrl: nextInChain ? `/events/${eventSlug}/quests/${nextInChain.id}` : undefined,
        });
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
          className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline mb-4 font-bold"
        >
          ← Back to Event Hub & Map
        </Link>

        {/* Flash Quest Banner if Active */}
        {quest.isFlash && (
          <div className="p-3 bg-red-950/40 border border-red-500/60 rounded-xl mb-4 text-xs font-mono text-red-300 font-bold flex items-center justify-between animate-pulse">
            <span>⚡ POP-UP FLASH QUEST</span>
            <span>+250 XP BONUS ACTIVE</span>
          </div>
        )}

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

          {/* Location & Safety Context Info */}
          {quest.location && (
            <div className="p-3.5 bg-obsidian/80 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono space-y-1.5">
              <div className="text-white font-bold flex items-center gap-1.5">
                📍 {quest.location.name}
              </div>
              {quest.location.address && <div className="text-gray-400">{quest.location.address}</div>}
              {quest.location.accessNotes && (
                <div className="text-cyan-300 text-[11px] pt-1">
                  🛡️ Access Note: {quest.location.accessNotes}
                </div>
              )}
              {quest.location.openingHours && (
                <div className="text-amber-400/90 text-[11px]">
                  ⏰ Hours: {quest.location.openingHours}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Locked Prerequisite Warning */}
        {isLocked ? (
          <div className="glass-panel p-6 border-slate-700 bg-slate-950/60 text-center space-y-3 mb-6">
            <span className="text-4xl block">🔒</span>
            <h2 className="text-xl font-extrabold text-gray-300">QUEST PREREQUISITE LOCKED</h2>
            <p className="text-xs text-gray-400 font-mono">
              You must complete the previous quest step in this chain before initializing this field mission.
            </p>
            <div className="pt-2">
              <Link href={`/events/${eventSlug}`} className="btn btn-primary text-xs px-6">
                Return to Quests List →
              </Link>
            </div>
          </div>
        ) : isAlreadyCompleted ? (
          /* COMPLETED STATE */
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
          /* PENDING REVIEW STATE */
          <div className="glass-panel p-6 border-purple-500/50 bg-purple-950/20 text-center space-y-3 animate-fade-in mb-6">
            <span className="text-4xl block">⏳</span>
            <h2 className="text-2xl font-extrabold text-purple-300">SUBMISSION UNDER REVIEW</h2>
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

            {/* Geolocation Sensor Card */}
            {(quest.requireLocationVerification || quest.requireQrAndLocation || quest.verificationType === 'checkin') && (
              <LocationVerifier
                location={quest.location}
                requiredRadiusMeters={quest.radiusMeters}
                onLocationVerified={handleLocationVerified}
              />
            )}

            {submissionResult && !submissionResult.success && (
              <div className="p-3.5 bg-red-950/50 border border-red-800 text-red-300 text-xs font-mono rounded-xl animate-fade-in space-y-1">
                <div className="font-bold">❌ Verification Failed</div>
                <div>{submissionResult.message}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form Inputs by Verification Type */}
              {quest.verificationType === 'checkin' && (
                <button
                  type="submit"
                  disabled={isSubmitting || !isProximityOk}
                  className="btn btn-cyan w-full text-sm font-bold py-3"
                >
                  {isSubmitting ? 'Verifying Location Signal...' : '📡 TRANSMIT LOCATION CHECK-IN'}
                </button>
              )}

              {(quest.verificationType === 'passphrase' || quest.verificationType === 'qr') && (
                <div className="space-y-3">
                  <label className="text-xs font-mono text-gray-300 block">
                    {quest.verificationType === 'qr'
                      ? quest.requireQrAndLocation
                        ? 'Scan QR Emblem & Confirm Physical Proximity:'
                        : 'Scan QR Emblem Passcode or Enter Token Code:'
                      : 'Enter Decoded Cipher Passphrase:'}
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      quest.verificationType === 'qr'
                        ? 'e.g. AURA-BREW-2026'
                        : 'e.g. 1897, CANTON, ONESTO, or CYPHER-77'
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
                    disabled={isSubmitting || !textInput.trim() || (quest.requireQrAndLocation && !isProximityOk)}
                    className="btn btn-primary w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Verifying Code...' : '🔓 TRANSMIT VERIFICATION CODE'}
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
                      Tap to capture photo/video proof from your smartphone camera
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

      <GameFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
    </div>
  );
}
