'use client';

import { Camera, Flag, Gem, KeyRound, Nfc, Radio, Ticket, Trophy, Zap } from 'lucide-react';
import { Quest, PublicQuestView } from '@/lib/types';
import { getQuestRewardSummary, QuestBonusKey } from '@/lib/quest-rewards';

interface QuestRewardBreakdownProps {
  quest: Quest | PublicQuestView;
  /** Tight single-column list for embedding inside an existing info card. */
  compact?: boolean;
  className?: string;
}

const BONUS_ICONS: Record<QuestBonusKey, typeof Radio> = {
  fieldCheckIn: Radio,
  nfc: Nfc,
  photoVideo: Camera,
};

const LOCK_LABELS: Record<'mark' | 'code' | 'word', string> = {
  mark: 'THE MARK',
  code: 'THE CODE',
  word: 'THE WORD',
};

/**
 * Renders a quest's reward template — base XP, any bonus paths it defines,
 * race placement tiers, and unlocks. Reads entirely from
 * lib/quest-rewards.ts, so it renders correctly for any quest regardless
 * of which reward fields that quest happens to populate.
 */
export default function QuestRewardBreakdown({ quest, compact = false, className = '' }: QuestRewardBreakdownProps) {
  const summary = getQuestRewardSummary(quest);

  if (compact) {
    return (
      <div className={className}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-display font-black text-amber-300 text-lg">+{summary.baseXp} XP</span>
          <span className="text-[11px] font-mono text-purple-300">
            +{summary.drawingEntries + summary.drawingEntryBonus} Entries
          </span>
        </div>
        {summary.bonuses.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {summary.bonuses.map((bonus) => {
              const Icon = BONUS_ICONS[bonus.key];
              return (
                <li key={bonus.key} className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                  <Icon size={11} className="shrink-0" />
                  <span>+{bonus.xp} XP {bonus.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {summary.hasBonusContent && (
          <p className="mt-1.5 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
            Up to {summary.maxXp} XP possible
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-stone-800 bg-[#090b0c] p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
          Full Reward Breakdown
        </span>
        {summary.hasBonusContent && (
          <span className="text-[10px] font-mono text-stone-400">Up to <strong className="text-amber-300">{summary.maxXp} XP</strong></span>
        )}
      </div>

      {/* XP ladder */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-white font-bold">
            <Zap size={14} className="text-amber-400" />
            Base Completion
          </span>
          <span className="font-mono font-bold text-amber-300">+{summary.baseXp} XP</span>
        </div>
        {summary.bonuses.map((bonus) => {
          const Icon = BONUS_ICONS[bonus.key];
          return (
            <div key={bonus.key} className="flex items-center justify-between text-xs pl-1">
              <span className="flex items-center gap-2 text-stone-300">
                <Icon size={13} className="text-cyan-400" />
                {bonus.label}
              </span>
              <span className="font-mono font-bold text-cyan-300">+{bonus.xp} XP</span>
            </div>
          );
        })}
      </div>

      {/* Race placement tiers */}
      {summary.raceBonus.length > 0 && (
        <div className="pt-3 border-t border-stone-800 space-y-1.5">
          <span className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-red-300 font-bold">
            <Trophy size={13} />
            Race Bonus (First to Complete)
          </span>
          {summary.raceBonus.map((tier) => (
            <div key={tier.place} className="flex items-center justify-between text-xs pl-1">
              <span className="text-stone-300">Place #{tier.place}</span>
              <span className="font-mono font-bold text-red-300">+{tier.bonusPoints} XP</span>
            </div>
          ))}
        </div>
      )}

      {/* Drawing entries */}
      <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-stone-300">
          <Ticket size={13} className="text-purple-400" />
          Drawing Entries
        </span>
        <span className="font-mono font-bold text-purple-300">
          +{summary.drawingEntries + summary.drawingEntryBonus}
          {summary.drawingEntryBonus > 0 && (
            <span className="text-stone-500"> ({summary.drawingEntries} base + {summary.drawingEntryBonus} bonus)</span>
          )}
        </span>
      </div>

      {/* Unlocks */}
      {(summary.unlocks.badgeSlugs.length > 0 ||
        summary.unlocks.collectibleIds.length > 0 ||
        summary.unlocks.secretQuestIds.length > 0 ||
        summary.unlocks.threeLocksFragment ||
        summary.unlocks.countsTowardFinale) && (
        <div className="pt-3 border-t border-stone-800 space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold">Unlocks</span>
          <div className="flex flex-wrap gap-1.5">
            {summary.unlocks.badgeSlugs.map((slug) => (
              <span key={slug} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-emerald-800/50 bg-emerald-950/40 text-emerald-300">
                <Gem size={11} /> Badge: {slug}
              </span>
            ))}
            {summary.unlocks.collectibleIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-cyan-800/50 bg-cyan-950/40 text-cyan-300">
                <Gem size={11} /> Collectible
              </span>
            ))}
            {summary.unlocks.secretQuestIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-purple-800/50 bg-purple-950/40 text-purple-300">
                🔒 Unlocks {summary.unlocks.secretQuestIds.length} secret quest{summary.unlocks.secretQuestIds.length === 1 ? '' : 's'}
              </span>
            )}
            {summary.unlocks.threeLocksFragment && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-amber-700/50 bg-amber-950/40 text-amber-300">
                <KeyRound size={11} /> Founder&apos;s Lock: {LOCK_LABELS[summary.unlocks.threeLocksFragment.lock]}
              </span>
            )}
            {summary.unlocks.countsTowardFinale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-red-700/50 bg-red-950/40 text-red-300">
                <Flag size={11} /> Counts Toward Finale
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
