import type { Metadata } from 'next';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';
import GridWorldClient from './grid-world-client';

export const metadata: Metadata = {
  title: 'The Grid — Canton City Board',
  description:
    'Explore the read-only Canton City #001 world projection for The Grid.',
};

export default function GridPage() {
  const initialProjection = buildGridWorldProjection(
    cantonFoundingSeasonPackage,
  );

  return <GridWorldClient initialProjection={initialProjection} />;
}
