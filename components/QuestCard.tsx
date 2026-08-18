'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Zap, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { PublicQuestView, QuestState } from '@/lib/types';
import {
  cqImages,
  getQuestImage,
  getQuestRarity,
  rarityClassName,
  cleanQuestTitle,
  proofTypeLabels,
  questCategoryLabels,
} from '@/lib/marketing-assets';

interface QuestCardProps {
  quest: PublicQuestView;
  eventSlug: string;
  isCompleted?: boolean;
  isPending?: boolean;
  allQuests?: PublicQuestView[];
  completedQuestIds?: string[];
  pendingQuestIds?: string[];
  distanceStr?: string;
}

function calculatePublicQuestState(
  quest: PublicQuestView,
  completedQuestIds: string[],
  pendingQuestIds: string[],
  nowMs: number = Date.now()
): QuestState {
  if (completedQuestIds.includes(quest.id)) return 'completed';
  if (pendingQuestIds.includes(quest.id)) return 'pending';
  if (quest.status === 'inactive' || quest.status === 'draft') return 'hidden';
  if (quest.claimLimit && quest.currentClaims && quest.currentClaims >= quest.claimLimit) return 'claimed_out';
  if (quest.prerequisiteQuestId && !completedQuestIds.includes(quest.prerequisiteQuestId)) return 'locked';
  if (quest.startsAt && new Date(quest.startsAt).getTime() > nowMs) return 'locked';
  if (quest.isFlash) {
    if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= nowMs) return 'expired';
    return 'flash';
  }
  return 'available';
}

const CATEGORY_ICONS: Record<string, string> = {
  exploration: '🧭',
  puzzle: '🧩',
  observation: '🔍',
  creative: '🎨',
  photo_video: '📸',
  business_partner: '☕',
  flash: '⚡',
  trivia: '📜',
  secret: '🔒',
};

const PROOF_ICONS: Record<string, string> = {
  checkin: '📍 Check-In',
  qr: '📱 QR Emblem',
  passphrase: '🔑 Passcode',
  photo: '📷 Photo Proof',
  video: '🎥 Video Proof',
};

export default function QuestCard({
  quest,
  eventSlug,
  isCompleted = false,
  isPending = false,
  allQuests = [],
  completedQuestIds = [],
  pendingQuestIds = [],
  distanceStr,
}: QuestCardProps) {
  const categoryIcon = CATEGORY_ICONS[quest.category] || '🎯';
  const proofLabel = PROOF_ICONS[quest.verificationType] || quest.verificationType;

  // Calculate Quest State
  const state: QuestState = isCompleted
    ? 'completed'
    : isPending
    ? 'pending'
    : calculatePublicQuestState(quest, completedQuestIds, pendingQuestIds);

  // Find prerequisite quest title if locked by prerequisite
  const prereqQuest = quest.prerequisiteQuestId
    ? allQuests.find((q) => q.id === quest.prerequisiteQuestId)
    : undefined;

  // Countdown for Flash Quests
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');

  useEffect(() => {
    if (!quest.isFlash || !quest.expiresAt) return;

    const updateTimer = () => {
      const remainingMs = new Date(quest.expiresAt!).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeftStr('EXPIRED');
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeftStr(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [quest.isFlash, quest.expiresAt]);

  const isLocked = state === 'locked';
  const isComplete = state === 'completed';
  const isPoster = quest.isFinaleQuest || quest.isFlash;
  const questImg = getQuestImage(quest);
  const rarity = getQuestRarity(quest);

  const cardContent = (
    <div
      className={`rounded-2xl flex flex-col justify-between h-full text-decoration-none group relative overflow-hidden transition-all duration-200 border ${
        isComplete
          ? 'border-amber-400/60 bg-gradient-to-b from-stone-900 via-amber-950/20 to-stone-950 shadow-xl shadow-amber-500/10'
          : state === 'pending'
          ? 'border-purple-500/50 bg-stone-900/90'
          : state === 'flash'
          ? 'border-red-500/60 bg-red-950/30 glow-amber'
          : isLocked
          ? 'border-stone-800 bg-stone-950/60 opacity-75 cursor-not-allowed'
          : 'border-stone-800 bg-stone-900/80 hover:border-amber-500/50 hover:bg-stone-900'
      }`}
    >
      {/* Upper Photo Window */}
      <div className="relative w-full h-40 overflow-hidden bg-black/60 border-b border-stone-800/80">
        <Image
          src={questImg}
          alt={`${cleanQuestTitle(quest.title)} location`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className={`object-cover transition-transform duration-300 ${
            isLocked ? 'grayscale opacity-60' : 'group-hover:scale-105'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-transparent to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${rarityClassName[rarity] || 'bg-stone-900/80 text-stone-300 border border-stone-700'}`}>
            {rarity}
          </span>
          {quest.isFlash ? (
            <span className="bg-red-600 text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold tracking-wider animate-pulse flex items-center gap-1">
              ⚡ FLASH {timeLeftStr && `(${timeLeftStr})`}
            </span>
          ) : isComplete ? (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles size={11} className="text-amber-400" />
              COLLECTED
            </span>
          ) : isLocked ? (
            <span className="bg-stone-900/90 text-stone-400 border border-stone-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
              <Lock size={11} />
              LOCKED
            </span>
          ) : (
            <span className="bg-stone-900/80 text-stone-300 border border-stone-700 text-[10px] font-mono px-2 py-0.5 rounded">
              {categoryIcon} {questCategoryLabels[quest.category] || quest.category}
            </span>
          )}
        </div>

        {/* Chain Step Indicator */}
        {quest.prerequisiteQuestId && (
          <div className="absolute bottom-2 left-2.5 text-[10px] font-mono text-cyan-400 font-bold flex items-center gap-1 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded">
            <span>🔗 QUEST CHAIN</span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-mono text-stone-400 uppercase">
              {quest.difficulty} Tier
            </span>
            <span className={`font-display font-black text-sm ${isComplete ? 'text-amber-300' : 'text-amber-400'}`}>
              +{quest.pointValue} <span className="text-[10px] text-amber-500 font-mono">XP</span>
            </span>
          </div>

          <h3
            className={`text-base font-bold mb-1.5 transition-colors font-display line-clamp-1 ${
              isLocked
                ? 'text-stone-400'
                : isComplete
                ? 'text-amber-100 group-hover:text-amber-300'
                : 'text-white group-hover:text-amber-400'
            }`}
          >
            {cleanQuestTitle(quest.title)}
          </h3>

          <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed mb-3 font-body">
            {quest.description}
          </p>

          {/* Locked Prerequisite Banner */}
          {isLocked && prereqQuest && (
            <div className="p-2 bg-stone-950 border border-stone-800 rounded-lg text-[10px] font-mono text-stone-400 mb-2">
              🔒 Unlocks after: <strong className="text-amber-300">{cleanQuestTitle(prereqQuest.title)}</strong>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 font-mono">
          <span className="flex items-center gap-1 truncate max-w-[55%] text-[11px]">
            <MapPin size={12} className="shrink-0 text-stone-500" />
            <span className="truncate">{quest.location ? quest.location.name : 'Canton, OH'}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {quest.requireLocationVerification && (
              <span className="text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40 text-[10px]" title="GPS Proximity Required">
                GPS
              </span>
            )}
            <span className="text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40 text-[10px]">
              {proofLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLocked) {
    return <div className="block h-full">{cardContent}</div>;
  }

  return (
    <Link href={`/events/${eventSlug}/quests/${quest.id}`} className="block h-full">
      {cardContent}
    </Link>
  );
}
