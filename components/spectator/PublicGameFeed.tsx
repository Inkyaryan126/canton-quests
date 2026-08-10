'use client';

import { useState } from 'react';
import { PublicGameFeedItem } from '@/lib/types';

interface PublicGameFeedProps {
  feed: PublicGameFeedItem[];
}

export default function PublicGameFeed({ feed }: PublicGameFeedProps) {
  const [filter, setFilter] = useState<'all' | 'host' | 'quests'>('all');

  const filteredFeed = feed.filter((item) => {
    if (filter === 'host') return item.isHost || item.feedType === 'host_broadcast';
    if (filter === 'quests') return item.feedType === 'quest_completion' || item.feedType === 'flash_quest';
    return true;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <span className="badge bg-red-950/80 border-red-500/60 text-red-300 text-[10px] font-mono font-bold">🚨 URGENT</span>;
      case 'flash':
        return <span className="badge bg-cyan-950/80 border-cyan-500/60 text-cyan-300 text-[10px] font-mono font-bold">⚡ FLASH</span>;
      case 'warning':
        return <span className="badge bg-amber-950/80 border-amber-500/60 text-amber-300 text-[10px] font-mono font-bold">⚠️ NOTICE</span>;
      case 'info':
      default:
        return <span className="badge bg-gray-800 border-gray-700 text-gray-300 text-[10px] font-mono">ℹ️ INTEL</span>;
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>📡 Live Public Field Feed</span>
            <span className="text-xs font-mono text-cyan-400 font-normal">
              • 2-Min Delay Safety Buffer
            </span>
          </h2>
          <p className="text-[11px] text-gray-400">
            Sanitized public broadcast of Canton Quests activity. Exact agent locations are strictly confidential.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-obsidian p-1 rounded-xl border border-gray-800 text-[11px] font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-obsidian'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ALL INTEL
          </button>
          <button
            onClick={() => setFilter('host')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filter === 'host'
                ? 'bg-amber-500 text-obsidian'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            HOST
          </button>
          <button
            onClick={() => setFilter('quests')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filter === 'quests'
                ? 'bg-amber-500 text-obsidian'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            QUESTS
          </button>
        </div>
      </div>

      {/* Feed Items List */}
      {filteredFeed.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <div className="text-2xl text-gray-600">📻</div>
          <p className="text-xs text-gray-400 font-mono">
            No public feed items match the selected filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredFeed.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all ${
                item.isHost
                  ? 'border-amber-500/40 bg-amber-950/20'
                  : item.urgency === 'flash'
                  ? 'border-cyan-500/30 bg-cyan-950/10'
                  : 'border-gray-800 bg-obsidian/70 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {getUrgencyBadge(item.urgency)}
                  {item.districtName && (
                    <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded">
                      📍 {item.districtName}
                    </span>
                  )}
                  {item.isHost && (
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                      ⭐ OFFICIAL ANNOUNCEMENT
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
                  {new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h4 className="text-xs md:text-sm font-bold text-white tracking-tight">
                {item.headline}
              </h4>

              {item.body && (
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  {item.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
