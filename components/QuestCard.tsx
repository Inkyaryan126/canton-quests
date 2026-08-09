'use client';

import Link from 'next/link';
import { Quest } from '@/lib/types';

interface QuestCardProps {
  quest: Quest;
  eventSlug: string;
  isCompleted?: boolean;
  isPending?: boolean;
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
  qr: '📱 QR Code',
  passphrase: '🔑 Passcode',
  photo: '📷 Photo Proof',
  video: '🎥 Video Proof',
};

export default function QuestCard({ quest, eventSlug, isCompleted, isPending }: QuestCardProps) {
  const categoryIcon = CATEGORY_ICONS[quest.category] || '🎯';
  const proofLabel = PROOF_ICONS[quest.verificationType] || quest.verificationType;

  return (
    <Link
      href={`/events/${eventSlug}/quests/${quest.id}`}
      className={`glass-card p-4 flex flex-col justify-between block text-decoration-none group relative overflow-hidden ${
        isCompleted
          ? 'border-emerald-500/40 bg-emerald-950/20'
          : isPending
          ? 'border-amber-500/40 bg-amber-950/20'
          : quest.isFlash
          ? 'border-red-500/50 bg-red-950/20'
          : ''
      }`}
    >
      {quest.isFlash && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-mono px-3 py-0.5 rounded-bl-lg font-bold tracking-wider animate-pulse">
          FLASH QUEST
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryIcon}</span>
            <span className={`badge badge-${quest.difficulty}`}>{quest.difficulty}</span>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                ✓ Completed (+{quest.pointValue} XP)
              </span>
            ) : isPending ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                ⏳ Under Review
              </span>
            ) : (
              <span className="text-amber-400 font-display font-extrabold text-base">
                +{quest.pointValue} <span className="text-xs text-amber-500/80">XP</span>
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors mb-1">
          {quest.title}
        </h3>

        <p className="text-xs text-gray-300 line-clamp-2 mb-3 leading-relaxed">
          {quest.description}
        </p>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-gray-400 font-mono">
        <span className="flex items-center gap-1 truncate max-w-[60%]">
          📍 {quest.location ? quest.location.name : 'Canton, OH'}
        </span>
        <span className="text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 text-[11px]">
          {proofLabel}
        </span>
      </div>
    </Link>
  );
}
