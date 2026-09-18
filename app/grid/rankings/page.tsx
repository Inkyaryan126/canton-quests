import type { Metadata } from 'next';
import GridRankingsClient from './rankings-client';

export const metadata: Metadata = {
  title: 'The Grid Rankings — Canton City 001',
  description:
    'Explore The Grid multi-stat rankings across territory, economy, competition, discovery, missions, social play, and legacy.',
};

export default function GridRankingsPage() {
  return <GridRankingsClient />;
}
