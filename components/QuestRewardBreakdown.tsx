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

const BONUS_ROW_LABELS: Record<QuestBonusKey, string> = {
  fieldCheckIn: 'FIELD BONUS',
  nfc: 'NFC CACHE',
  photoVideo: 'PHOTO/VIDEO BONUS',
};

const LOCK_LABELS: Record<'mark' | 'code' | 'word', string> = {
  mark: 'THE MARK',
  code: 'THE CODE',
  word: 'THE WORD',
};

/** +N ENTRY / +N ENTRIES — Entry Tokens are always their own figure, never folded into an XP number. */
function EntryTokenBadge({ count, small = false }: { count: number; small?: boolean }) {
  if (count <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold text-purple-300 ${small ? 'text-[10px]' : 'text-xs'}`}>
      <Ticket size={small ? 10 : 12} className="shrink-0" />
      +{count} ENTRY{count > 1 ? 'S' : ''} TOKEN{count > 1 ? 'S' : ''}
    </span>
  );
}

/**
 * Renders a quest's reward template — base XP, any bonus paths it defines,
 * race placement tiers, and unlocks. Reads entirely from
 * lib/quest-rewards.ts, so it renders correctly for any quest regardless
 * of which reward fields that quest happens to populate.
 *
 * XP and Entry Tokens are always shown as distinct figures — a bonus row
 * never implies an entry unless that specific bonus is configured to grant
 * one (rewardConfig.drawingEntryBonus, or an NFC cache's
 * nfcCacheEntryBonus), matching the server's own granting rules exactly
 * (see computeAwardedBonusesForSubmission in lib/quest-rewards.ts).
 */
export default function QuestRewardBreakdown({ quest, compact = false, className = '' }: QuestRewardBreakdownProps) {
  const summary = getQuestRewardSummary(quest);

  if (compact) {
    return (
      <div className={className}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-display font-black text-amber-300 text-lg">+{summary.baseXp} XP</span>
          <EntryTokenBadge count={summary.drawingEntries} small />
        </div>
        {summary.bonuses.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {summary.bonuses.map((bonus) => {
              const Icon = BONUS_ICONS[bonus.key];
              const bonusEntries = bonus.key === 'nfc' ? summary.nfcCacheEntryBonus : 0;
              return (
                <li key={bonus.key} className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 flex-wrap">
                  <Icon size={11} className="shrink-0" />
                  <span>+{bonus.xp} XP {bonus.label}</span>
                  <EntryTokenBadge count={bonusEntries} small />
                </li>
              );
            })}
            {summary.drawingEntryBonus > 0 && (
              <li className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                <Ticket size={11} className="shrink-0 text-purple-400" />
                <span className="text-purple-300">Bonus Entry</span>
                <EntryTokenBadge count={summary.drawingEntryBonus} small />
              </li>
            )}
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

      {/* Base completion — XP and its Entry Token, shown as two distinct figures */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-white font-bold">
            <Zap size={14} className="text-amber-400" />
            Base Completion
          </span>
          <span className="flex items-center gap-3">
            <span className="font-mono font-bold text-amber-300">+{summary.baseXp} XP</span>
            <EntryTokenBadge count={summary.drawingEntries} />
          </span>
        </div>
        {summary.bonuses.map((bonus) => {
          const Icon = BONUS_ICONS[bonus.key];
          const bonusEntries = bonus.key === 'nfc' ? summary.nfcCacheEntryBonus : 0;
          return (
            <div key={bonus.key} className="flex items-center justify-between text-xs pl-1">
              <span className="flex items-center gap-2 text-stone-300 uppercase font-bold tracking-wide">
                <Icon size={13} className="text-cyan-400" />
                {BONUS_ROW_LABELS[bonus.key]}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono font-bold text-cyan-300">+{bonus.xp} XP</span>
                <EntryTokenBadge count={bonusEntries} small />
              </span>
            </div>
          );
        })}
      </div>

      {/* Race placement tiers — XP only, never an entry */}
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

      {/* Explicit configured bonus Entry Token — separate from the base entry above */}
      {summary.drawingEntryBonus > 0 && (
        <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-stone-300 uppercase font-bold tracking-wide">
            <Ticket size={13} className="text-purple-400" />
            Bonus Entry
          </span>
          <EntryTokenBadge count={summary.drawingEntryBonus} />
        </div>
      )}

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
