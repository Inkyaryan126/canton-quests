'use client';

import { useEffect, useState } from 'react';

const DECODE_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▓', '▒', '░'] as const;
const DECODE_BAR_LENGTH = 10;
const DECODE_TICK_MS = 120;
const DECODE_STATIC_GLYPH = '▓';

/**
 * Pure and deterministic (no RNG) so it can be unit-tested without
 * rendering: reduced motion always freezes to a static filled bar,
 * otherwise every glyph cycles at its own offset so the bar reads as
 * scrolling signal noise rather than a single blinking dot.
 */
export function getDecodeBar(tick: number, reducedMotion: boolean, length: number = DECODE_BAR_LENGTH): string {
  if (reducedMotion) return DECODE_STATIC_GLYPH.repeat(length);
  return Array.from({ length }, (_, i) => DECODE_GLYPHS[(tick + i * 3) % DECODE_GLYPHS.length]).join('');
}

export interface TransmissionLoaderProps {
  /** e.g. "DECODING TRANSMISSION", "ACQUIRING SIGNAL", "BUFFERING SIGNAL". */
  label?: string;
  reducedMotion?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The one loading/working primitive for the game — a cycling glyph bar
 * plus an uppercase mono status line that reads as a transmission being
 * decoded, rather than a generic spinner. Drop in wherever the game is
 * waiting on something (GPS lock, video buffering, server verification)
 * without implying any particular duration.
 */
export default function TransmissionLoader({
  label = 'DECODING TRANSMISSION',
  reducedMotion = false,
  size = 'md',
  className = '',
}: TransmissionLoaderProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => setTick((t) => t + 1), DECODE_TICK_MS);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const bar = getDecodeBar(tick, reducedMotion);
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center gap-2 font-mono ${textSize} uppercase tracking-widest text-cyan-300 ${className}`}
    >
      <span className={`text-cyan-400 ${reducedMotion ? '' : 'animate-pulse'}`} aria-hidden="true">
        [{bar}]
      </span>
      <span>
        {label}
        {!reducedMotion && <span className="animate-pulse">_</span>}
      </span>
    </div>
  );
}
