import { redirect } from 'next/navigation';

/**
 * Legacy URL. This Mission Board only ever showed Founder's Cipher content
 * (its path filters — Family/Challenge/Secret — are Cipher-only concepts,
 * and Fair never used this page), so it's purely Founder's Cipher-specific.
 * It now lives at its canonical Operation-scoped location.
 */
export default function LegacyQuestsRedirect() {
  redirect('/events/canton-weekend-1/quests');
}
