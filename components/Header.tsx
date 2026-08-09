'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[#0b0f17]/90 backdrop-blur-md px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group text-decoration-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-obsidian font-extrabold text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            ⚡
          </div>
          <div>
            <span className="font-display font-extrabold text-lg text-white tracking-tight leading-none block">
              CANTON <span className="text-amber-400">QUESTS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 tracking-wider block uppercase">
              Field Operations • Canton, OH
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px] font-mono text-gray-300 hover:text-white"
          >
            🕹️ Game Master
          </Link>
        </div>
      </div>
    </header>
  );
}
