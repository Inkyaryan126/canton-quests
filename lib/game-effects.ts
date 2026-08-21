/**
 * Canton Quests — Futuristic Game Moments & HUD Effects Engine
 *
 * Centralized, typed, queue-based engine for triggering and coordinating
 * cinematic in-game moments (City Scan, Path Lock, Quest XP, Rank Up,
 * Achievements, Flash Drops, Chain Finishes, Finale Qualification).
 */

import { StartingPath } from './types';

export type GameMomentType =
  | 'city-scan'
  | 'path-lock'
  | 'quest-complete'
  | 'rank-up'
  | 'achievement'
  | 'flash-drop'
  | 'chain-complete'
  | 'finale-qualified';

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

export type GameMoment =
  | CityScanMoment
  | PathLockMoment
  | QuestCompleteMoment
  | RankUpMoment
  | AchievementMoment
  | FlashDropMoment
  | ChainCompleteMoment
  | FinaleQualifiedMoment;

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
        const storedMute = window.localStorage.getItem('canton_effects_muted');
        if (storedMute !== null) {
          this.state.soundEnabled = storedMute !== 'true';
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
      case 'rank-up':
        return 90;
      case 'achievement':
        return 85;
      case 'quest-complete':
        return 80;
      case 'path-lock':
        return 75;
      case 'chain-complete':
        return 70;
      case 'flash-drop':
        return 65;
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
