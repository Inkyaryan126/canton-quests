import React from 'react';
import type { Metadata } from 'next';
import GridWorldClient from '../grid-world-client';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';

export const metadata: Metadata = {
  title: 'The Grid — First Look | Canton Quests',
  description: 'Private read-only first look at The Grid in Canton, Ohio.',
  robots: { index: false, follow: false },
};

export default function GridPreviewPage() {
  const initialProjection = buildGridWorldProjection(cantonFoundingSeasonPackage);

  return <GridWorldClient initialProjection={initialProjection} />;
}
