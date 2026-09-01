'use client';

import { useState } from 'react';
import { Eye, KeyRound, Lock, Sparkles, CheckCircle2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { CipherDistrictKey, CipherDistrictProgressView, PlayerCipherProgressView } from '@/lib/types';

function statusLabel(status: CipherDistrictProgressView['status']): string {
  if (status === 'token_unlocked') return 'Sigil unlocked';
  if (status === 'ready_to_decode') return 'Ready to decode';
  if (status === 'in_progress') return 'Signal forming';
  return 'No signal';
}

interface DecodeSuccessData {
  districtKey: CipherDistrictKey;
  tokenLabel: string;
  sigilSymbol: string;
  decodedSentence: string;
  unlockedSigilCount?: number;
  allSigilsUnlocked?: boolean;
  hasAllThreeLocks?: boolean;
  masterCipherAvailable?: boolean;
}

interface CipherFragmentsPanelProps {
  progress?: PlayerCipherProgressView | null;
  eventSlug?: string;
  onDecodeSuccess?: (result?: DecodeSuccessData) => void;
}

export default function CipherFragmentsPanel({
  progress,
  eventSlug,
  onDecodeSuccess,
}: CipherFragmentsPanelProps) {
  const districts = progress?.districts || [];
  const [activeDecodingDistrict, setActiveDecodingDistrict] = useState<CipherDistrictKey | null>(null);
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodeSuccessMsg, setDecodeSuccessMsg] = useState<string | null>(null);

  if (districts.length === 0) return null;

  const currentDecodingDistrict = districts.find((d) => d.key === activeDecodingDistrict);

  function startDecoding(district: CipherDistrictProgressView) {
    // Initialize tile order with the collected fragments (or phrases/display names)
    const initialTiles = district.fragments
      .filter((f) => f.collected)
      .map((f) => f.displayName || f.key);
    setTileOrder(initialTiles);
    setDecodeError(null);
    setDecodeSuccessMsg(null);
    setActiveDecodingDistrict(district.key);
  }

  function moveTile(index: number, direction: 'left' | 'right') {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tileOrder.length) return;
    const next = [...tileOrder];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setTileOrder(next);
    setDecodeError(null);
  }

  async function handleDecodeSubmit() {
    if (!activeDecodingDistrict || !eventSlug || tileOrder.length !== 3) return;
    setIsSubmitting(true);
    setDecodeError(null);

    try {
      const response = await fetch('/api/game/cipher/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug,
          districtKey: activeDecodingDistrict,
          sequence: tileOrder,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setDecodeError(data.error || 'Incorrect fragment sequence. Rearrange the phrases and try again.');
        setIsSubmitting(false);
        return;
      }

      setDecodeSuccessMsg(
        `Sigil Unlocked! Decoded sentence: "${data.decodedSentence || ''}"`
      );
      if (onDecodeSuccess) {
        onDecodeSuccess(data);
      }
      setTimeout(() => {
        setActiveDecodingDistrict(null);
        setDecodeSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      setDecodeError(err?.message || 'Network error during decode.');
    } finally {
      setIsSubmitting(false);
    }
  }

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
          const readyToDecode = district.status === 'ready_to_decode';

          return (
            <article key={district.key} className="flex flex-col justify-between bg-[#06090b] p-4 sm:p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-white">{district.name}</h3>
                    <p
                      className={`mt-1 text-[11px] font-mono uppercase tracking-wider ${
                        unlocked
                          ? 'text-amber-300'
                          : readyToDecode
                          ? 'text-emerald-400 font-bold'
                          : 'text-cyan-300'
                      }`}
                    >
                      {statusLabel(district.status)}
                    </p>
                  </div>
                  <div
                    className={`grid h-10 w-10 place-items-center border ${
                      unlocked
                        ? 'border-amber-300 bg-amber-300/15 text-amber-200'
                        : readyToDecode
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 animate-pulse'
                        : 'border-stone-700 bg-black/35 text-stone-400'
                    }`}
                  >
                    {unlocked ? (
                      <KeyRound size={18} aria-hidden="true" />
                    ) : readyToDecode ? (
                      <Sparkles size={18} aria-hidden="true" />
                    ) : (
                      <Lock size={18} aria-hidden="true" />
                    )}
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded bg-stone-900">
                  <div
                    className={`h-full ${unlocked ? 'bg-amber-400' : readyToDecode ? 'bg-emerald-400' : 'bg-cyan-300'}`}
                    style={{
                      width: `${
                        district.requiredCount > 0
                          ? Math.min(100, Math.round((district.collectedCount / district.requiredCount) * 100))
                          : 0
                      }%`,
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
                        {fragment.collected ? (
                          <Eye size={16} aria-hidden="true" />
                        ) : (
                          <Sparkles size={16} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-xs text-white">
                          {fragment.collected ? fragment.displayName || fragment.obscuredLabel : fragment.obscuredLabel}
                        </strong>
                        <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
                          {fragment.collected
                            ? fragment.revealCopy || 'Fragment secured.'
                            : 'Unknown fragment'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {readyToDecode && eventSlug && (
                  <button
                    type="button"
                    onClick={() => startDecoding(district)}
                    className="w-full mb-3 flex items-center justify-center gap-2 border border-emerald-400/60 bg-emerald-500/20 px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/30 active:scale-[0.98]"
                  >
                    <span>ENTER DISTRICT DECODE</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}

                <div
                  className={`border p-3 font-mono ${
                    unlocked
                      ? 'border-amber-300/45 bg-amber-300/10'
                      : readyToDecode
                      ? 'border-emerald-400/40 bg-emerald-950/20'
                      : 'border-stone-800 bg-black/20'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-widest text-stone-400">
                    District Sigil & Record
                  </span>
                  <strong
                    className={`mt-1 block text-sm uppercase ${
                      unlocked ? 'text-amber-200' : readyToDecode ? 'text-emerald-300' : 'text-stone-500'
                    }`}
                  >
                    {unlocked
                      ? `${district.tokenLabel || 'Sigil'}: ${district.sigilSymbol || 'UNLOCKED'}`
                      : readyToDecode
                      ? '3 FRAGMENTS SECURED — READY TO DECODE'
                      : 'Sigil locked'}
                  </strong>
                  {unlocked && district.decodedSentence && (
                    <p className="mt-2 text-xs font-sans italic text-amber-100/90 border-t border-amber-300/20 pt-2">
                      &ldquo;{district.decodedSentence}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Decode Modal */}
      {activeDecodingDistrict && currentDecodingDistrict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg border border-cyan-400/40 bg-[#0c1216] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveDecodingDistrict(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-white"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-cyan-300">
              Manual District Decode · {currentDecodingDistrict.name}
            </span>
            <h3 className="mt-1 font-display text-xl font-black uppercase text-white">
              Sequence the Fragments
            </h3>
            <p className="mt-2 text-xs text-stone-300">
              Arrange the 3 recovered district phrase tiles in the correct grammatical sequence to unlock the district Sigil.
            </p>

            <div className="mt-5 space-y-3">
              {tileOrder.map((tileText, idx) => (
                <div
                  key={`${tileText}-${idx}`}
                  className="flex items-center justify-between border border-cyan-400/30 bg-black/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-cyan-950 font-mono text-xs font-bold text-cyan-300">
                      {idx + 1}
                    </span>
                    <strong className="font-mono text-sm uppercase text-white">{tileText}</strong>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveTile(idx, 'left')}
                      className="border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-mono text-stone-300 disabled:opacity-30"
                    >
                      ▲ UP
                    </button>
                    <button
                      type="button"
                      disabled={idx === tileOrder.length - 1}
                      onClick={() => moveTile(idx, 'right')}
                      className="border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-mono text-stone-300 disabled:opacity-30"
                    >
                      ▼ DOWN
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {decodeError && (
              <div className="mt-4 flex items-center gap-2 border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{decodeError}</span>
              </div>
            )}

            {decodeSuccessMsg && (
              <div className="mt-4 flex items-center gap-2 border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>{decodeSuccessMsg}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveDecodingDistrict(null)}
                className="border border-stone-700 bg-stone-900/60 px-4 py-2 font-mono text-xs font-bold uppercase text-stone-300 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !!decodeSuccessMsg}
                onClick={handleDecodeSubmit}
                className="flex items-center gap-2 border border-emerald-400 bg-emerald-500/25 px-5 py-2 font-mono text-xs font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/40 disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'VERIFY & DECODE'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

