import Link from 'next/link';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[#0b0f17]/90 backdrop-blur-md px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group text-decoration-none" aria-label="Canton Quests home">
          <CantonQuestsLogo
            variant="mark"
            size={38}
            priority
            className="rounded-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0"
          />
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
            href="/watch"
            className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px] font-mono font-bold flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            📺 WATCH LIVE
          </Link>
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
