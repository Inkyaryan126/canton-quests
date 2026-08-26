import { redirect } from 'next/navigation';

/** Canonical Operation-scoped Watch URL — scopes the shared spectator feed to this Operation. */
export default function EventWatchRedirect({ params }: { params: { slug: string } }) {
  redirect(`/watch?eventSlug=${params.slug}`);
}
