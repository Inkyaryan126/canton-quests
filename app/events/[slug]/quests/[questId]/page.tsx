'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import LocationVerifier from '@/components/LocationVerifier';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import MobileStartBar from '@/components/MobileStartBar';
import CinematicFooter from '@/components/CinematicFooter';
import QuestRewardBreakdown from '@/components/QuestRewardBreakdown';
import CommanderTransmission from '@/components/CommanderTransmission';
import { QuestEvent, Player, QuestSubmission, SubmitProofResult, PublicQuestView, PlayerEventProgress } from '@/lib/types';
import { cleanQuestTitle, cqImages, getQuestImage, proofTypeLabels, questCategoryLabels } from '@/lib/marketing-assets';
import { triggerQuestRewardSequence, triggerGameMomentSequence, showGameMoment } from '@/lib/game-effects';
import { shouldAutoShowTransmission, markTransmissionViewed } from '@/lib/transmission-viewed-state';
import { getCommanderTransmissionForTrigger, toGameplayTransmission } from '@/lib/commander-transmissions';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';
import { getQuestRewardSummary } from '@/lib/quest-rewards';

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

  // Auto-show the sector intro (once per player) or, failing that, this
  // quest's own intro transmission — never both, and never a repeat once
  // already viewed (see lib/transmission-viewed-state.ts). A small "Replay
  // Transmission" control on the persistent briefing card below lets the
  // player re-open it deliberately afterward.
  useEffect(() => {
    if (!quest || !player) return;

    if (quest.sectorIntroTransmission && shouldAutoShowTransmission('sector_intro', quest.id, player.id)) {
      showGameMoment({
        type: 'commander-transmission',
        trigger: 'sector_intro',
        transmission: quest.sectorIntroTransmission,
        viewedStateKey: quest.id,
        onContinue: () => markTransmissionViewed('sector_intro', quest.id, player.id),
      });
      return;
    }

    if (quest.commanderTransmission && shouldAutoShowTransmission('quest_intro', quest.id, player.id)) {
      showGameMoment({
        type: 'commander-transmission',
        trigger: 'quest_intro',
        transmission: quest.commanderTransmission,
        viewedStateKey: quest.id,
        onContinue: () => markTransmissionViewed('quest_intro', quest.id, player.id),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id, player?.id]);

  // "How to Read a Quest" (video 15) — fires once per player, the first
  // time they open ANY quest detail page (not per-quest, so it never
  // repeats on a second/third quest). Separate effect from the
  // sector/quest-intro one above so both can independently queue if a
  // player's very first quest also happens to carry its own transmission —
  // GameMomentManager plays them in order, never as duplicates.
  useEffect(() => {
    if (!quest || !player || !isKnownCantonLaunchSlug(eventSlug)) return;
    if (!shouldAutoShowTransmission('cipher_first_quest', 'video-15', player.id)) return;
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_first_quest' });
    if (!entry) return;
    markTransmissionViewed('cipher_first_quest', 'video-15', player.id);
    showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_first_quest',
      transmission: toGameplayTransmission(entry),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id, player?.id, eventSlug]);

  if (!quest || !event || !player) {
    if (isKnownCantonLaunchSlug(eventSlug) || isPreLaunchEvent(event, eventSlug)) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
          <Header eventSlug={params.slug} />
          <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col justify-center text-center">
            <div className="relative overflow-hidden p-8 sm:p-12 rounded-3xl border border-amber-500/40 bg-stone-900/90 shadow-2xl space-y-4">
              <Image
                src={cqImages.questBoardBg}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover opacity-20 pointer-events-none"
              />
              <div className="relative z-10 space-y-4 max-w-lg mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>MISSION GRID OFFLINE</span>
                </div>

                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  CANTON QUESTS ACTIVATES SEPTEMBER 11, 2026
                </h1>

                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-body">
                  Field quest submissions and location verification unlock on September 11, 2026. Until then, explore the site and choose your starting path.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="cq-gold-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2"
                  >
                    RETURN TO CITY HUB →
                  </Link>
                  <Link
                    href={`/events/${params.slug}/quests`}
                    className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
                  >
                    🗺️ VIEW QUEST BOARD
                  </Link>
                </div>
              </div>
            </div>
          </main>
          <CinematicFooter />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={params.slug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          <div className="p-8 rounded-3xl border border-stone-800 bg-stone-900/80 shadow-2xl w-full space-y-4">
            <div className="text-4xl">🔍</div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
              QUEST NOT FOUND
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Unable to locate quest details for this mission. Please return to the quest hub to find available targets.
            </p>
            <div className="pt-2">
              <Link
                href={`/events/${eventSlug}`}
                className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
              >
                RETURN TO QUEST HUB →
              </Link>
            </div>
          </div>
        </main>
        <CinematicFooter />
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
  const rewardSummary = getQuestRewardSummary(quest);

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

        // "How XP Works" (12) / "How Prize Entries Work" (13) — react to
        // the player's FIRST-ever XP award / drawing entry (judged from
        // `progress`, the pre-submission state already loaded for this
        // page — never re-derived from this submission's own result alone,
        // so a later resubmission never re-fires it). Queued after the
        // quest-complete sequence below via GameMomentManager's own
        // priority ordering (quest-complete outranks commander-transmission),
        // so "Quest Solved!" always shows before the explainer. Watching
        // these videos never grants XP/entries itself — they only react to
        // what the server already awarded.
        if (isKnownCantonLaunchSlug(eventSlug) && player) {
          const hadNoXpBefore = (progress?.totalPoints ?? 0) === 0;
          const hadNoQuestsBefore = (progress?.completedCount ?? 0) === 0;

          if (hadNoXpBefore && result.awardedPoints > 0 && shouldAutoShowTransmission('cipher_first_xp', 'video-12', player.id)) {
            const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_first_xp' });
            if (entry) {
              markTransmissionViewed('cipher_first_xp', 'video-12', player.id);
              showGameMoment({ type: 'commander-transmission', trigger: 'cipher_first_xp', transmission: toGameplayTransmission(entry) });
            }
          }

          if (
            hadNoQuestsBefore &&
            (result.drawingEntriesAwarded ?? 0) > 0 &&
            shouldAutoShowTransmission('cipher_first_entry', 'video-13', player.id)
          ) {
            const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_first_entry' });
            if (entry) {
              markTransmissionViewed('cipher_first_entry', 'video-13', player.id);
              showGameMoment({ type: 'commander-transmission', trigger: 'cipher_first_entry', transmission: toGameplayTransmission(entry) });
            }
          }
        }

        // Check if completing this quest unlocked the next chain quest!
        const nextInChain = allEventQuests.find((q) => q.prerequisiteQuestId === quest.id);

        if (result.isQuestFullyCompleted) {
          // Determine if this is a real chain completion or a milestone:
          // Case 1: Multi-step quest (like secret-cipher-77) whose steps are all fully verified
          const isMultiStepChain = quest.verificationType === 'multi_step' || Boolean(quest.steps && quest.steps.length > 1);

          // Case 2: Terminal leaf of a prerequisite chain (has a prerequisite and no further dependent quests)
          const isTerminalChainQuest = Boolean(quest.prerequisiteQuestId && !nextInChain);

          const isActualChainComplete = isMultiStepChain || isTerminalChainQuest;

          triggerQuestRewardSequence({
            questId: quest.id,
            questTitle: quest.title,
            xpAwarded: result.awardedPoints,
            verificationType: quest.verificationType,
            unlockedQuestTitle: nextInChain ? nextInChain.title : undefined,
            unlockedQuestUrl: nextInChain ? `/events/${eventSlug}/quests/${nextInChain.id}` : undefined,
            drawingEntriesAwarded: result.drawingEntriesAwarded !== undefined ? result.drawingEntriesAwarded : (quest.drawingEntryReward || 1),
            oldRank: result.oldRank,
            newRank: result.newRank,
            newAchievements: result.newAchievements,
            isChainComplete: isActualChainComplete,
            chainTitle: isMultiStepChain ? `${quest.title} Sequence` : quest.title,
          });

          // The dedicated Entry Token cinematic — only ever fired when the
          // server confirms a genuinely new entry was granted this call
          // (never inferred from XP, never shown on a retry/duplicate).
          if (result.drawingEntriesAwarded && result.drawingEntriesAwarded > 0) {
            showGameMoment({
              type: 'reward-token',
              kind: 'entry-token',
              headline: quest.title,
              secondaryText: 'Locked into the official prize drawing.',
              entryCount: result.drawingEntriesAwarded,
            });
          }

          setFeedback({
            type: 'quest_completed',
            title: isActualChainComplete ? `CHAIN COMPLETED!` : `QUEST SOLVED!`,
            message: result.message,
            pointsAwarded: result.awardedPoints,
            unlockedQuestTitle: nextInChain ? nextInChain.title : undefined,
            unlockedQuestUrl: nextInChain ? `/events/${eventSlug}/quests/${nextInChain.id}` : undefined,
          });

          if (result.threeLocksFragmentAwarded && result.threeLocksOwned) {
            const fragment = result.threeLocksFragmentAwarded;
            const FRAGMENT_THEME: Record<'mark' | 'code' | 'word', { primaryText: string; secondaryText: string; pathColor: string }> = {
              mark: { primaryText: 'MARK', secondaryText: 'FOUNDER LOCK RECOVERED', pathColor: 'amber' },
              code: { primaryText: 'CODE', secondaryText: 'FOUNDER LOCK RECOVERED', pathColor: 'crimson' },
              word: { primaryText: 'WORD', secondaryText: 'FOUNDER LOCK RECOVERED', pathColor: 'violet' },
            };
            const { mark, code, word } = result.threeLocksOwned;
            const allThreeOwned = mark && code && word;

            const lockMoments: Parameters<typeof triggerGameMomentSequence>[0] = [
              {
                type: 'three-locks-fragment',
                fragment,
                headline: 'LOCK FRAGMENT RECOVERED',
                locksOwned: result.threeLocksOwned,
                ...FRAGMENT_THEME[fragment],
              },
            ];
            if (allThreeOwned) {
              lockMoments.push({
                type: 'three-locks-complete',
                headline: "FOUNDER'S CIPHER COMPLETE",
                primaryText: 'THREE LOCKS COMPLETE',
                secondaryText: 'MARK · CODE · WORD — all three fragments recovered.',
                pathColor: 'amber',
              });
            }
            triggerGameMomentSequence(lockMoments);
          } else if (result.collectibleAwarded) {
            // A plain rewardConfig.collectibleUnlockIds grant, not part of the
            // Three Locks flow (already covered above when it is).
            showGameMoment({
              type: 'unlock',
              kind: 'collectible',
              headline: 'ITEM RECOVERED',
              primaryText: result.collectibleAwarded.name,
              secondaryText: result.collectibleAwarded.description,
              rarity: result.collectibleAwarded.rarity,
            });
          }
        }
      } else if (result.success && (result.awardedPoints > 0 || (result.drawingEntriesAwarded ?? 0) > 0)) {
        // A successful submission that did NOT fully (re-)complete the
        // quest is a remoteCapable field/photo/NFC bonus on an
        // already-verified quest. Show XP and Entry Token as separate
        // moments, each only for exactly what the server granted this
        // call — a pure-XP bonus never implies an entry, and a
        // configured entry bonus (drawingEntryBonus / an NFC cache's
        // entry bonus) is never folded into the XP figure.
        if (result.awardedPoints > 0) {
          showGameMoment({
            type: 'field-event',
            kind: 'field-confirmed',
            headline: 'FIELD PRESENCE CONFIRMED',
            secondaryText: 'Remote intelligence got you this far. Boots on the ground pay better.',
            xpAmount: result.awardedPoints,
          });
        }
        if ((result.drawingEntriesAwarded ?? 0) > 0) {
          showGameMoment({
            type: 'reward-token',
            kind: 'entry-token',
            headline: quest.title,
            secondaryText: 'Locked into the official prize drawing.',
            entryCount: result.drawingEntriesAwarded,
          });
        }
      }

      if (result.success && quest.completionTransmission && result.isQuestFullyCompleted) {
        showGameMoment({
          type: 'commander-transmission',
          trigger: 'quest_completion',
          transmission: quest.completionTransmission,
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
      <Header eventSlug={params.slug} />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6">
        <Link
          href={`/events/${eventSlug}`}
          className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline mb-4 font-bold"
        >
          ← Back to Quest Hub
        </Link>

        {/* Flash Quest Banner if Active */}
        {quest.isFlash && (
          <div
            onClick={() => {
              showGameMoment({
                type: 'flash-drop',
                questId: quest.id,
                questTitle: quest.title,
                pointValue: quest.pointValue,
                district: quest.location?.name || quest.startingPath,
                questUrl: `/events/${eventSlug}/quests/${quest.id}`,
              });
            }}
            role="button"
            tabIndex={0}
            className="p-3 bg-red-950/40 border border-red-500/60 rounded-xl mb-4 text-xs font-mono text-red-300 font-bold flex items-center justify-between animate-pulse cursor-pointer hover:bg-red-950/60 transition-colors"
          >
            <span>⚡ POP-UP FLASH QUEST DETECTED</span>
            <span>+{quest.pointValue} XP ACTIVE (INSPECT) →</span>
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
              <QuestRewardBreakdown quest={quest} compact className="mt-1" />
              <p className="text-xs text-gray-400 mt-1.5">Verify proof below to issue rewards.</p>
            </div>
          </div>

          {rewardSummary.hasBonusContent && (
            <div className="p-4 sm:p-5 border-t border-amber-500/24">
              <QuestRewardBreakdown quest={quest} />
            </div>
          )}

          {quest.sectorIntroTransmission && (
            <div className="p-4 sm:p-5 border-t border-amber-500/24">
              <CommanderTransmission
                transmission={quest.sectorIntroTransmission}
                onReplay={
                  quest.sectorIntroTransmission.replayable !== false
                    ? () =>
                        showGameMoment({
                          type: 'commander-transmission',
                          trigger: 'sector_intro',
                          transmission: quest.sectorIntroTransmission!,
                        })
                    : undefined
                }
              />
            </div>
          )}

          {quest.commanderTransmission && (
            <div className="p-4 sm:p-5 border-t border-amber-500/24">
              <CommanderTransmission
                transmission={quest.commanderTransmission}
                onReplay={
                  quest.commanderTransmission.replayable !== false
                    ? () =>
                        showGameMoment({
                          type: 'commander-transmission',
                          trigger: 'quest_intro',
                          transmission: quest.commanderTransmission!,
                        })
                    : undefined
                }
              />
            </div>
          )}

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
