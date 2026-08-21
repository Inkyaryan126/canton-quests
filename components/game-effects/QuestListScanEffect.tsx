'use client';

import React, { useEffect, useState } from 'react';
import { Radar, RefreshCw, Sparkles } from 'lucide-react';
import { showGameMoment } from '@/lib/game-effects';

interface QuestListScanEffectProps {
  questCount: number;
  districtName?: string;
  autoScanOnMount?: boolean;
  isLoading?: boolean;
  className?: string;
}

export default function QuestListScanEffect({
  questCount,
  districtName = 'ALL CANTON DISTRICTS',
  autoScanOnMount = true,
  isLoading = false,
  className = '',
}: QuestListScanEffectProps) {
  const [isScanning, setIsScanning] = useState(false);
  const scanTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, []);

  const triggerScan = React.useCallback((manual = true) => {
    setIsScanning(true);
    showGameMoment({
      type: 'city-scan',
      district: districtName,
      targetCount: questCount,
      manualTrigger: manual,
    });

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
      scanTimerRef.current = null;
    }, 1100);
  }, [districtName, questCount]);

  useEffect(() => {
    if (!autoScanOnMount || isLoading) return;

    try {
      const hasScanned = typeof window !== 'undefined' ? sessionStorage.getItem('cq_has_scanned_quests') : null;
      if (!hasScanned) {
        sessionStorage.setItem('cq_has_scanned_quests', 'true');
        triggerScan(false);
      }
    } catch {
      // Fallback
    }
  }, [autoScanOnMount, isLoading, triggerScan]);

  return (
    <div className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-950/80 border border-amber-500/30 text-xs font-mono ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <Radar size={17} className={isScanning || isLoading ? 'animate-spin' : ''} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <strong className="text-white font-mono uppercase tracking-wider">
              {districtName}
            </strong>
            <span className="px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              {isLoading ? 'SCANNING GRID...' : `${questCount} TARGETS ONLINE`}
            </span>
          </div>
          <span className="text-[11px] text-stone-400 block font-body">
            {isLoading
              ? 'Acquiring live satellite & field coordinates across Canton, OH...'
              : 'Real-world urban missions verified and playable in Canton, OH.'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => triggerScan(true)}
        disabled={isScanning || isLoading}
        className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-500/60 text-stone-300 hover:text-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
        title="Re-run citywide scanner"
      >
        <RefreshCw size={13} className={isScanning || isLoading ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{isLoading ? 'SCANNING...' : 'RESCAN GRID'}</span>
      </button>
    </div>
  );
}
