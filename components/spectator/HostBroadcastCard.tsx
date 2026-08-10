'use client';

import { HostBroadcast } from '@/lib/types';

interface HostBroadcastCardProps {
  broadcasts: HostBroadcast[];
}

export default function HostBroadcastCard({ broadcasts }: HostBroadcastCardProps) {
  if (!broadcasts || broadcasts.length === 0) {
    return null;
  }

  // Active published broadcasts
  const activeBroadcasts = broadcasts.filter((b) => b.isPublished !== false);
  if (activeBroadcasts.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeBroadcasts.map((broadcast) => {
        const tone = broadcast.tone || 'theatrical';

        const themeMap = {
          urgent: {
            bg: 'bg-red-950/80 border-red-500/70 text-red-100 shadow-red-900/30',
            badgeBg: 'bg-red-500 text-black',
            icon: '🚨',
            title: 'URGENT HOST BROADCAST',
          },
          flash: {
            bg: 'bg-cyan-950/80 border-cyan-400/70 text-cyan-100 shadow-cyan-900/30',
            badgeBg: 'bg-cyan-400 text-black',
            icon: '⚡',
            title: 'FLASH INTEL BROADCAST',
          },
          announcement: {
            bg: 'bg-emerald-950/80 border-emerald-500/70 text-emerald-100 shadow-emerald-900/30',
            badgeBg: 'bg-emerald-500 text-black',
            icon: '📢',
            title: 'GAME DIRECTORS ANNOUNCEMENT',
          },
          theatrical: {
            bg: 'bg-gradient-to-r from-purple-950/90 via-amber-950/80 to-obsidian border-amber-500/60 text-amber-100 shadow-amber-900/20',
            badgeBg: 'bg-amber-400 text-black',
            icon: '👑',
            title: 'THEATRICAL HOST BROADCAST',
          },
        };

        const theme = themeMap[tone] || themeMap.theatrical;

        return (
          <div
            key={broadcast.id}
            className={`p-4 md:p-5 rounded-2xl border-2 backdrop-blur-md shadow-lg space-y-2 relative overflow-hidden transition-all ${theme.bg}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded font-mono ${theme.badgeBg}`}>
                  {theme.icon} {theme.title}
                </span>
                <span className="text-[10px] font-mono text-gray-300">
                  PUBLIC AIRWAVES
                </span>
              </div>
              {broadcast.publishedAt && (
                <span className="text-[10px] font-mono text-gray-400">
                  {new Date(broadcast.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-base md:text-lg text-white tracking-tight leading-snug">
                {broadcast.headline}
              </h3>
              <p className="text-xs text-gray-200 leading-relaxed">
                {broadcast.body}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
