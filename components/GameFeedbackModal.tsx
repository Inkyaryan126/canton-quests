'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface FeedbackData {
  type: 'quest_completed' | 'flash_activated' | 'level_up';
  title: string;
  message: string;
  pointsAwarded?: number;
  unlockedQuestTitle?: string;
  unlockedQuestUrl?: string;
}

interface GameFeedbackModalProps {
  feedback: FeedbackData | null;
  onClose: () => void;
}

export default function GameFeedbackModal({ feedback, onClose }: GameFeedbackModalProps) {
  if (!feedback) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative max-w-sm w-full bg-obsidian border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4 glow-amber overflow-hidden animate-scale-up">
        {/* Particle / Sparkle Decor */}
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white font-bold text-lg px-2 py-1"
        >
          ✕
        </button>

        <div className="text-5xl animate-bounce">
          {feedback.type === 'quest_completed' ? '🎉' : '⚡'}
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
            MISSION VERIFIED & COMPLETED
          </span>
          <h2 className="text-2xl font-extrabold text-white">{feedback.title}</h2>
        </div>

        <p className="text-xs text-gray-300 font-mono leading-relaxed">{feedback.message}</p>

        {feedback.pointsAwarded !== undefined && feedback.pointsAwarded > 0 && (
          <div className="py-2 bg-amber-950/40 border border-amber-500/40 rounded-2xl">
            <span className="text-xs text-amber-400 font-mono uppercase block">XP AWARDED</span>
            <span className="font-display font-extrabold text-3xl text-amber-400">
              +{feedback.pointsAwarded} <span className="text-sm text-amber-500/80">XP</span>
            </span>
          </div>
        )}

        {/* Unlocked Chain Quest Banner */}
        {feedback.unlockedQuestTitle && (
          <div className="p-3 bg-cyan-950/50 border border-cyan-500/50 rounded-2xl text-left space-y-1">
            <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase block">
              🔓 UNLOCKED IN CHAIN:
            </span>
            <span className="text-xs font-bold text-white block">{feedback.unlockedQuestTitle}</span>
            {feedback.unlockedQuestUrl && (
              <Link
                href={feedback.unlockedQuestUrl}
                onClick={onClose}
                className="text-[11px] font-mono text-cyan-400 hover:underline block pt-1 font-bold"
              >
                Inspect Next Chain Quest →
              </Link>
            )}
          </div>
        )}

        <div className="pt-2">
          <button onClick={onClose} className="btn btn-primary w-full text-xs font-bold py-3">
            CONTINUE HUNT →
          </button>
        </div>
      </div>
    </div>
  );
}
