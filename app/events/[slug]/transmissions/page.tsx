'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { Play, Radio, Satellite, FileText } from 'lucide-react';
import { showGameMoment } from '@/lib/game-effects';
import { getFounderCipherMessageLog, LoggedFounderCipherMessage } from '@/lib/gameplay/founders-cipher/message-log';

// Only ever contains transmissions already revealed to this player — the
// API never returns a not-yet-unlocked entry at all (see
// app/api/game/transmissions/route.ts), so there is no `unlocked` flag or
// locked-placeholder state to render here.
interface ArchiveEntry {
  id: number;
  order: number;
  title: string;
  posterUrl: string;
}

function getClientPlayerId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem('canton_quests_current_player');
    return stored ? (JSON.parse(stored)?.id as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

export default function TransmissionArchivePage({ params }: { params: { slug: string } }) {
  const isFounderCipher = isKnownCantonLaunchSlug(params.slug);
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [fieldLog, setFieldLog] = useState<LoggedFounderCipherMessage[]>([]);

  useEffect(() => {
    if (!isFounderCipher) return;
    let cancelled = false;
    fetch(`/api/game/transmissions?eventSlug=${encodeURIComponent(params.slug)}`)
      .then((res) => res.json())
      .then((data: { transmissions?: ArchiveEntry[] }) => {
        if (!cancelled) setEntries(data.transmissions || []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isFounderCipher, params.slug]);

  // FIELD LOG — recovers Commander Text Transmissions the player may have
  // closed before reading in full. Client-side only (see
  // lib/gameplay/founders-cipher/message-log.ts); reuses this same archive
  // page rather than a second Transmissions surface.
  useEffect(() => {
    if (!isFounderCipher) return;
    setFieldLog(getFounderCipherMessageLog(getClientPlayerId()));
  }, [isFounderCipher]);

  const reopenLoggedMessage = (entry: LoggedFounderCipherMessage) => {
    showGameMoment({
      type: 'commander-text',
      title: entry.title,
      body: entry.body,
      size: entry.size,
      path: entry.path,
      cta: entry.cta,
      messageId: entry.id,
    });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
      <Header eventSlug={params.slug} />
      {/* Centered via flex, not mx-auto — see the mission report: a sitewide
          `* { margin: 0 }` reset in globals.css is unlayered and beats
          Tailwind's layered `.mx-auto` regardless of specificity. */}
      <main className="flex-1 flex justify-center">
        {isFounderCipher ? (
          <div className="w-full max-w-5xl px-4 py-14">
            <div className="flex justify-center mb-10">
              <div className="text-center max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <Radio size={14} className="text-amber-400 animate-pulse" />
                  <span>FOUNDER&apos;S CIPHER ARCHIVE</span>
                </div>
                <h1 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
                  Commander Transmissions
                </h1>
                <p className="text-sm text-stone-400 font-body">
                  Every briefing the Commander has sent you, in order.
                </p>
              </div>
            </div>

            {entries === null ? (
              <p className="text-center text-xs font-mono text-stone-500 uppercase tracking-widest">Loading archive...</p>
            ) : entries.length === 0 ? (
              <div className="max-w-md mx-auto text-center space-y-3 py-10">
                <Satellite size={28} className="mx-auto text-stone-600" />
                <h2 className="font-display font-black text-lg text-white uppercase tracking-tight">
                  No Transmissions Received
                </h2>
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  Monitor the Mission. New Commander transmissions will appear here after they are delivered.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {entries.map((t) => (
                  <Link
                    key={t.id}
                    href={`/events/${params.slug}/transmissions/${t.id}?returnTo=${encodeURIComponent(`/events/${params.slug}/transmissions`)}`}
                    className="group relative rounded-2xl overflow-hidden border border-amber-500/25 bg-stone-900 shadow-xl hover:border-amber-400/60 transition-colors"
                  >
                    <div className="relative aspect-[9/16] bg-black">
                      {t.posterUrl && (
                        <Image
                          src={t.posterUrl}
                          alt={t.title || `Transmission ${t.id}`}
                          fill
                          loading="lazy"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                          className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-lg">
                          <Play size={18} className="fill-black ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/70 border border-amber-500/40 text-amber-300">
                        {String(t.id).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-300 line-clamp-2">
                        {t.title}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {fieldLog.length > 0 && (
              <div className="mt-14 pt-10 border-t border-stone-800">
                <div className="flex justify-center mb-6">
                  <div className="text-center max-w-2xl space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
                      <FileText size={13} />
                      <span>FIELD LOG</span>
                    </div>
                    <p className="text-xs text-stone-500 font-body">
                      Commander field messages you may have closed before reading in full — tap to reopen.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
                  {fieldLog.map((entry, i) => (
                    <button
                      key={`${entry.id}-${entry.loggedAt}-${i}`}
                      type="button"
                      onClick={() => reopenLoggedMessage(entry)}
                      className="text-left rounded-xl border border-stone-800 bg-stone-900/70 hover:border-cyan-500/50 transition-colors p-3.5"
                    >
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                        {entry.title}
                      </span>
                      <p className="text-xs text-stone-400 mt-1 line-clamp-2">{entry.body}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center mt-10">
              <Link
                href={`/events/${params.slug}`}
                className="cq-dark-button text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
              >
                RETURN TO MISSION
              </Link>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl px-4 py-16 text-center space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Transmission Archive</span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              No Archive For This Mission
            </h1>
            <p className="text-sm text-stone-300 font-body leading-relaxed">
              This Mission doesn&apos;t have a Commander transmission archive yet.
            </p>
            <Link
              href={`/events/${params.slug}`}
              className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6"
            >
              RETURN TO MISSION
            </Link>
          </div>
        )}
      </main>
      <CinematicFooter />
    </div>
  );
}
