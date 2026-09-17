import type { Metadata } from 'next';
import GridMarketClient from './grid-market-client';

export const metadata: Metadata = {
  title: 'Grid Market | Canton Quests',
  description: 'The Grid city exchange — Credits, listings, auctions, and market activity.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridMarketPage() {
  return <GridMarketClient />;
}
