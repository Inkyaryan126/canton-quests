import type { Metadata } from 'next';
import GridSeasonHistoryClient from './grid-season-history-client';

export const metadata: Metadata = {
  title: 'Season History | The Grid',
  description: 'Permanent final standings from archived Grid seasons.',
  robots: { index: false, follow: false },
};

export default function GridSeasonHistoryPage() {
  return <GridSeasonHistoryClient />;
}
