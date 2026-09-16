import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import ScrimmageClient from './scrimmage-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Private Scrimmage | The Grid',
  description:
    'Create a private Grid Signal Duel room. Scrimmage state is isolated from permanent city progression.',
};

export default function GridScrimmagePage() {
  if (!isGridScrimmageEnabled()) {
    notFound();
  }

  return <ScrimmageClient />;
}
