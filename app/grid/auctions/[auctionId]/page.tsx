import type { Metadata } from 'next';
import GridAuctionDetailClient from './grid-auction-detail-client';

export const metadata: Metadata = {
  title: 'Auction | The Grid | Canton Quests',
  description: 'Bid on a live Grid property auction.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridAuctionDetailPage({
  params,
}: {
  params: { auctionId: string };
}) {
  return <GridAuctionDetailClient auctionId={params.auctionId} />;
}
