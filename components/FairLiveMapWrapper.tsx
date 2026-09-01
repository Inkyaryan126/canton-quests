'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { FairLiveMapProps } from './FairLiveMap';

const FairLiveMap = dynamic(() => import('./FairLiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-[1180px] mx-auto min-h-[480px] rounded-xl bg-[#0a0d12] border border-cyan-500/20 flex flex-col justify-center items-center p-8 my-6">
      <div className="w-10 h-10 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-xs font-mono text-[#00f0ff] tracking-widest uppercase">
        INITIALIZING STARK COUNTY FAIRGROUNDS RADAR GRID...
      </p>
    </div>
  ),
});

export default function FairLiveMapWrapper(props: FairLiveMapProps) {
  return <FairLiveMap {...props} />;
}
