'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { showGameMoment } from '@/lib/game-effects';
import { markTransmissionViewed } from '@/lib/transmission-viewed-state';
import { getCommanderTransmissionForTrigger, toGameplayTransmission } from '@/lib/commander-transmissions';
import type { CommanderTransmissionTrigger } from '@/lib/game-effects';
import type { StartingPath } from '@/lib/types';

/**
 * Canton Quests — reusable in-world "WATCH TRANSMISSION" control.
 *
 * A single, reusable button for the Founder's Cipher numbered Commander
 * video archive (lib/commander-transmissions.ts). Uses the real
 * gold/cyan HUD button asset at /canton-quests/watch_transmission.png —
 * never redrawn in CSS, never replaced with plain text unless the image
 * itself fails to load.
 *
 * PLACEMENT MAP — which trigger goes near which section (see the mission
 * report for the full rationale per placement):
 *   cipher_welcome      (2)  — Mission overview hero, app/events/[slug]/page.tsx
 *   cipher_prize_intro  (3)  — Drawing/prize page hero, app/events/[slug]/drawing/page.tsx
 *   cipher_rules_intro  (4)  — Top of the Rules page, app/events/[slug]/rules/page.tsx
 *   cipher_city_intro   (5)  — Mission overview hero, app/events/[slug]/page.tsx
 *   cipher_callsign     (10) — Callsign field, components/FastPlayerOnboardForm.tsx
 *   cipher_first_xp     (12) — XP stat card, app/events/[slug]/page.tsx
 *   cipher_first_entry  (13) — Drawing/prize page, app/events/[slug]/drawing/page.tsx
 *   cipher_leaderboard  (14) — Leaderboard page header, app/leaderboard/page.tsx
 *   cipher_first_quest  (15) — Quests tab header, app/events/[slug]/page.tsx
 * Not rendered anywhere via this button: cipher_cold_open (1), cipher_three_doors (9),
 * cipher_path_selected (6/7/8) — those five stay auto-play "flow moments"
 * (see the trigger sites that already call showGameMoment directly).
 * cipher_profile (11) is no longer a permanent button anywhere — it is now
 * the one-time "PLAYER FILE" nav intro, wired directly in components/CinematicNav.tsx
 * (first-click only; never appears again once completed). /profile itself
 * stays Mission-neutral and never renders a Watch Transmission control.
 *
 * Opens the video through the EXISTING Commander transmission pipeline
 * (GameMomentManager -> CommanderTransmissionEffect -> CommanderMedia) —
 * no second video player. If no video is mapped to `trigger` (e.g. a typo,
 * or a trigger reserved for auto-play only), this renders nothing rather
 * than a dead button.
 */

export interface WatchTransmissionButtonProps {
  /** Which numbered Commander video this opens. */
  trigger: CommanderTransmissionTrigger;
  /** Required only for cipher_path_selected (not used by any manual placement today). */
  path?: StartingPath;
  /** The current player's id, for marking the transmission viewed (a UX convenience only — never gates anything). */
  playerId?: string;
  /** Optional small caption rendered above the button, e.g. "COMMANDER BRIEFING". Omit to let the asset speak for itself. */
  label?: string;
  size?: 'small' | 'medium' | 'hero';
  className?: string;
}

export default function WatchTransmissionButton({
  trigger,
  path,
  playerId,
  label,
  size = 'medium',
  className = '',
}: WatchTransmissionButtonProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const entry = getCommanderTransmissionForTrigger({ trigger, path });
  if (!entry) return null;

  const handleClick = () => {
    if (playerId) {
      markTransmissionViewed(trigger, `video-${entry.id}`, playerId);
    }
    showGameMoment({
      type: 'commander-transmission',
      trigger,
      transmission: toGameplayTransmission(entry),
    });
  };

  return (
    <div className={`cq-watch-transmission-wrap cq-watch-transmission-${size} ${className}`}>
      {label && <span className="cq-watch-transmission-label">{label}</span>}
      <button
        type="button"
        onClick={handleClick}
        className="cq-watch-transmission-btn"
        aria-label={`Watch Commander transmission: ${entry.title}`}
        title={entry.title}
      >
        {imageFailed ? (
          <span className="cq-watch-transmission-fallback">WATCH TRANSMISSION</span>
        ) : (
          <Image
            src="/canton-quests/watch_transmission.png"
            alt="Watch Transmission"
            fill
            sizes="(max-width: 640px) 45vw, 320px"
            className="cq-watch-transmission-img"
            onError={() => setImageFailed(true)}
          />
        )}
      </button>
    </div>
  );
}
