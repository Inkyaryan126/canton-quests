import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { COMMANDER_TRANSMISSIONS } from '@/lib/commander-transmissions';
import { Play, Radio } from 'lucide-react';

export default function TransmissionArchivePage({ params }: { params: { slug: string } }) {
  const isFounderCipher = isKnownCantonLaunchSlug(params.slug);

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
                  Every recorded briefing from the Game Commander — {COMMANDER_TRANSMISSIONS.length} transmissions on file.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {COMMANDER_TRANSMISSIONS.map((t) => (
                <Link
                  key={t.id}
                  href={`/events/${params.slug}/transmissions/${t.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-amber-500/25 bg-stone-900 shadow-xl hover:border-amber-400/60 transition-colors"
                >
                  <div className="relative aspect-[9/16] bg-black">
                    <Image
                      src={t.posterUrl}
                      alt={t.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
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

            <div className="text-center mt-10">
              <Link
                href={`/events/${params.slug}`}
                className="cq-dark-button text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
              >
                RETURN TO OPERATION
              </Link>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl px-4 py-16 text-center space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Transmission Archive</span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              No Archive For This Operation
            </h1>
            <p className="text-sm text-stone-300 font-body leading-relaxed">
              This Operation doesn&apos;t have a Commander transmission archive yet.
            </p>
            <Link
              href={`/events/${params.slug}`}
              className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6"
            >
              RETURN TO OPERATION
            </Link>
          </div>
        )}
      </main>
      <CinematicFooter />
    </div>
  );
}
