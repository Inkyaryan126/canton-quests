import type { Metadata } from 'next';
import FamilyLanding from '@/components/landing/FamilyLanding';
import { acquisitionLandingPages } from '@/lib/acquisition-landing-content';

const content = acquisitionLandingPages.family;

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
  return <FamilyLanding />;
}
