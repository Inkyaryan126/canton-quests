'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { getAdjacentTransmissionIds } from '@/lib/commander-transmissions';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Lock, Radio } from 'lucide-react';

interface UnlockedTransmission {
  id: number;
  order: number;
  title: string;
  videoUrl: string;
  posterUrl: string;
}

type LoadState = 'loading' | 'unlocked' | 'locked';

export default function TransmissionPlayerPage({ params }: { params: { slug: string; id: string } }) {
  const isFounderCipher = isKnownCantonLaunchSlug(params.slug);
  const id = Number.parseInt(params.id, 10);

  const [state, setState] = useState<LoadState>('loading');
  const [transmission, setTransmission] = useState<UnlockedTransmission | null>(null);

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

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={params.slug} />
        <main className="flex-1 flex justify-center items-center px-4 py-16">
          <p className="text-xs font-mono text-stone-500 uppercase tracking-widest">Checking signal...</p>
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
          <div className="w-full max-w-lg p-8 rounded-3xl border border-stone-800 bg-stone-900/80 shadow-2xl space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-stone-800/80 flex items-center justify-center text-stone-500">
              <Lock size={24} />
            </div>
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
                href={`/events/${params.slug}/transmissions`}
                className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
              >
                BACK TO ARCHIVE
              </Link>
            </div>
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
        <div className="w-full max-w-3xl px-4 py-10 sm:py-14 flex flex-col items-center">
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
              <Radio size={14} className="text-amber-400 animate-pulse" />
              <span>TRANSMISSION {String(transmission.id).padStart(2, '0')} OF 15</span>
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

          {/* Prev / Next */}
          <div className="flex items-center justify-between w-full max-w-[380px] mt-4 text-xs font-mono">
            {prevId ? (
              <Link
                href={`/events/${params.slug}/transmissions/${prevId}`}
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
                href={`/events/${params.slug}/transmissions/${nextId}`}
                className="cq-dark-button py-2 px-3 inline-flex items-center gap-1.5"
              >
                NEXT
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="py-2 px-3 text-stone-600">—</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link
              href={`/events/${params.slug}/transmissions`}
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft size={15} />
              BACK TO ARCHIVE
            </Link>
            <Link
              href={`/events/${params.slug}`}
              className="cq-gold-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              RETURN TO MISSION
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>
      <CinematicFooter />
    </div>
  );
}
