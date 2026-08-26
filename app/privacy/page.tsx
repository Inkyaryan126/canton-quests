import type { Metadata } from 'next';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Canton Quests collects, uses, and protects player data.',
  alternates: { canonical: '/privacy' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight mb-2">{title}</h2>
      <div className="text-sm text-stone-300 font-body leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref="/events/canton-weekend-1" context="global" />
      <main className="cq-page-main">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Legal — Draft for Review</span>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-2 mb-8">
            Privacy Policy
          </h1>
          <p className="text-sm text-stone-400 font-mono mb-10">
            This describes what Canton Quests actually collects and how it&apos;s used, at a product level. It is an
            operational reference, not a substitute for legal review before launch.
          </p>

          <Section title="Account Information">
            <p>
              When you create an account, we collect your callsign (a public display name), your email address, and a
              password (stored securely by our authentication provider, never in plain text). Your callsign is shown
              publicly on the leaderboard and other player-facing surfaces; your email address is not shown publicly.
            </p>
          </Section>

          <Section title="Avatar & Uploaded Photos">
            <p>
              You may select a preset avatar or upload a custom profile photo. Uploaded photos are stored in a private
              file store and served only through short-lived, signed links generated when your profile is viewed —
              they are not published to a public storage URL.
            </p>
          </Section>

          <Section title="Quest Submissions & Proof">
            <p>
              Completing a quest may involve submitting proof: a photo, a video, a check-in, a scanned QR code, or a
              typed answer, depending on that quest&apos;s verification method. GPS location is collected only for
              quests that specifically use location-based check-in or radius verification — never in the background,
              and never for quests that don&apos;t require it.
            </p>
          </Section>

          <Section title="Leaderboard & Public Game Data">
            <p>
              Your callsign, avatar, total XP, level, starting path, and completed-quest count may appear on public
              leaderboard and player-summary surfaces. Your email address, password, and raw uploaded-photo file path
              are never included in these public surfaces.
            </p>
          </Section>

          <Section title="Prize Drawing Data">
            <p>
              Operating the transparent prize drawing requires us to retain your qualifying drawing-entry count and,
              for winners, enough contact information to deliver a prize. Public drawing pages show entry counts and
              draw results using a sanitized public label, not your raw account identifiers.
            </p>
          </Section>

          <Section title="Email Use">
            <p>
              Your email address is used for account verification, password recovery, and operational communication
              about the event you registered for (such as prize-drawing results if you win). We do not sell your
              email address.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              We retain account and gameplay data for as long as your account is active and as needed to operate the
              current event, resolve disputes, and meet the prize-drawing transparency commitments described in the
              Official Rules. We do not make blanket promises about specific deletion timelines that our current
              systems cannot support — if you have a specific data question or request, reach out through the contact
              channel listed on the homepage.
            </p>
          </Section>

          <p className="text-xs text-stone-500 font-mono mt-12">
            This policy is subject to legal review before public launch and may be updated.
          </p>
        </div>
      </main>
      <CinematicFooter />
    </div>
  );
}
