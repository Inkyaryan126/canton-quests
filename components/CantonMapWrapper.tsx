'use client';

import dynamic from 'next/dynamic';
import { Quest } from '@/lib/types';

const CantonMap = dynamic(() => import('./CantonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-2xl bg-obsidian border border-gray-800 flex flex-col justify-center items-center p-4">
      <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p className="text-xs font-mono text-amber-400">Initializing Canton Field Map...</p>
    </div>
  ),
});

interface WrapperProps {
  quests: Quest[];
  eventSlug: string;
  completedQuestIds?: string[];
  pendingQuestIds?: string[];
  userLat?: number;
  userLon?: number;
  onLocateMe?: () => void;
  onSelectQuest?: (quest: Quest) => void;
}

export default function CantonMapWrapper(props: WrapperProps) {
  return <CantonMap {...props} />;
}
