import Link from 'next/link';
import { Eye, HelpCircle, ListChecks, Trophy, Gift } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';

export default function CinematicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-amber-500/20 bg-stone-950 text-stone-300 py-10 px-4 sm:px-8">

      <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand Lockup */}
        <div className="flex items-center gap-4 text-center md:text-left">
          <CantonQuestsLogo variant="mark" size={44} alt="Canton Quests official emblem" className="shrink-0" />
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="font-display font-black text-white text-base tracking-tight">CANTON QUESTS</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                VOL 1
              </span>
            </div>
            <p className="text-xs text-stone-400 font-mono mt-0.5">
              Pick a quest. Explore Canton. Earn XP. Win transparent prizes.
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-mono">
          <Link href="/quests" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <ListChecks size={14} aria-hidden="true" />
            Quests
          </Link>
          <Link href="/leaderboard" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Trophy size={14} aria-hidden="true" />
            Leaderboard
          </Link>
          <Link href="/how-it-works" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <HelpCircle size={14} aria-hidden="true" />
            How It Works
          </Link>
          <Link href="/events/canton-weekend-1/drawing" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Gift size={14} aria-hidden="true" />
            Prize Ledger
          </Link>
          <Link href="/watch" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Eye size={14} aria-hidden="true" />
            Watch Live
          </Link>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto mt-8 pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-stone-500">
        <span>SIGNAL ACTIVE • OFFICIAL LAUNCH SEPTEMBER 11, 2026</span>
        <span>ONE LEADERBOARD • 100% OPEN CITY GRID</span>
      </div>
    </footer>
  );
}
