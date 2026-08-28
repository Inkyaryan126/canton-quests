'use client';

import { useEffect } from 'react';
import { showGameMoment } from '@/lib/game-effects';
import { shouldAutoShowTransmission, markTransmissionViewed } from '@/lib/transmission-viewed-state';
import { getCommanderTransmissionForTrigger, toGameplayTransmission } from '@/lib/commander-transmissions';

function getClientPlayerId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem('canton_quests_current_player');
    if (stored) return (JSON.parse(stored) as { id?: string }).id;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Renders nothing — fires the "Basic Rules" Commander video (4) once per
 * player the first time they land on the Founder's Cipher rules page. A
 * tiny, non-visual client component so app/events/[slug]/rules/page.tsx
 * (a Server Component) doesn't need converting wholesale for one trigger.
 */
export default function CipherRulesVideoTrigger() {
  useEffect(() => {
    const pid = getClientPlayerId();
    if (!shouldAutoShowTransmission('cipher_rules_intro', 'video-4', pid)) return;
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_rules_intro' });
    if (!entry) return;
    markTransmissionViewed('cipher_rules_intro', 'video-4', pid);
    showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_rules_intro',
      transmission: toGameplayTransmission(entry),
    });
  }, []);

  return null;
}
