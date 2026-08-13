'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import LocationVerifier from '@/components/LocationVerifier';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import MobileStartBar from '@/components/MobileStartBar';
import { QuestEvent, Player, QuestSubmission, SubmitProofResult, PublicQuestView, PlayerEventProgress } from '@/lib/types';
import { cleanQuestTitle, getQuestImage, proofTypeLabels, questCategoryLabels } from '@/lib/marketing-assets';

interface FeedbackState {
  type: 'quest_completed';
  title: string;
  message: string;
  pointsAwarded?: number;
  unlockedQuestTitle?: string;
  unlockedQuestUrl?: string;
}

function getClientPlayer(): Player {
  const stored = window.localStorage.getItem('canton_quests_current_player');
  if (stored) {
    return JSON.parse(stored) as Player;
  }

  const newPlayer: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem('canton_quests_current_player', JSON.stringify(newPlayer));
  return newPlayer;
}

function getDirectionsUrl(quest: PublicQuestView) {
  const place = [quest.location?.name, quest.location?.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place || 'Canton, Ohio')}`;
}

export default function QuestDetailPage({
  params,
}: {
  params: { slug: string; questId: string };
}) {
  const { slug: eventSlug, questId } = params;

  const [quest, setQuest] = useState<PublicQuestView | null>(null);
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allEventQuests, setAllEventQuests] = useState<PublicQuestView[]>([]);
  const [existingSubmission, setExistingSubmission] = useState<QuestSubmission | null>(null);
  const [progress, setProgress] = useState<PlayerEventProgress | null>(null);

  // Form Inputs & Geolocation
  const [textInput, setTextInput] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);
  const [userAccuracyMeters, setUserAccuracyMeters] = useState<number | undefined>(undefined);
  const [isProximityOk, setIsProximityOk] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitProofResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const p = getClientPlayer();
    setPlayer(p);

    fetch(`/api/game/events/${eventSlug}?playerId=${encodeURIComponent(p.id)}`)
      .then((res) => res.json())
      .then((data: { event?: QuestEvent; quests?: PublicQuestView[]; progress?: PlayerEventProgress }) => {
        if (cancelled) return;
        const safeQuests = data.quests || [];
        const safeQuest = safeQuests.find((item) => item.id === questId) || null;
        setEvent(data.event || null);
        setAllEventQuests(safeQuests);
        setQuest(safeQuest);
        setProgress(data.progress || null);

        if (safeQuest && data.progress?.completedQuestIds.includes(safeQuest.id)) {
          setExistingSubmission({
            id: `progress-${safeQuest.id}`,
            questId: safeQuest.id,
            playerId: p.id,
            eventId: data.event?.id || '',
            proofType: safeQuest.verificationType,
            status: 'verified',
            awardedPoints: safeQuest.xpReward || safeQuest.pointValue,
            drawingEntriesAwarded: safeQuest.drawingEntryReward || 1,
            submittedAt: new Date().toISOString(),
          });
        } else if (safeQuest && data.progress?.pendingSubmissionQuestIds.includes(safeQuest.id)) {
          setExistingSubmission({
            id: `progress-${safeQuest.id}`,
            questId: safeQuest.id,
            playerId: p.id,
            eventId: data.event?.id || '',
            proofType: safeQuest.verificationType,
            status: 'pending',
            awardedPoints: 0,
            drawingEntriesAwarded: 0,
            submittedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuest(null);
          setEvent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventSlug, questId]);

  if (!quest || !event || !player) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-white flex flex-col justify-center items-center p-4">
        <h1 className="text-2xl font-bold mb-2">Quest Not Found</h1>
        <p className="text-gray-400 text-sm mb-4">Unable to locate quest details.</p>
        <Link href={`/events/${eventSlug}`} className="btn btn-primary text-sm">
          Return to Quest Hub
        </Link>
      </div>
    );
  }

  const completedIds = progress?.completedQuestIds || [];
  const pendingIds = progress?.pendingSubmissionQuestIds || [];
  const isAlreadyCompleted = existingSubmission?.status === 'verified' || submissionResult?.submission?.status === 'verified';
  const isAlreadyPending = existingSubmission?.status === 'pending' || submissionResult?.submission?.status === 'pending';
  const isLocked = Boolean(quest.prerequisiteQuestId && !completedIds.includes(quest.prerequisiteQuestId));

  const currentStepIdx = Math.max(0, existingSubmission?.completedStepOrder || submissionResult?.currentStepCompleted || 0);
  const directionsUrl = getDirectionsUrl(quest);

  const handleLocationVerified = (lat: number, lon: number, proximityOk: boolean, accuracyMeters?: number) => {
    setUserLat(lat);
    setUserLon(lon);
    setUserAccuracyMeters(accuracyMeters);
    setIsProximityOk(proximityOk);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isAlreadyCompleted || isLocked) return;

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      let content = textInput.trim();
      let url = mediaUrlInput.trim();

      if (quest.verificationType === 'checkin' || quest.verificationType === 'gps') {
        content = 'Centennial GPS Location Checked In';
      }

      const response = await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          questId: quest.id,
          eventId: event.id,
          proofType: quest.verificationType,
          submittedContent: content,
          proofUrl: url,
          userLat,
          userLon,
          userAccuracyMeters,
          stepIndex: quest.verificationType === 'multi_step' ? currentStepIdx : undefined,
        }),
      });
      const result = (await response.json()) as SubmitProofResult;

      setSubmissionResult(result);
      if (result.success) {
        setExistingSubmission(result.submission);
        setTextInput('');

        // Check if completing this quest unlocked the next chain quest!
        const nextInChain = allEventQuests.find((q) => q.prerequisiteQuestId === quest.id);

        if (result.isQuestFullyCompleted) {
          setFeedback({
            type: 'quest_completed',
            title: `QUEST SOLVED!`,
            message: result.message,
            pointsAwarded: result.awardedPoints,
            unlockedQuestTitle: nextInChain ? nextInChain.title : undefined,
            unlockedQuestUrl: nextInChain ? `/events/${eventSlug}/quests/${nextInChain.id}` : undefined,
          });
        }
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

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6">
        <Link
          href={`/events/${eventSlug}`}
          className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline mb-4 font-bold"
        >
          ← Back to Quest Hub
        </Link>

        {/* Flash Quest Banner if Active */}
        {quest.isFlash && (
          <div className="p-3 bg-red-950/40 border border-red-500/60 rounded-xl mb-4 text-xs font-mono text-red-300 font-bold flex items-center justify-between animate-pulse">
            <span>⚡ POP-UP FLASH QUEST</span>
            <span>+{quest.pointValue} XP ACTIVE</span>
          </div>
        )}

        {/* Quest Briefing */}
        <section className="glass-panel mb-6 border-amber-500/30 glow-amber overflow-hidden">
          <figure className="aspect-[16/9] min-h-[220px] max-h-[380px] bg-black overflow-hidden">
            <Image
              src={getQuestImage(quest)}
              alt={`${cleanQuestTitle(quest.title)} location artwork`}
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="h-full w-full object-cover"
            />
          </figure>

          <div className="p-5 md:p-6 bg-[#050607] border-t border-amber-500/24">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`badge badge-${quest.difficulty}`}>{quest.difficulty}</span>
              <span className="badge badge-medium bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono font-bold">
                +{quest.pointValue} XP
              </span>
              <span className="badge badge-medium bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono font-bold">
                +{quest.drawingEntryReward || 1} DRAWING ENTRIES
              </span>
              <span className="badge badge-medium bg-cyan-500/15 text-cyan-300 border-cyan-500/35 font-mono">
                {proofTypeLabels[quest.verificationType] || quest.verificationType}
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-none">
              {cleanQuestTitle(quest.title)}
            </h1>
            <p className="text-sm sm:text-base text-gray-200 leading-relaxed mt-3 max-w-2xl">
              {quest.description}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-px bg-amber-500/20">
            <div className="bg-[#090b0c] p-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Go here</span>
              <strong className="block text-white mt-1">{quest.location?.name || 'Canton, Ohio'}</strong>
              {quest.location?.address && <p className="text-xs text-gray-400 mt-1">{quest.location.address}</p>}
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary text-[11px] px-3 py-2 mt-3 w-full font-bold"
              >
                Open Map Directions
              </a>
            </div>
            <div className="bg-[#090b0c] p-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Do this</span>
              <strong className="block text-white mt-1">{questCategoryLabels[quest.category]}</strong>
              <p className="text-xs text-gray-400 mt-1">{quest.instructions}</p>
            </div>
            <div className="bg-[#090b0c] p-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Rewards</span>
              <strong className="block text-amber-300 font-mono mt-1">+{quest.pointValue} XP • +{quest.drawingEntryReward || 1} Entries</strong>
              <p className="text-xs text-gray-400 mt-1">Verify proof below to issue rewards.</p>
            </div>
          </div>

          {(quest.location?.accessNotes || quest.location?.openingHours || quest.safetyNotes) && (
            <div className="p-4 bg-cyan-950/25 border-t border-cyan-500/25 text-xs text-cyan-200 font-mono space-y-2">
              {quest.location?.openingHours && (
                <div>
                  <span className="font-bold text-white">Access window:</span> {quest.location.openingHours}
                </div>
              )}
              {quest.location?.accessNotes && (
                <div>
                  <span className="font-bold text-white">Location access:</span> {quest.location.accessNotes}
                </div>
              )}
              {quest.safetyNotes && (
                <div>
                  <span className="font-bold text-white">Safety:</span> {quest.safetyNotes}
                </div>
              )}
            </div>
          )}
        </section>

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
            <h2 className="text-3xl font-extrabold text-emerald-400 tracking-wider">QUEST COMPLETE</h2>
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl inline-block text-center max-w-md w-full my-2">
              <div className="text-2xl font-black text-amber-300 font-mono">+{quest.pointValue} XP</div>
              <div className="text-xl font-extrabold text-purple-300 font-mono">+{quest.drawingEntryReward || 1} DRAWING ENTRIES</div>
            </div>
            <p className="text-xs text-gray-300 font-mono">
              Your proof has been verified and registered on the event drawing ledger.
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
              Your proof submission has been routed to the Game Master review queue. XP and drawing entries will be awarded upon verification.
            </p>
            <div className="pt-2">
              <Link href={`/events/${eventSlug}`} className="btn btn-secondary text-sm px-6">
                Return to Quest Hub →
              </Link>
            </div>
          </div>
        ) : (
          /* ACTIVE SUBMISSION FORM */
          <div className="glass-panel p-6 space-y-5 mb-6 border-cyan-500/30">
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Submit Proof Verification
              </h2>
              <p className="text-xs text-gray-400 font-mono">Complete the mission objective, then submit verification using the control below.</p>
            </div>

            {/* Geolocation Sensor Card */}
            {(quest.requireLocationVerification || quest.requireQrAndLocation || quest.verificationType === 'checkin' || quest.verificationType === 'gps') && (
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
              {(quest.verificationType === 'checkin' || quest.verificationType === 'gps') && (
                <button
                  type="submit"
                  disabled={isSubmitting || (quest.requireLocationVerification && !isProximityOk)}
                  className="btn btn-cyan w-full text-sm font-bold py-3"
                >
                  {isSubmitting ? 'Verifying location...' : 'Verify Location & Claim Rewards'}
                </button>
              )}

              {(quest.verificationType === 'passphrase' || quest.verificationType === 'qr') && (
                <div className="space-y-3">
                  <label className="text-xs font-mono text-gray-300 block">
                    {quest.verificationType === 'qr'
                      ? quest.requireQrAndLocation
                        ? 'Scan the QR and confirm physical proximity:'
                        : 'Scan the QR emblem or enter secret token:'
                      : 'Enter the passphrase or cipher code:'}
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      quest.verificationType === 'qr'
                        ? 'Enter the QR passcode'
                        : 'Enter secret passphrase code...'
                    }
                    className="input-field font-mono uppercase tracking-wider text-amber-300 font-bold"
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting || !textInput.trim() || (quest.requireQrAndLocation && !isProximityOk)}
                    className="btn btn-primary w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Verifying code...' : 'Submit Code & Claim Rewards'}
                  </button>
                </div>
              )}

              {(quest.verificationType === 'photo' || quest.verificationType === 'video' || quest.verificationType === 'game_master') && (
                <div className="space-y-3">
                  <label className="text-xs font-mono text-gray-300 block">
                    {quest.verificationType === 'game_master'
                      ? 'Submit details for Game Master manual review:'
                      : 'Add your photo, video, or proof link:'}
                  </label>

                  <input
                    type="text"
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg or proof details..."
                    className="input-field text-xs font-mono"
                  />

                  <div className="p-3 bg-obsidian/60 border border-dashed border-gray-700 rounded-xl text-center cursor-pointer hover:border-amber-500/50 transition-colors">
                    <span className="text-2xl block mb-1">📸</span>
                    <span className="text-xs text-gray-400 font-mono block">
                      Attach or paste proof link, then submit for Game Master review.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary w-full text-sm font-bold py-3"
                  >
                    {isSubmitting ? 'Submitting proof...' : 'Submit for Game Master Approval'}
                  </button>
                </div>
              )}

              {quest.verificationType === 'multi_step' && quest.steps && quest.steps.length > 0 && (
                <div className="space-y-4 border p-4 border-cyan-500/30 rounded-xl bg-cyan-950/20">
                  {(() => {
                    const step = quest.steps[currentStepIdx] || quest.steps[0];
                    const stepNeedsMedia =
                      step.verificationType === 'photo' ||
                      step.verificationType === 'video' ||
                      step.verificationType === 'game_master';
                    const stepNeedsLocation =
                      step.verificationType === 'gps' || step.verificationType === 'checkin';
                    return (
                      <>
                        <div className="text-xs font-mono text-cyan-300 font-bold">
                          Multi-Step Mission — Step {currentStepIdx + 1} of {quest.steps.length}
                        </div>
                        <div className="space-y-3">
                          <div className="text-sm font-bold text-white">
                            {step.title}
                          </div>
                          <p className="text-xs text-gray-300 font-mono">{step.instructions}</p>
                          {stepNeedsLocation && (
                            <LocationVerifier
                              location={step.location || quest.location}
                              requiredRadiusMeters={step.radiusMeters || quest.radiusMeters}
                              onLocationVerified={handleLocationVerified}
                            />
                          )}
                          {stepNeedsMedia ? (
                            <input
                              type="text"
                              value={mediaUrlInput}
                              onChange={(event) => setMediaUrlInput(event.target.value)}
                              placeholder="Paste proof link or Game Master details..."
                              className="input-field text-xs font-mono"
                            />
                          ) : !stepNeedsLocation ? (
                            <input
                              type="text"
                              value={textInput}
                              onChange={(event) => setTextInput(event.target.value)}
                              placeholder="Enter step code or answer..."
                              className="input-field text-xs font-mono uppercase font-bold text-amber-300"
                            />
                          ) : null}
                          <button
                            type="submit"
                            disabled={
                              isSubmitting ||
                              (stepNeedsMedia ? !mediaUrlInput.trim() : !stepNeedsLocation && !textInput.trim()) ||
                              (stepNeedsLocation && !isProximityOk)
                            }
                            className="btn btn-cyan w-full text-xs font-bold py-2.5"
                          >
                            {isSubmitting ? 'Validating step...' : `Validate Step ${currentStepIdx + 1}`}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </form>
          </div>
        )}
      </main>

      <GameFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
      <MobileStartBar href={`/events/${eventSlug}`} label="Back to Quests" eyebrow="Need another mission?" />
    </div>
  );
}
