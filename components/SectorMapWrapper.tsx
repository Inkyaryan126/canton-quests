'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import type { SectorMapProps } from './SectorMap';

const SectorMap = dynamic(() => import('./SectorMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-[1180px] mx-auto min-h-[520px] rounded-lg bg-[#0a0d12] border border-white/10 flex flex-col justify-center items-center p-8 my-6">
      <div className="w-10 h-10 border-4 border-[#ffb238] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-xs font-mono text-[#ffb238] tracking-widest uppercase">
        INITIALIZING CANTON SECTOR RADAR GRID...
      </p>
    </div>
  ),
});

export default function SectorMapWrapper(props: SectorMapProps) {
  return <SectorMap {...props} />;
}
