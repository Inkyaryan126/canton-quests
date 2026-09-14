import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Map, Network, Radio, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'The Grid — Building Canton City #001',
  description: 'Follow the build of The Grid: a persistent real-city game engine beginning with Canton, Ohio.',
};

const milestones = [
  ['01', 'FOUNDATION', 'Feature flags, architecture boundaries, and city-agnostic core are in place.'],
  ['02', 'CITY CONTRACTS', 'Reusable city-package contracts separate the engine from any one city.'],
  ['03', 'MULTI-CITY CORE', 'City registry, PostGIS foundation, event ledger, and deterministic simulation are built.'],
  ['04', 'CITY COMPILER', 'Deterministic geometry normalization, adjacency, validation, provenance, and package compilation are built.'],
  ['05', 'REAL CANTON DATA', 'Official Census geography and OpenStreetMap public-place data replaced synthetic geography for Canton.'],
  ['06', 'CANTON PACKAGE', 'A real downtown Canton package compiles deterministically from sourced geography with validation and provenance.'],
  ['07', 'IMPORT BOUNDARY', 'A local Supabase import boundary exists so compiled cities can move into the runtime safely.'],
  ['08', 'ACCEPTANCE GATE', 'Compiler 1–9 passed the full Grid test suite, CLI validation, architecture boundary scan, lint, and production build.'],
  ['09', 'LIVE WORLD', 'Next: turn compiled Canton geography into the first visible, playable Grid world.'],
] as const;

export default function GridBuildPage() {
  return (
    <main className="min-h-screen bg-[#06090d] text-white overflow-hidden">
      <div className="pointer-events-none fixed inset-0 opacity-30" aria-hidden="true"
        style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />

      <section className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono font-bold text-stone-400 hover:text-cyan-300 transition-colors">
          <ArrowLeft size={14} /> BACK TO CANTON QUESTS
        </Link>

        <div className="mt-14 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 font-mono text-xs font-bold tracking-[.18em] text-cyan-300">
            <Radio size={13} className="animate-pulse" /> BUILD SIGNAL ACTIVE
          </div>
          <p className="mt-6 font-mono text-xs font-bold tracking-[.28em] text-amber-300">CANTON, OHIO // CITY 001</p>
          <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[.88] tracking-tight sm:text-7xl lg:text-8xl">
            THE GRID
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-300 sm:text-xl">
            Canton Quests proved the city can be the game board. The Grid is the next layer: a persistent city-scale game engine built from real geography, real places, territory systems, events, and player decisions — designed to expand city by city.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['COMPILER', '1–9 ACCEPTED', 'City Compiler phase'],
            ['CITY', 'CANTON #001', 'First real package'],
            ['GEOGRAPHY', 'SOURCE-BACKED', 'Census + OpenStreetMap'],
            ['GAMEPLAY', 'LOCKED', 'Until world systems are ready'],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 backdrop-blur-sm">
              <div className="font-mono text-[10px] font-bold tracking-[.2em] text-stone-500">{label}</div>
              <div className="mt-2 font-display text-xl font-black text-white">{value}</div>
              <div className="mt-1 text-xs text-stone-400">{note}</div>
            </div>
          ))}
        </div>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="flex items-center gap-3">
              <Network size={20} className="text-cyan-300" />
              <h2 className="font-display text-2xl font-black uppercase">Build Pipeline</h2>
            </div>
            <div className="mt-6 space-y-3">
              {milestones.map(([number, title, copy], index) => (
                <article key={number} className="grid grid-cols-[48px_1fr] gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
                  <div className="font-mono text-sm font-black text-cyan-300">{number}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-black tracking-wide">{title}</h3>
                      {index < 7 ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Radio size={14} className="text-amber-300 animate-pulse" />}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-stone-400">{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-cyan-400/25 bg-cyan-400/[.055] p-6 sm:p-7">
              <Map size={26} className="text-cyan-300" />
              <h2 className="mt-4 font-display text-2xl font-black uppercase">Real Canton, Not Placeholder Geometry</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-300">
                The build now uses official Canton municipal geometry and real downtown source data. A separate road-network pass clipped Census roads to the actual city boundary before they can influence the compiler.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3"><dt className="text-stone-500">CLIPPED ROAD FEATURES</dt><dd className="mt-1 text-lg font-black text-white">2,330</dd></div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3"><dt className="text-stone-500">BOUNDARY VIOLATIONS</dt><dd className="mt-1 text-lg font-black text-emerald-300">0</dd></div>
              </dl>
            </article>

            <article className="rounded-3xl border border-amber-400/25 bg-amber-400/[.055] p-6 sm:p-7">
              <ShieldCheck size={26} className="text-amber-300" />
              <h2 className="mt-4 font-display text-2xl font-black uppercase">Build Rule</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-300">
                No invented Canton geography gets promoted just to make the map look finished. Source provenance, validation, privacy classification, and deterministic output are part of the compiler itself.
              </p>
            </article>

            <Link href="/#operations" className="cq-gold-button inline-flex w-full items-center justify-center gap-2 py-4 font-mono text-xs">
              PLAY CANTON QUESTS NOW <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <footer className="mt-20 border-t border-white/10 py-8 text-center font-mono text-[11px] tracking-[.14em] text-stone-600">
          THE GRID // CANTON CITY 001 // BUILDING IN PUBLIC
        </footer>
      </section>
    </main>
  );
}
