'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ArrowRight, Radio } from 'lucide-react';
import { CommanderTextMoment } from '@/lib/game-effects';
import { getPathTone } from '@/lib/path-tone';
import { cqSoundManager } from '@/lib/audio';

interface CommanderTextTransmissionProps {
  moment: CommanderTextMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

/**
 * Canton Quests — text-based Commander transmission, rendered over the
 * master transmission template artwork
 * (public/canton-quests/Commander_transmission_template.png). The PNG is
 * the canonical visual frame — it is NEVER regenerated per message; only
 * the dynamic HTML text layered inside its blank message field changes.
 *
 * Coordinates below are pixel-measured percentages of the template's own
 * 1086×1448 artwork (message-box interior: x 56–1020, y 529–1340), inset a
 * further ~2.5–3% on every side to clear the box's chamfered corners and
 * give the type real breathing room from the border line itself.
 *
 * Sibling to CommanderTransmissionEffect.tsx (video/photo) — same overlay
 * conventions (full-viewport backdrop, Continue-to-advance, ESC works via
 * GameMomentOverlay), same underlying GameMomentManager queue. Reused for
 * every 'commander-text' moment regardless of which Founder's Cipher
 * message triggered it — see lib/gameplay/founders-cipher/ for the
 * canonical copy this renders.
 */
const TEMPLATE_SRC = '/canton-quests/Commander_transmission_template.png';
const TEMPLATE_ASPECT = '1086 / 1448';
const MESSAGE_AREA = { left: '8%', top: '39%', width: '83%', height: '51%' } as const;

const SIZE_BODY_CLASS: Record<CommanderTextMoment['size'], string> = {
  short: 'text-base sm:text-lg leading-relaxed',
  medium: 'text-sm sm:text-base leading-relaxed',
  long: 'text-xs sm:text-sm leading-relaxed',
};

export default function CommanderTextTransmission({ moment, onDismiss, reducedMotion = false }: CommanderTextTransmissionProps) {
  const { title, body, size, cta, path } = moment;
  const tone = getPathTone(path);
  const hasAdvancedRef = useRef(false);
  const accentColor = tone?.color || '#f0c978';

  useEffect(() => {
    cqSoundManager.play('transmission');
  }, []);

  useEffect(() => {
    hasAdvancedRef.current = false;
  }, [moment.id]);

  const handleContinue = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    moment.onContinue?.();
    onDismiss();
  };

  // Long-form paragraphs are authored as a single string with blank-line
  // breaks — split for real <p> spacing rather than relying on CSS
  // white-space tricks that fight the scroll container.
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
      aria-label="Commander transmission"
    >
      <div className="relative z-10 w-full max-w-sm max-h-[92vh] flex flex-col items-center gap-3">
        <div className="relative w-full" style={{ aspectRatio: TEMPLATE_ASPECT }}>
          <Image
            src={TEMPLATE_SRC}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 92vw, 384px"
            className="object-contain select-none pointer-events-none"
            aria-hidden="true"
          />

          {/* Dynamic text, layered into the template's blank message field. */}
          <div
            className="absolute overflow-y-auto"
            style={{ left: MESSAGE_AREA.left, top: MESSAGE_AREA.top, width: MESSAGE_AREA.width, height: MESSAGE_AREA.height }}
          >
            <div className="min-h-full flex flex-col justify-center gap-2.5 px-3 py-2 text-center">
              {title && (
                <span
                  className="text-[11px] sm:text-xs font-mono font-black uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  {title}
                </span>
              )}
              <div className={`text-stone-100 font-body space-y-2.5 ${SIZE_BODY_CLASS[size]}`}>
                {paragraphs.length > 1
                  ? paragraphs.map((para, i) => <p key={i}>{para}</p>)
                  : <p>{body}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Controls — deliberately below the artwork, never overlapping the template's own footer graphic. */}
        <div className="w-full flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110 min-h-[48px]"
          >
            <span>{cta || 'CONTINUE'}</span>
            <ArrowRight size={17} />
          </button>
          {size === 'long' && (
            <span className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
              <Radio size={11} className={reducedMotion ? '' : 'animate-pulse'} />
              Scroll for full transmission
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
