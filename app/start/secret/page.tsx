import type { Metadata } from 'next';
import AcquisitionLandingPage from '@/components/AcquisitionLandingPage';
import { acquisitionLandingPages } from '@/lib/acquisition-landing-content';

const content = acquisitionLandingPages.secret;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  openGraph: {
    title: content.ogTitle,
    description: content.ogDescription,
    type: 'website',
  },
};

export default function StartSecretPage() {
  return <AcquisitionLandingPage content={content} />;
}
