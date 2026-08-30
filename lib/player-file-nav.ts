/**
 * Canton Quests — the one shared "go to the Player File" navigation
 * behavior. Every player-facing control that opens /profile (the top-nav
 * PLAYER FILE item in components/CinematicNav.tsx and components/Header.tsx,
 * the Mission-homepage VIEW PLAYER FILE CTA in components/FounderCipherShell.tsx,
 * the platform-homepage VIEW PLAYER FILE / COMPLETE IDENTITY hero CTA in
 * app/page.tsx, and the "Profile & Badges" link in components/PlayerIdentityBar.tsx)
 * must call this — never link straight to /profile and never re-implement
 * this branching locally. That's what let a second control silently bypass
 * the one-time intro before this file existed.
 *
 * Auth is always checked first and independently of the intro: a logged-out
 * click goes through the existing register flow (preserving /profile as the
 * post-auth destination) and never touches the video, so the intro can
 * never block registration or email confirmation. An already-authenticated
 * player who has already completed the intro (lib/transmission-viewed-state.ts,
 * same key the old permanent /profile button used) goes straight to
 * /profile. Only a first-eligible click plays Transmission #11, and only a
 * deliberate dismissal (X/Close, Skip/Continue, or the video's own onEnded —
 * see the commander-transmission backdrop-dismiss guard in
 * components/game-effects/GameMomentOverlay.tsx) marks it complete and
 * navigates onward.
 *
 * Deliberately NOT a React hook: every caller already has its own `player`
 * state and `router` from `useRouter()`; this only needs to be a plain,
 * side-effecting function of those two values so it can be called from
 * plain onClick handlers without adding a hook rules-of-hooks dependency.
 */

import { Player } from './types';
import { showGameMoment } from './game-effects';
import { hasViewedTransmission, markTransmissionViewed } from './transmission-viewed-state';
import { getCommanderTransmissionForTrigger, toGameplayTransmission } from './commander-transmissions';

/** The minimal router shape this needs — decoupled from Next's exact useRouter() type so this file has no framework-hook import of its own. */
export interface PlayerFileRouter {
  push: (href: string) => void;
}

export function navigateToPlayerFile(router: PlayerFileRouter, player: Player | null): void {
  if (!player) {
    router.push(`/register?next=${encodeURIComponent('/profile')}`);
    return;
  }

  const pid = player.id;
  if (hasViewedTransmission('cipher_profile', 'video-11', pid)) {
    router.push('/profile');
    return;
  }

  const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_profile' });
  if (!entry) {
    router.push('/profile');
    return;
  }

  showGameMoment({
    type: 'commander-transmission',
    trigger: 'cipher_profile',
    transmission: toGameplayTransmission(entry),
    onFinished: () => {
      markTransmissionViewed('cipher_profile', 'video-11', pid);
      router.push('/profile');
    },
  });
}

/** Convenience wrapper for a Link/button `onClick` — prevents the default navigation, then runs navigateToPlayerFile. */
export function createPlayerFileClickHandler(router: PlayerFileRouter, player: Player | null) {
  return (e: { preventDefault: () => void }) => {
    e.preventDefault();
    navigateToPlayerFile(router, player);
  };
}
