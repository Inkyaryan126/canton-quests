/**
 * Canton Quests — Commander Transmission media-mode resolution.
 *
 * Pure logic extracted out of components/commander/CommanderMedia.tsx so
 * the VIDEO -> PHOTO_MESSAGE fallback decision is unit-testable without a
 * DOM: a transmission renders VIDEO only when it's declared VIDEO, a
 * mediaKey is actually configured, and playback hasn't already failed;
 * every other case (PHOTO_MESSAGE, no mediaKey yet, or a failed video)
 * resolves to the PHOTO_MESSAGE-style placeholder treatment — never a
 * broken/blank media element.
 */
export function resolveTransmissionMediaMode(
  transmission: { type: 'VIDEO' | 'PHOTO_MESSAGE'; mediaKey?: string },
  videoFailed: boolean = false
): 'video' | 'photo' {
  if (transmission.type === 'VIDEO' && Boolean(transmission.mediaKey) && !videoFailed) {
    return 'video';
  }
  return 'photo';
}

/** The CTA label to show, honoring an explicit override, defaulting to CONTINUE. */
export function resolveTransmissionCta(transmission: { cta?: string }): string {
  return transmission.cta || 'CONTINUE';
}

/** Whether the transmission's dismiss/skip control should render. Defaults to true. */
export function isTransmissionSkippable(transmission: { skippable?: boolean }): boolean {
  return transmission.skippable !== false;
}

/** Whether a "Replay Transmission" affordance should be offered. Defaults to true. */
export function isTransmissionReplayable(transmission: { replayable?: boolean }): boolean {
  return transmission.replayable !== false;
}
