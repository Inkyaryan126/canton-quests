import { redirect } from 'next/navigation';

/**
 * Legacy URL. This page's entire content is Founder's Cipher-specific
 * (Sept 11-14 dates, drawing eligibility, starting paths) — it now lives at
 * its canonical Operation-scoped location.
 */
export default function LegacyRulesRedirect() {
  redirect('/events/canton-weekend-1/rules');
}
