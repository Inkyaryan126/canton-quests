/**
 * Canton Quests — Founder's Cipher gameplay message resolver.
 *
 * The one place that turns a canonical message id + a player's universal
 * path into ready-to-render copy. Reads players.selected_starting_path —
 * the canonical, platform-wide path source established by the universal
 * player path refactor (see lib/player-command-center.ts
 * hasValidStartingPath) — never event_players.path.
 */

import { StartingPath } from '@/lib/types';
import { showGameMoment, GameMomentOptions } from '@/lib/game-effects';
import { logFounderCipherMessage } from './message-log';
import { FOUNDER_CIPHER_MESSAGES, FOUNDER_LOCK_ORDINAL_MESSAGES } from './messages';
import { FounderCipherMessageId, ResolvedFounderCipherMessage } from './types';

export type FounderLockOrdinal = 'first' | 'second' | 'third';

export function getFounderLockOrdinal(count?: number): FounderLockOrdinal | null {
  if (count === 1) return 'first';
  if (count === 2) return 'second';
  if (count === 3) return 'third';
  return null;
}

export interface ResolveFounderCipherMessageOptions {
  lockCount?: number;
}

/**
 * Resolves a canonical message for a given player path. If the path is
 * missing/invalid, falls back to the message's neutral variant — never
 * throws, never fabricates a path.
 */
export function getFounderCipherMessage(
  messageId: FounderCipherMessageId,
  path: StartingPath | null | undefined,
  options?: ResolveFounderCipherMessageOptions
): ResolvedFounderCipherMessage {
  const message = FOUNDER_CIPHER_MESSAGES[messageId];

  // Dynamic first/second/third Founder Lock message resolution
  if (messageId === 'FOUNDER_LOCK_RECOVERED' && options?.lockCount) {
    const ordinal = getFounderLockOrdinal(options.lockCount);
    if (ordinal && FOUNDER_LOCK_ORDINAL_MESSAGES[ordinal]) {
      const ordinalData = FOUNDER_LOCK_ORDINAL_MESSAGES[ordinal];
      if (!path || (path !== 'family' && path !== 'challenge' && path !== 'secret')) {
        return {
          id: message.id,
          title: ordinalData.title,
          body: ordinalData.neutral,
          cta: message.cta,
          presentation: message.presentation,
          size: message.size,
          path: null,
          archiveWorthy: Boolean(message.archiveWorthy),
        };
      }

      const flavor = ordinalData[path];
      return {
        id: message.id,
        title: ordinalData.title,
        body: flavor.body,
        cta: message.cta,
        presentation: message.presentation,
        size: message.size,
        path,
        archiveWorthy: Boolean(message.archiveWorthy),
      };
    }
  }

  if (!path || (path !== 'family' && path !== 'challenge' && path !== 'secret')) {
    return {
      id: message.id,
      title: message.title,
      body: message.neutral,
      cta: message.cta,
      presentation: message.presentation,
      size: message.size,
      path: null,
      archiveWorthy: Boolean(message.archiveWorthy),
    };
  }

  const flavor = message[path];
  return {
    id: message.id,
    title: flavor.title || message.title,
    body: flavor.body,
    cta: flavor.cta || message.cta,
    presentation: message.presentation,
    size: message.size,
    path,
    archiveWorthy: Boolean(message.archiveWorthy),
  };
}

/** Convenience: resolve straight from a Player-shaped object's selectedStartingPath. */
export function getFounderCipherMessageForPlayer(
  messageId: FounderCipherMessageId,
  player: { selectedStartingPath?: StartingPath } | null | undefined,
  options?: ResolveFounderCipherMessageOptions
): ResolvedFounderCipherMessage {
  return getFounderCipherMessage(messageId, player?.selectedStartingPath ?? null, options);
}

export interface ShowFounderCipherMessageParams {
  messageId: FounderCipherMessageId;
  path: StartingPath | null | undefined;
  /** For archive-log entries and any future per-player de-duplication. Omit only for truly anonymous/impossible-to-attribute moments. */
  playerId?: string;
  /** A short, real, in-context label appended to the resolved title — e.g. the actual district name ("ARTS DISTRICT") or quest title. The canonical copy stays generic/reusable; this is how one call site can still say something concrete without a bespoke message entry per district/quest. */
  contextLabel?: string;
  /** Actual number of recovered Founder Locks (1, 2, 3) to enable dynamic first/second/third wording */
  lockCount?: number;
  onContinue?: () => void;
  gameMomentOptions?: GameMomentOptions;
}

/**
 * The single call site every gameplay integration should use: resolves the
 * canonical message for the player's path, fires it as a 'commander-text'
 * GameMoment (reusing the existing queue/overlay/backdrop-dismiss
 * infrastructure — see components/game-effects/GameMomentOverlay.tsx), and
 * — if the message is archiveWorthy — logs it so the player can recover it
 * later from the Transmissions archive's FIELD LOG section.
 *
 * Only messages whose `presentation` is 'commander-text' should be routed
 * through here; 'micro' feedback belongs on the existing lightweight
 * moment types (reward-token, field-event, etc.) instead — see the mission
 * report for which trigger uses which presentation level.
 */
export function showFounderCipherMessage(params: ShowFounderCipherMessageParams): string {
  const resolved = getFounderCipherMessage(params.messageId, params.path, { lockCount: params.lockCount });
  if (params.playerId) {
    logFounderCipherMessage(params.playerId, resolved);
  }
  return showGameMoment(
    {
      type: 'commander-text',
      title: params.contextLabel ? `${resolved.title} — ${params.contextLabel}` : resolved.title,
      body: resolved.body,
      size: resolved.size,
      path: resolved.path,
      cta: resolved.cta,
      messageId: resolved.id,
      onContinue: params.onContinue,
    },
    params.gameMomentOptions
  );
}
