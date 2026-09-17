import type { Metadata } from 'next';
import GridAuctionsClient from './grid-auctions-client';

export const metadata: Metadata = {
  title: 'Grid Auctions | Canton Quests',
  description: 'Live property auctions on The Grid.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridAuctionsPage() {
  return <GridAuctionsClient />;
}
