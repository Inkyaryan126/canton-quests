import type { Metadata } from 'next';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';
import GridWorldClient from './grid-world-client';

export const metadata: Metadata = {
  title: 'The Grid — Canton City Board | Canton Quests',
  description: 'Enter the Canton City Board, explore territory, property, economy, contests, and the living Grid systems.',
};

export default function GridPage() {
  const initialProjection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  return <GridWorldClient initialProjection={initialProjection} />;
}
