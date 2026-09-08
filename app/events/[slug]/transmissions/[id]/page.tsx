'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { getAdjacentTransmissionIds } from '@/lib/commander-transmissions';
import { sanitizeInternalPath, getReturnLabelForPath } from '@/lib/safe-internal-path';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Radio } from 'lucide-react';
import TransmissionLoader from '@/components/game-effects/TransmissionLoader';
import TransmissionPanel from '@/components/game-effects/TransmissionPanel';
import CqTransition from '@/components/game-effects/CqTransition';
import { useReducedMotion } from '@/lib/motion';

interface UnlockedTransmission {
  id: number;
  order: number;
  title: string;
  videoUrl: string;
  posterUrl: string;
}

type LoadState = 'loading' | 'unlocked' | 'locked';

function TransmissionPlayerPageContent({ params }: { params: { slug: string; id: string } }) {
  const isFounderCipher = isKnownCantonLaunchSlug(params.slug);
  const id = Number.parseInt(params.id, 10);
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();

  const archivePath = `/events/${params.slug}/transmissions`;
  // Only ever a validated, same-app relative path — never trust an
  // arbitrary/external `returnTo` value (no open redirect). Falls back to
  // the archive (this page's natural parent) when missing or invalid.
  const returnTo = sanitizeInternalPath(searchParams.get('returnTo'), archivePath);
  const returnLabel = getReturnLabelForPath(returnTo);
  const returnQuery = `?returnTo=${encodeURIComponent(returnTo)}`;

  const [state, setState] = useState<LoadState>('loading');
  const [transmission, setTransmission] = useState<UnlockedTransmission | null>(null);
  const [revealPhase, setRevealPhase] = useState<'decoding' | 'revealed'>('decoding');

  useEffect(() => {
    if (!isFounderCipher || Number.isNaN(id)) {
      setState('locked');
      return;
    }
    let cancelled = false;
    fetch(`/api/game/transmissions?eventSlug=${encodeURIComponent(params.slug)}&id=${id}`)
      .then((res) => res.json())
      .then((data: { unlocked: boolean; transmission?: UnlockedTransmission }) => {
        if (cancelled) return;
        if (data.unlocked && data.transmission) {
          setTransmission(data.transmission);
          setState('unlocked');
        } else {
          setState('locked');
        }
      })
      .catch(() => {
        if (!cancelled) setState('locked');
      });
    return () => {
      cancelled = true;
    };
  }, [isFounderCipher, params.slug, id]);

  useEffect(() => {
    if (state !== 'unlocked') return;
    setRevealPhase('decoding');
    const delay = reducedMotion ? 0 : 450;
    if (delay === 0) {
      setRevealPhase('revealed');
      return;
    }
    const timer = setTimeout(() => setRevealPhase('revealed'), delay);
    return () => clearTimeout(timer);
  }, [state, transmission?.id, reducedMotion]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={params.slug} />
        <main className="flex-1 flex justify-center items-center px-4 py-16">
          <TransmissionLoader label="ACQUIRING SIGNAL" reducedMotion={reducedMotion} />
        </main>
        <CinematicFooter />
      </div>
    );
  }

  if (state === 'locked' || !transmission) {
    // Same safe-state card whether the id doesn't exist at all or the
    // player simply hasn't reached this transmission's moment yet — never
    // reveals which case it is, and never sends a locked video's real URL.
    const isValidId = !Number.isNaN(id) && id >= 1 && id <= 15;
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={params.slug} />
        <main className="flex-1 flex justify-center items-center px-4 py-16 text-center">
          <div className="w-full max-w-lg">
            <TransmissionPanel
              eyebrow={isValidId ? 'SIGNAL NOT RECEIVED' : 'TRANSMISSION NOT FOUND'}
              icon={Lock}
              tone="stone"
              accentClassName="text-stone-400"
              className="p-8 text-center space-y-4"
            >
              <h1 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
                {isValidId ? 'SIGNAL NOT RECEIVED' : 'TRANSMISSION NOT FOUND'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                {isValidId
                  ? "This transmission hasn't reached you yet — keep playing and it'll unlock in the archive."
                  : "That transmission doesn't exist in this Mission's archive."}
              </p>
              <div className="pt-2">
                <Link
                  href={returnTo}
                  className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={15} />
                  {returnLabel}
                </Link>
              </div>
            </TransmissionPanel>
          </div>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  const { prevId, nextId } = getAdjacentTransmissionIds(transmission.id);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
      <Header eventSlug={params.slug} />
      {/* Centered via flex, not mx-auto — a sitewide `* { margin: 0 }` reset
          in globals.css sits outside any @layer, so it beats Tailwind's
          layered `.mx-auto` in the cascade regardless of specificity. This
          is a pre-existing issue (also reproduces on e.g. /privacy) — see
          the mission report; flexbox centering sidesteps it locally without
          touching the global reset. */}
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-3xl px-4 py-10 sm:py-14 flex flex-col items-center relative">
          <CqTransition show={revealPhase === 'revealed'} reducedMotion={reducedMotion} className="w-full flex flex-col items-center">
            <div className="text-center mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                <Radio size={14} className="text-amber-400 animate-pulse" />
                <span>TRANSMISSION {String(transmission.id).padStart(2, '0')}</span>
              </div>
              <h1 className="font-display font-black text-xl sm:text-3xl text-white uppercase tracking-tight">
                {transmission.title}
              </h1>
            </div>

            {/* Portrait video frame — intentionally constrained, never stretched */}
            <div className="w-full max-w-[380px]">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-black shadow-2xl shadow-black/60 aspect-[9/16]">
                <video
                  key={transmission.id}
                  src={transmission.videoUrl}
                  poster={transmission.posterUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                >
                  Your browser does not support high-definition video playback.
                </video>
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/70 border border-amber-500/40 text-amber-300">
                    CQ-{String(transmission.id).padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>

            {/* Prev / Next — carries the same return context forward so
                browsing adjacent transmissions never loses where the player
                originally came from. */}
            <div className="flex items-center justify-between w-full max-w-[380px] mt-4 text-xs font-mono">
              {prevId ? (
                <Link
                  href={`/events/${params.slug}/transmissions/${prevId}${returnQuery}`}
                  className="cq-dark-button py-2 px-3 inline-flex items-center gap-1.5"
                >
                  <ChevronLeft size={14} />
                  PREV
                </Link>
              ) : (
                <span className="py-2 px-3 text-stone-600">—</span>
              )}
              {nextId ? (
                <Link
                  href={`/events/${params.slug}/transmissions/${nextId}${returnQuery}`}
                  className="cq-dark-button py-2 px-3 inline-flex items-center gap-1.5"
                >
                  NEXT
                  <ChevronRight size={14} />
                </Link>
              ) : (
                <span className="py-2 px-3 text-stone-600">—</span>
              )}
            </div>

            {/* Smart return — one truthful control, not a competing pair of
                generic "Return to Archive / Return to Mission" buttons. Goes
                back to wherever the player actually opened this transmission
                from (validated same-app path), falling back to the archive. */}
            <div className="flex items-center justify-center mt-10">
              <Link
                href={returnTo}
                className="cq-gold-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft size={15} />
                {returnLabel}
              </Link>
            </div>
          </CqTransition>

          {revealPhase === 'decoding' && (
            <div className="absolute inset-0 flex items-center justify-center py-20">
              <TransmissionLoader label="DECODING TRANSMISSION" reducedMotion={reducedMotion} />
            </div>
          )}
        </div>
      </main>
      <CinematicFooter />
    </div>
  );
}

export default function TransmissionPlayerPage({ params }: { params: { slug: string; id: string } }) {
  return (
    <Suspense fallback={null}>
      <TransmissionPlayerPageContent params={params} />
    </Suspense>
  );
}
