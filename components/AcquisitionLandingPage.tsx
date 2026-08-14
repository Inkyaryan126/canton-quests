import FamilyLanding from './landing/FamilyLanding';
import ChallengeLanding from './landing/ChallengeLanding';
import SecretLanding from './landing/SecretLanding';
import { ACQUISITION_ENTRY_HREF, FairLandingContent } from '@/lib/acquisition-landing-content';

export default function AcquisitionLandingPage({ content }: { content: FairLandingContent }) {
  if (content.theme === 'family') {
    return <FamilyLanding />;
  }
  if (content.theme === 'challenge') {
    return <ChallengeLanding />;
  }
  if (content.theme === 'secret') {
    return <SecretLanding />;
  }

  return <FamilyLanding />;
}

export { ACQUISITION_ENTRY_HREF };
