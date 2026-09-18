import React from 'react';
import type { Metadata } from 'next';
import GridWorldClient from '../grid-world-client';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';

export const metadata: Metadata = {
  title: 'The Grid — First Look | Canton Quests',
  description: 'Private authenticated Canton City Board for The Grid.',
  robots: { index: false, follow: false },
};

export default function GridPreviewPage() {
  const initialProjection = buildGridWorldProjection(cantonFoundingSeasonPackage);

  return <GridWorldClient initialProjection={initialProjection} />;
}
