'use client';

import { Eye, KeyRound, Lock, Sparkles } from 'lucide-react';
import { CipherDistrictProgressView, PlayerCipherProgressView } from '@/lib/types';

function statusLabel(status: CipherDistrictProgressView['status']): string {
  if (status === 'token_unlocked') return 'Sigil unlocked';
  if (status === 'ready_to_decode') return 'Ready to decode';
  if (status === 'in_progress') return 'Signal forming';
  return 'No signal';
}

export default function CipherFragmentsPanel({ progress }: { progress?: PlayerCipherProgressView | null }) {
  const districts = progress?.districts || [];
  if (districts.length === 0) return null;

  return (
    <section className="mb-6 border border-cyan-400/25 bg-[#06090b] shadow-2xl shadow-black/35">
      <div className="border-b border-cyan-400/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-[0.22em] text-cyan-300">
              Founder Cipher
            </span>
            <h2 className="mt-1 font-display text-2xl font-black uppercase text-white">
              District Fragments
            </h2>
          </div>
          <div className="rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-right font-mono">
            <span className="block text-[10px] uppercase tracking-widest text-amber-200">Collected</span>
            <strong className="text-lg text-amber-300">
              {progress?.totalCollected || 0}/{progress?.totalRequired || 0}
            </strong>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-cyan-400/15 md:grid-cols-3">
        {districts.map((district) => {
          const unlocked = district.status === 'token_unlocked';
          return (
            <article key={district.key} className="bg-[#06090b] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white">{district.name}</h3>
                  <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-cyan-300">
                    {statusLabel(district.status)}
                  </p>
                </div>
                <div className={`grid h-10 w-10 place-items-center border ${unlocked ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-stone-700 bg-black/35 text-stone-400'}`}>
                  {unlocked ? <KeyRound size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded bg-stone-900">
                <div
                  className="h-full bg-cyan-300"
                  style={{
                    width: `${district.requiredCount > 0 ? Math.min(100, Math.round((district.collectedCount / district.requiredCount) * 100)) : 0}%`,
                  }}
                />
              </div>

              <div className="mt-4 space-y-2">
                {district.fragments.map((fragment) => (
                  <div
                    key={fragment.key}
                    className={`flex min-h-12 items-start gap-3 border p-3 ${
                      fragment.collected
                        ? 'border-cyan-300/35 bg-cyan-300/10'
                        : 'border-stone-800 bg-black/25 text-stone-500'
                    }`}
                  >
                    <span className="mt-0.5 text-cyan-200">
                      {fragment.collected ? <Eye size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-xs text-white">
                        {fragment.collected ? fragment.displayName : fragment.obscuredLabel}
                      </strong>
                      <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
                        {fragment.collected ? fragment.revealCopy || 'Fragment secured.' : 'Unknown fragment'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className={`mt-4 border p-3 font-mono ${unlocked ? 'border-amber-300/45 bg-amber-300/10' : 'border-stone-800 bg-black/20'}`}>
                <span className="block text-[10px] uppercase tracking-widest text-stone-400">District Decode</span>
                <strong className={`mt-1 block text-sm uppercase ${unlocked ? 'text-amber-200' : 'text-stone-500'}`}>
                  {unlocked ? `${district.tokenLabel}: ${district.sigilSymbol}` : 'Sigil locked'}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
