import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin, Radar, Sparkles, Trophy, Users } from 'lucide-react';
import CinematicFooter from './CinematicFooter';
import CinematicNav from './CinematicNav';
import MobileStartBar from './MobileStartBar';
import { FAIR_ENTRY_HREF, FairLandingContent } from '@/lib/fair-landing-content';
import { cqImages } from '@/lib/marketing-assets';

const proofIcons = [Sparkles, Users, MapPin, Trophy];

export default function FairLandingPage({ content }: { content: FairLandingContent }) {
  return (
    <div className={`cq-home-shell cq-fair-shell cq-fair-${content.theme}`}>
      <CinematicNav eventHref={FAIR_ENTRY_HREF} />

      <main className="cq-fair-main">
        <section className="cq-fair-hero" aria-labelledby={`${content.slug}-headline`}>
          <div className="cq-fair-copy">
            <span className="cq-fair-eyebrow">{content.eyebrow}</span>
            <h1 id={`${content.slug}-headline`}>{content.headline}</h1>
            {content.secondaryHeadline && <h2>{content.secondaryHeadline}</h2>}
            <div className="cq-fair-support">
              {content.support.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="cq-fair-actions">
              <Link href={FAIR_ENTRY_HREF} className="cq-gold-button" data-fair-cta={content.slug}>
                {content.cta}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            {content.challengeLine && <p className="cq-fair-pressure">{content.challengeLine}</p>}
          </div>

          <div className="cq-fair-visual" aria-hidden="true">
            <Image src={content.heroImage} alt={content.heroImageAlt} fill priority sizes="(max-width: 900px) 100vw, 48vw" />
            <div className="cq-fair-visual-badge">
              <Radar size={18} />
              <span>FIELD SIGNAL ACTIVE</span>
            </div>
          </div>
        </section>

        <section className="cq-fair-proof" aria-label="Canton Quests benefits">
          {content.proofPoints.map((point, index) => {
            const Icon = proofIcons[index % proofIcons.length];
            return (
              <div key={point}>
                <Icon size={18} aria-hidden="true" />
                <span>{point}</span>
              </div>
            );
          })}
        </section>

        {content.flow && (
          <section className="cq-fair-flow" aria-label="Quest reward flow">
            {content.flow.map((step, index) => (
              <div key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </section>
        )}

        {content.objection && (
          <section className="cq-fair-objection">
            <span>Fast Start</span>
            <h2>{content.objection.title}</h2>
            <p>{content.objection.body}</p>
          </section>
        )}

        {content.teaserCards && (
          <section className="cq-fair-teasers" aria-label="Secret quest teasers">
            {content.teaserCards.map((card) => (
              <article key={card.title}>
                <span>Case File</span>
                <h2>{card.title}</h2>
                <p>{card.copy}</p>
              </article>
            ))}
          </section>
        )}

        <section className="cq-fair-sections">
          {content.sections.map((section) => (
            <article key={section.title}>
              <span>{section.eyebrow}</span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="cq-fair-final">
          <Image src={cqImages.questStrip} alt="" fill sizes="100vw" />
          <div>
            <span>Same Game. Same Rewards.</span>
            <h2>Start Quest {'->'} choose Missions {'->'} submit proof {'->'} earn XP {'->'} climb Leaderboard.</h2>
            <Link href={FAIR_ENTRY_HREF} className="cq-gold-button">
              {content.cta}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={FAIR_ENTRY_HREF} label={content.cta} eyebrow="Mission ready" />
    </div>
  );
}
