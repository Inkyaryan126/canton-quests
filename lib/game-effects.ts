/**
 * Canton Quests — Futuristic Game Moments & HUD Effects Engine
 *
 * Centralized, typed, queue-based engine for triggering and coordinating
 * cinematic in-game moments (City Scan, Path Lock, Quest XP, Rank Up,
 * Achievements, Flash Drops, Chain Finishes, Finale Qualification).
 */

import { StartingPath, QuestCommanderTransmission } from './types';

export type GameMomentType =
  | 'city-scan'
  | 'path-lock'
  | 'quest-complete'
  | 'rank-up'
  | 'achievement'
  | 'flash-drop'
  | 'chain-complete'
  | 'finale-qualified'
  | 'three-locks-fragment'
  | 'three-locks-complete'
  | 'commander-transmission'
  | 'reward-token'
  | 'unlock'
  | 'field-event'
  | 'leaderboard-milestone'
  | 'major-cinematic';

export type RankTier = 'normal' | 'top10' | 'top3' | 'first';

export interface BaseGameMoment {
  id?: string;
  type: GameMomentType;
  durationMs?: number;
  autoDismiss?: boolean;
  priority?: number; // Higher number = higher priority
  timestamp?: number;
  sequenceId?: string; // Group ID for multi-part moments (e.g. quest reward sequence)
  sequenceIndex?: number; // Order within the sequence group (0, 1, 2...)
  sequencePriority?: number; // Priority of the entire sequence group when sorting
  onFinished?: () => void;
}

export interface CityScanMoment extends BaseGameMoment {
  type: 'city-scan';
  district?: string;
  targetCount?: number;
  manualTrigger?: boolean;
  scanLabel?: string;
}

export interface PathLockMoment extends BaseGameMoment {
  type: 'path-lock';
  path: StartingPath;
  title?: string;
  district?: string;
  badge?: string;
  onFinished?: () => void;
}

export interface QuestCompleteMoment extends BaseGameMoment {
  type: 'quest-complete';
  questId?: string;
  questTitle: string;
  xpAwarded: number;
  verificationType?: string;
  unlockedQuestTitle?: string;
  unlockedQuestUrl?: string;
  drawingEntriesAwarded?: number;
  newTotalXp?: number;
  oldTotalXp?: number;
  newRank?: number;
  oldRank?: number;
}

export interface RankUpMoment extends BaseGameMoment {
  type: 'rank-up';
  oldRank: number;
  newRank: number;
  totalPlayers?: number;
  tier?: RankTier;
  reason?: string;
}

export interface AchievementMoment extends BaseGameMoment {
  type: 'achievement';
  achievementId: string;
  title: string;
  description: string;
  icon?: string;
  category?: string;
  rewardXp?: number;
  rewardEntries?: number;
}

export interface FlashDropMoment extends BaseGameMoment {
  type: 'flash-drop';
  questId?: string;
  questTitle: string;
  pointValue: number;
  district?: string;
  expiresInMinutes?: number;
  questUrl?: string;
}

export interface ChainCompleteMoment extends BaseGameMoment {
  type: 'chain-complete';
  chainTitle: string;
  nextObjectiveTitle?: string;
  nextObjectiveUrl?: string;
  totalSteps?: number;
  bonusXp?: number;
}

export interface FinaleQualifiedMoment extends BaseGameMoment {
  type: 'finale-qualified';
  playerLabel?: string;
  qualifiedEntries: number;
  ticketRange?: string;
  snapshotHash?: string;
  eventTitle?: string;
  isLocked?: boolean;
}

/**
 * A reusable cinematic reveal for any Founder's Three Locks fragment (MARK,
 * CODE, or WORD) — not specific to any one fragment. Triggered whenever a
 * quest's rewardConfig.threeLocksFragment is newly granted.
 */
export interface ThreeLocksFragmentMoment extends BaseGameMoment {
  type: 'three-locks-fragment';
  fragment: 'mark' | 'code' | 'word';
  headline: string;
  primaryText: string;
  secondaryText?: string;
  pathColor?: string;
  /** Which of the three fragments this player owns after this grant. */
  locksOwned: { mark: boolean; code: boolean; word: boolean };
}

/**
 * The bigger cinematic reveal shown once a player owns all three Founder's
 * Locks fragments (MARK + CODE + WORD) — distinct from (and typically
 * queued right after) the individual ThreeLocksFragmentMoment for the
 * fragment that completed the set.
 */
export interface ThreeLocksCompleteMoment extends BaseGameMoment {
  type: 'three-locks-complete';
  headline: string;
  primaryText: string;
  secondaryText?: string;
  pathColor?: string;
}

/**
 * A reusable full-screen Commander broadcast. Wraps an existing
 * QuestCommanderTransmission (see lib/types.ts) with the trigger context
 * that caused it to fire — the same transmission data can be shown as an
 * inline briefing card (components/CommanderTransmission.tsx) or as this
 * cinematic overlay; nothing about the transmission's own shape changes
 * between the two.
 */
export type CommanderTransmissionTrigger =
  | 'sector_intro'
  | 'quest_intro'
  | 'quest_milestone'
  | 'quest_completion'
  | 'hidden_quest_discovery'
  | 'nfc_cache_discovery'
  | 'gm_announcement'
  | 'three_locks_fragment'
  | 'finale_qualified'
  | 'finale_opening'
  | 'leaderboard_milestone'
  // Founder's Cipher numbered Commander video archive (see
  // lib/commander-transmissions.ts) — the real 1-15 video registry, distinct
  // from the placeholder per-quest QuestCommanderTransmission triggers above.
  | 'cipher_cold_open'
  | 'cipher_welcome'
  | 'cipher_prize_intro'
  | 'cipher_rules_intro'
  | 'cipher_city_intro'
  | 'cipher_path_selected'
  | 'cipher_three_doors'
  | 'cipher_callsign'
  | 'cipher_profile'
  | 'cipher_first_xp'
  | 'cipher_first_entry'
  | 'cipher_leaderboard'
  | 'cipher_first_quest'
  // Contextual Transmission Engine (see lib/contextual-transmissions.ts) —
  // the generic trigger vocabulary the whole live game resolves through, so
  // future systems (player links, NPCs, Watchers, the finale) never need to
  // invent their own scattered Commander-firing logic. Several of these
  // resolve to the SAME numbered video as an existing cipher_* trigger above
  // when their content genuinely matches (mission_entry ~ cipher_cold_open,
  // path_selection ~ cipher_three_doors, path_selected ~
  // cipher_path_selected) — kept as distinct trigger names rather than
  // renaming the existing ones, so nothing already wired has to change.
  | 'mission_entry'
  | 'path_selection'
  | 'path_selected'
  | 'fragment_recovered'
  | 'district_sigil_unlocked'
  | 'xp_awarded'
  | 'drawing_entry_awarded'
  | 'badge_awarded'
  | 'flash_drop'
  | 'city_event'
  | 'sector_event'
  | 'community_milestone'
  | 'npc_event'
  | 'player_link'
  | 'watcher_signal'
  | 'final_hours'
  | 'finale'
  | 'emergency';

export interface CommanderTransmissionMoment extends BaseGameMoment {
  type: 'commander-transmission';
  trigger: CommanderTransmissionTrigger;
  transmission: QuestCommanderTransmission;
  /** A stable key identifying *what* this transmission is about (e.g. a quest id), used for viewed-state tracking. Omit for transmissions that should always show (e.g. gm_announcement). */
  viewedStateKey?: string;
  onContinue?: () => void;
}

/**
 * Shared optional fields for the "reward" moment families (REWARD/TOKEN,
 * UNLOCK, FIELD EVENT, PROGRESSION, MAJOR CINEMATIC) so a new reward type
 * never needs its own bespoke prop list — see lib/quest-rewards.ts and
 * SubmitProofResult (lib/types.ts) for where the underlying server-awarded
 * values these fields display come from. The UI only ever displays what the
 * server already granted; it never computes or invents a reward amount.
 */
export interface RewardMomentBase extends BaseGameMoment {
  headline: string;
  primaryText?: string;
  secondaryText?: string;
  /** Server-awarded XP for this specific event. Never display an amount the server didn't actually grant. */
  xpAmount?: number;
  /** Server-awarded drawing/prize entries for this specific event. */
  entryCount?: number;
  /** Placeholder key for reward artwork (collectible art, cache icon, etc.) — no binary asset required to exist yet. */
  artworkKey?: string;
  /** Placeholder key for an accompanying Commander photo, if this reward pairs with a short Commander reaction. */
  commanderImageKey?: string;
  pathColor?: string;
  rarity?: 'common' | 'rare' | 'legendary';
  /** A CQSoundKey/CQSoundEvent string — resolved by the rendering component; unknown/missing keys no-op safely. */
  soundKey?: string;
  cta?: string;
  /** Generic progress indicator, e.g. { current: 2, total: 3, label: 'Three Locks' } or a cache index. */
  progress?: { current: number; total: number; label?: string };
  /** An optional Commander transmission to queue immediately after this reward moment is dismissed. */
  optionalCommanderFollowup?: QuestCommanderTransmission;
}

export type RewardTokenKind = 'xp' | 'entry-token' | 'race-bonus';
export interface RewardTokenMoment extends RewardMomentBase {
  type: 'reward-token';
  kind: RewardTokenKind;
}

export type UnlockKind = 'collectible' | 'secret';
export interface UnlockMoment extends RewardMomentBase {
  type: 'unlock';
  kind: UnlockKind;
}

export type FieldEventKind = 'field-confirmed' | 'nfc-cache' | 'live-event';
export interface FieldEventMoment extends RewardMomentBase {
  type: 'field-event';
  kind: FieldEventKind;
}

export interface LeaderboardMilestoneMoment extends RewardMomentBase {
  type: 'leaderboard-milestone';
}

export type MajorCinematicKind = 'prize-win' | 'city-legend';
export interface MajorCinematicMoment extends RewardMomentBase {
  type: 'major-cinematic';
  kind: MajorCinematicKind;
}

export type GameMoment =
  | CityScanMoment
  | PathLockMoment
  | QuestCompleteMoment
  | RankUpMoment
  | AchievementMoment
  | FlashDropMoment
  | ChainCompleteMoment
  | FinaleQualifiedMoment
  | ThreeLocksFragmentMoment
  | ThreeLocksCompleteMoment
  | CommanderTransmissionMoment
  | RewardTokenMoment
  | UnlockMoment
  | FieldEventMoment
  | LeaderboardMilestoneMoment
  | MajorCinematicMoment;

export interface GameEffectsState {
  currentMoment: GameMoment | null;
  queue: GameMoment[];
  isPaused: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  history: GameMoment[];
}

export interface GameMomentOptions {
  skipQueue?: boolean;
  delayMs?: number;
}

type Listener = (state: GameEffectsState) => void;

class GameMomentManager {
  private state: GameEffectsState = {
    currentMoment: null,
    queue: [],
    isPaused: false,
    reducedMotion: false,
    soundEnabled: true,
    history: [],
  };

  private listeners: Set<Listener> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private isClient: boolean = typeof window !== 'undefined';

  constructor() {
    if (this.isClient) {
      // Check prefers-reduced-motion
      try {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.state.reducedMotion = mediaQuery.matches;
        mediaQuery.addEventListener?.('change', (e) => {
          this.state.reducedMotion = e.matches;
          this.notify();
        });
      } catch {
        // Fallback
      }

      // Check sound preference in localStorage
      try {
        const storedEnabled = window.localStorage.getItem('cq_sound_enabled');
        if (storedEnabled !== null) {
          this.state.soundEnabled = storedEnabled === 'true';
        } else {
          const storedMute = window.localStorage.getItem('canton_effects_muted');
          if (storedMute !== null) {
            this.state.soundEnabled = storedMute !== 'true';
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  public getState(): GameEffectsState {
    return { ...this.state, queue: [...this.state.queue] };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.error('[GameEffects] Listener error:', err);
      }
    });
  }

  /**
   * Helper to determine rank tier based on new rank position
   */
  public static calculateRankTier(newRank: number, oldRank?: number): RankTier {
    if (newRank <= 0) return 'normal';
    if (newRank === 1) return 'first';
    if (newRank <= 3) return 'top3';
    if (newRank <= 10) return 'top10';
    return 'normal';
  }

  /**
   * Compare two moments for queue ordering:
   * - Moments in the same sequence group strictly preserve sequenceIndex ascending
   * - Moments across different groups/standalone compare effective sequencePriority / priority descending
   * - Ties preserve FIFO arrival order by timestamp
   */
  public static compareMoments(a: GameMoment, b: GameMoment): number {
    // 1. If both belong to the same atomic sequence, maintain strict sequential order
    if (a.sequenceId && b.sequenceId && a.sequenceId === b.sequenceId) {
      const indexDiff = (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0);
      if (indexDiff !== 0) return indexDiff;
      return (a.timestamp ?? 0) - (b.timestamp ?? 0);
    }

    // 2. Different sequence groups or standalone moments: compare effective priorities
    const pA = a.sequencePriority ?? a.priority ?? 0;
    const pB = b.sequencePriority ?? b.priority ?? 0;

    if (pA !== pB) {
      return pB - pA; // Higher priority first
    }

    // 3. Same effective priority: preserve FIFO ordering
    const timeA = a.timestamp ?? 0;
    const timeB = b.timestamp ?? 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Tie-break by sequenceId if different
    if (a.sequenceId && b.sequenceId && a.sequenceId !== b.sequenceId) {
      return a.sequenceId.localeCompare(b.sequenceId);
    }

    return 0;
  }

  /**
   * Enqueue or immediately show a game moment
   */
  public trigger(moment: GameMoment, options?: GameMomentOptions): string {
    const id = moment.id || `moment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullMoment: GameMoment = {
      ...moment,
      id,
      timestamp: moment.timestamp ?? Date.now(),
      priority: moment.priority ?? this.getDefaultPriority(moment.type),
      durationMs: moment.durationMs ?? this.getDefaultDuration(moment.type),
      sequenceId: moment.sequenceId,
      sequenceIndex: moment.sequenceIndex,
      sequencePriority: moment.sequencePriority,
    };

    if (options?.delayMs && options.delayMs > 0) {
      setTimeout(() => {
        this.enqueue(fullMoment, options?.skipQueue);
      }, options.delayMs);
      return id;
    }

    this.enqueue(fullMoment, options?.skipQueue);
    return id;
  }

  /**
   * Enqueue a batch of moments that must play in strict sequential order as a single atomic sequence.
   */
  public triggerSequence(moments: GameMoment[], options?: GameMomentOptions): string[] {
    if (!moments || moments.length === 0) return [];
    const seqId = `seq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const groupTimestamp = Date.now();
    const maxPriority = Math.max(...moments.map((m) => m.priority ?? this.getDefaultPriority(m.type)));
    const sequencePriority = Math.max(90, maxPriority);

    const ids: string[] = [];
    moments.forEach((m, idx) => {
      const id = m.id || `moment-${groupTimestamp}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
      ids.push(id);
      const fullMoment: GameMoment = {
        ...m,
        id,
        timestamp: groupTimestamp,
        priority: m.priority ?? this.getDefaultPriority(m.type),
        durationMs: m.durationMs ?? this.getDefaultDuration(m.type),
        sequenceId: seqId,
        sequenceIndex: idx,
        sequencePriority,
      };

      if (idx === 0 && options?.skipQueue) {
        this.enqueue(fullMoment, true);
      } else {
        this.enqueue(fullMoment, false);
      }
    });

    return ids;
  }

  private getDefaultPriority(type: GameMomentType): number {
    switch (type) {
      case 'finale-qualified':
        return 100;
      case 'major-cinematic':
        return 99;
      case 'three-locks-complete':
        return 96;
      case 'three-locks-fragment':
        return 95;
      case 'rank-up':
        return 90;
      case 'unlock':
        return 86;
      case 'achievement':
        return 85;
      case 'reward-token':
        return 83;
      case 'quest-complete':
        return 80;
      case 'path-lock':
        return 75;
      case 'field-event':
        return 73;
      case 'chain-complete':
        return 70;
      case 'leaderboard-milestone':
        return 68;
      case 'flash-drop':
        return 65;
      case 'commander-transmission':
        return 60;
      case 'city-scan':
        return 50;
      default:
        return 10;
    }
  }

  private getDefaultDuration(type: GameMomentType): number {
    // Reduced motion uses slightly shorter, crisp durations
    const isReduced = this.state.reducedMotion;
    switch (type) {
      case 'city-scan':
        return isReduced ? 600 : 950;
      case 'path-lock':
        return isReduced ? 1600 : 2500;
      case 'quest-complete':
        return isReduced ? 2000 : 3200;
      case 'rank-up':
        return isReduced ? 2200 : 3500;
      case 'achievement':
        return isReduced ? 2200 : 3200;
      case 'flash-drop':
        return isReduced ? 2400 : 3800;
      case 'chain-complete':
        return isReduced ? 2400 : 3600;
      case 'finale-qualified':
        return isReduced ? 3000 : 4500;
      case 'major-cinematic':
        return isReduced ? 3000 : 4500;
      case 'three-locks-complete':
        return isReduced ? 3000 : 4500;
      case 'three-locks-fragment':
        return isReduced ? 2800 : 4200;
      case 'unlock':
        return isReduced ? 2200 : 3200;
      case 'reward-token':
        return isReduced ? 2000 : 3000;
      case 'field-event':
        return isReduced ? 2000 : 3000;
      case 'leaderboard-milestone':
        return isReduced ? 2000 : 3000;
      case 'commander-transmission':
        // Player-paced (reads a message / watches a poster+video), not a
        // fire-and-forget celebration — give it a long default so it never
        // feels rushed; skippable transmissions still let the player
        // dismiss immediately via the CTA.
        return isReduced ? 4000 : 8000;
      default:
        return 2000;
    }
  }

  private enqueue(moment: GameMoment, skipQueue?: boolean) {
    if (skipQueue) {
      this.clearTimer();
      this.state.currentMoment = moment;
      this.state.history.unshift(moment);
      this.scheduleAutoDismiss(moment);
      this.notify();
      return;
    }

    if (!this.state.currentMoment) {
      this.state.currentMoment = moment;
      this.state.history.unshift(moment);
      this.scheduleAutoDismiss(moment);
      this.notify();
    } else {
      // Insert in priority & sequence order
      const newQueue = [...this.state.queue, moment].sort(GameMomentManager.compareMoments);
      this.state.queue = newQueue;
      this.notify();
    }
  }

  private scheduleAutoDismiss(moment: GameMoment) {
    this.clearTimer();
    const duration = moment.durationMs || 3000;

    this.timer = setTimeout(() => {
      this.dismissCurrent();
    }, duration);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Dismiss the currently active moment and move to next queued moment
   */
  public dismissCurrent() {
    this.clearTimer();
    const current = this.state.currentMoment;

    // Run custom onFinished callback if present on current moment
    if (current && current.onFinished) {
      try {
        current.onFinished();
      } catch (e) {
        console.error('[GameEffects] onFinished callback error:', e);
      }
    }

    if (this.state.queue.length > 0) {
      const [nextMoment, ...rest] = this.state.queue;
      this.state.currentMoment = nextMoment;
      this.state.queue = rest;
      this.state.history.unshift(nextMoment);
      this.scheduleAutoDismiss(nextMoment);
    } else {
      this.state.currentMoment = null;
    }

    this.notify();
  }

  /**
   * Skip and clear all remaining queued moments
   */
  public skipAll() {
    this.clearTimer();
    const current = this.state.currentMoment;

    // Run custom onFinished callback if present on active moment
    if (current && current.onFinished) {
      try {
        current.onFinished();
      } catch (e) {
        console.error('[GameEffects] onFinished callback error in skipAll:', e);
      }
    }

    this.state.queue = [];
    this.state.currentMoment = null;
    this.notify();
  }

  public setReducedMotion(enabled: boolean) {
    this.state.reducedMotion = enabled;
    this.notify();
  }

  public setSoundEnabled(enabled: boolean) {
    this.state.soundEnabled = enabled;
    if (this.isClient) {
      try {
        window.localStorage.setItem('cq_sound_enabled', enabled.toString());
        window.localStorage.setItem('canton_effects_muted', (!enabled).toString());
      } catch {
        // Fallback
      }
    }
    this.notify();
  }

  public toggleSound(): boolean {
    const next = !this.state.soundEnabled;
    this.setSoundEnabled(next);
    return next;
  }
}

// Global Singleton Instance
export const gameMomentManager = new GameMomentManager();

/**
 * Public trigger helper for triggering cinematic moments anywhere in the app
 */
export function showGameMoment(moment: GameMoment, options?: GameMomentOptions): string {
  return gameMomentManager.trigger(moment, options);
}

/**
 * Public trigger helper for triggering an atomic sequence of cinematic moments
 */
export function triggerGameMomentSequence(moments: GameMoment[], options?: GameMomentOptions): string[] {
  return gameMomentManager.triggerSequence(moments, options);
}

/**
 * Helper to queue complete sequence when a quest is verified:
 * 1. Quest Complete (+XP)
 * 2. Rank Up (if rank improved)
 * 3. Achievement (if unlocked)
 * 4. Chain complete (if unlocked)
 *
 * Guarantees atomic sequential FIFO ordering even when an overlay is already active.
 */
export function triggerQuestRewardSequence(params: {
  questId?: string;
  questTitle: string;
  xpAwarded: number;
  verificationType?: string;
  unlockedQuestTitle?: string;
  unlockedQuestUrl?: string;
  drawingEntriesAwarded?: number;
  oldRank?: number;
  newRank?: number;
  totalPlayers?: number;
  newAchievements?: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
    rewardXp?: number;
    rewardEntries?: number;
  }>;
  isChainComplete?: boolean;
  chainTitle?: string;
}): string[] {
  const moments: GameMoment[] = [];

  // 1. Show Quest Complete (+XP)
  moments.push({
    type: 'quest-complete',
    questId: params.questId,
    questTitle: params.questTitle,
    xpAwarded: params.xpAwarded,
    verificationType: params.verificationType,
    unlockedQuestTitle: params.unlockedQuestTitle,
    unlockedQuestUrl: params.unlockedQuestUrl,
    drawingEntriesAwarded: params.drawingEntriesAwarded,
  });

  // 2. Queue Rank Up if rank strictly improved
  if (
    params.oldRank !== undefined &&
    params.newRank !== undefined &&
    params.newRank > 0 &&
    params.newRank < params.oldRank
  ) {
    const tier = GameMomentManager.calculateRankTier(params.newRank, params.oldRank);
    moments.push({
      type: 'rank-up',
      oldRank: params.oldRank,
      newRank: params.newRank,
      totalPlayers: params.totalPlayers,
      tier,
    });
  }

  // 3. Queue Achievements if any unlocked
  if (params.newAchievements && params.newAchievements.length > 0) {
    params.newAchievements.forEach((ach) => {
      moments.push({
        type: 'achievement',
        achievementId: ach.id,
        title: ach.title,
        description: ach.description,
        icon: ach.icon || '🏆',
        rewardXp: ach.rewardXp,
        rewardEntries: ach.rewardEntries,
      });
    });
  }

  // 4. Queue Chain Complete if applicable
  if (params.isChainComplete && params.chainTitle) {
    moments.push({
      type: 'chain-complete',
      chainTitle: params.chainTitle,
      nextObjectiveTitle: params.unlockedQuestTitle,
      nextObjectiveUrl: params.unlockedQuestUrl,
    });
  }

  return gameMomentManager.triggerSequence(moments);
}

/**
 * Triggers any reward-family moment (RewardTokenMoment, UnlockMoment,
 * FieldEventMoment, LeaderboardMilestoneMoment, MajorCinematicMoment,
 * ThreeLocksFragmentMoment/ThreeLocksCompleteMoment, FinaleQualifiedMoment)
 * and — generically, for every one of them — auto-queues its
 * `optionalCommanderFollowup` transmission (if set) once the moment is
 * dismissed. Prefer this over `showGameMoment` directly whenever a moment
 * might carry a follow-up; it's a no-op passthrough otherwise.
 */
export function triggerRewardMoment(moment: GameMoment, options?: GameMomentOptions): string {
  const followup = 'optionalCommanderFollowup' in moment ? moment.optionalCommanderFollowup : undefined;
  if (!followup) return showGameMoment(moment, options);

  const originalOnFinished = moment.onFinished;
  const withFollowup: GameMoment = {
    ...moment,
    onFinished: () => {
      originalOnFinished?.();
      showGameMoment({
        type: 'commander-transmission',
        trigger: 'quest_completion',
        transmission: followup,
      });
    },
  };
  return showGameMoment(withFollowup, options);
}
