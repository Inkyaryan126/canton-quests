'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Quest, QuestState } from '@/lib/types';
import { calculateQuestState } from '@/lib/game-engine';

interface QuestCardProps {
  quest: Quest;
  eventSlug: string;
  isCompleted?: boolean;
  isPending?: boolean;
  allQuests?: Quest[];
  completedQuestIds?: string[];
  pendingQuestIds?: string[];
  distanceStr?: string;
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
    : calculateQuestState(quest, completedQuestIds, pendingQuestIds);

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

  const cardContent = (
    <div
      className={`glass-card p-4 flex flex-col justify-between h-full text-decoration-none group relative overflow-hidden transition-all ${
        state === 'completed'
          ? 'border-emerald-500/40 bg-emerald-950/20 opacity-90'
          : state === 'pending'
          ? 'border-purple-500/40 bg-purple-950/20'
          : state === 'flash'
          ? 'border-red-500/50 bg-red-950/30 glow-amber'
          : state === 'locked'
          ? 'border-gray-800 bg-slate-950/50 opacity-75 cursor-not-allowed'
          : 'hover:border-amber-500/40'
      }`}
    >
      {/* Flash Banner Header */}
      {quest.isFlash && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-mono px-3 py-0.5 rounded-bl-lg font-bold tracking-wider animate-pulse flex items-center gap-1">
          <span>⚡ FLASH DROP</span>
          {timeLeftStr && <span>({timeLeftStr})</span>}
        </div>
      )}

      {/* Chain Indicator */}
      {quest.prerequisiteQuestId && (
        <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1 flex items-center gap-1">
          <span>🔗 QUEST CHAIN STEP</span>
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryIcon}</span>
            <span className={`badge badge-${quest.difficulty}`}>{quest.difficulty}</span>
            {distanceStr && (
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2 py-0.5 rounded">
                📍 {distanceStr}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state === 'completed' ? (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                ✓ Completed (+{quest.pointValue} XP)
              </span>
            ) : state === 'pending' ? (
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                ⏳ Under Review
              </span>
            ) : isLocked ? (
              <span className="bg-gray-800 text-gray-400 border border-gray-700 text-xs font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                🔒 Locked
              </span>
            ) : (
              <span className="text-amber-400 font-display font-extrabold text-base">
                +{quest.pointValue} <span className="text-xs text-amber-500/80">XP</span>
              </span>
            )}
          </div>
        </div>

        <h3
          className={`text-lg font-bold mb-1 transition-colors ${
            isLocked
              ? 'text-gray-400'
              : 'text-white group-hover:text-amber-400'
          }`}
        >
          {quest.title}
        </h3>

        <p className="text-xs text-gray-300 line-clamp-2 mb-3 leading-relaxed">
          {quest.description}
        </p>

        {/* Locked Prerequisite Banner */}
        {isLocked && prereqQuest && (
          <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-[11px] font-mono text-gray-400 mb-3">
            🔒 Unlocks after completing:{' '}
            <strong className="text-amber-300">{prereqQuest.title}</strong>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-gray-400 font-mono">
        <span className="flex items-center gap-1 truncate max-w-[60%]">
          📍 {quest.location ? quest.location.name : 'Canton, OH'}
        </span>

        <div className="flex items-center gap-1">
          {quest.requireLocationVerification && (
            <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40 text-[10px]" title="GPS Proximity Required">
              GPS
            </span>
          )}
          <span className="text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 text-[11px]">
            {proofLabel}
          </span>
        </div>
      </div>
    </div>
  );

  if (isLocked) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <Link href={`/events/${eventSlug}/quests/${quest.id}`} className="block">
      {cardContent}
    </Link>
  );
}
