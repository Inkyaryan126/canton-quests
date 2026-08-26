import type { Metadata } from 'next';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of Use for Canton Quests — acceptable use, account responsibility, and product terms.',
  alternates: { canonical: '/terms' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight mb-2">{title}</h2>
      <div className="text-sm text-stone-300 font-body leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref="/events/canton-weekend-1" context="global" />
      <main className="cq-page-main">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Legal — Draft for Review</span>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-2 mb-8">
            Terms of Use
          </h1>
          <p className="text-sm text-stone-400 font-mono mb-10">
            These terms describe acceptable use of Canton Quests. They are an operational reference, not a substitute
            for legal review before launch.
          </p>

          <Section title="Lawful Participation">
            <p>
              You agree to play Canton Quests lawfully: no trespassing, no entering private or restricted property
              without permission, and no violating posted access rules, hours, or safety notices at any quest
              location. See the Official Rules for the full safety guidance.
            </p>
          </Section>

          <Section title="No Tampering or Exploitation">
            <p>
              You agree not to tamper with, reverse-engineer, or exploit Canton Quests&apos; scoring, verification, or
              prize-drawing systems; not to submit falsified or manipulated proof; and not to attempt to access
              another player&apos;s account or data.
            </p>
          </Section>

          <Section title="User-Generated Proof">
            <p>
              Photos, videos, and other proof you submit to complete a quest may be reviewed by our team for
              verification purposes and, where relevant to the event&apos;s public storytelling (such as the live
              spectator feed), may be referenced in a sanitized, non-identifying form. You retain ownership of content
              you submit.
            </p>
          </Section>

          <Section title="Account Responsibility">
            <p>
              You are responsible for keeping your account credentials secure and for activity that occurs under your
              account. Callsigns and content must not be abusive, impersonating, or otherwise inappropriate — we may
              remove content or suspend an account that violates this.
            </p>
          </Section>

          <Section title="Game Availability">
            <p>
              Canton Quests is provided on an as-available basis. We may modify, pause, or discontinue any quest,
              feature, or the event itself, including for safety, technical, or operational reasons, as described in
              the Official Rules.
            </p>
          </Section>

          <Section title="Intellectual Property">
            <p>
              Canton Quests&apos; game content, branding, quest designs, and platform are owned by Canton Quests and its
              operators. These terms do not grant you any rights to that content beyond what&apos;s needed to play the
              game as intended.
            </p>
          </Section>

          <Section title="Liability">
            <p>
              Canton Quests missions take place in real-world public locations. Play at your own risk, follow all
              posted safety guidance, and use good judgment. This section is intentionally conservative pending full
              legal review before public launch.
            </p>
          </Section>

          <p className="text-xs text-stone-500 font-mono mt-12">
            These terms are subject to legal review before public launch and may be updated.
          </p>
        </div>
      </main>
      <CinematicFooter />
    </div>
  );
}
