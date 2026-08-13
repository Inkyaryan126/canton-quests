import type { Metadata } from 'next';
import FairLandingPage from '@/components/FairLandingPage';
import { fairLandingPages } from '@/lib/fair-landing-content';

const content = fairLandingPages.family;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  openGraph: {
    title: content.ogTitle,
    description: content.ogDescription,
    type: 'website',
  },
};

export default function StartFamilyPage() {
  return <FairLandingPage content={content} />;
}
