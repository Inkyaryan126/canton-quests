import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isGridAllianceEnabled } from '@/lib/grid/server/feature-flags';
import GridAlliancesClient from './alliances-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Alliances | The Grid',
  description:
    'Private strategic Alliance controls for The Grid Founding Season in Canton, Ohio.',
  robots: { index: false, follow: false },
};

export default function GridAlliancesPage() {
  if (!isGridAllianceEnabled()) {
    notFound();
  }

  return <GridAlliancesClient />;
}
