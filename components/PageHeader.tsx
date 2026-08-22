import type { ReactNode } from 'react';

type PageHeaderAccent = 'gold' | 'cyan' | 'crimson' | 'purple' | 'emerald';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  body?: string;
  accent?: PageHeaderAccent;
  /** Optional right-side action area (buttons, status chips, etc.) */
  action?: ReactNode;
  /** Optional icon/emblem to the left of or above the title */
  icon?: ReactNode;
  /** Add the HUD-style horizontal divider below the header */
  divider?: boolean;
  className?: string;
}

/**
 * PageHeader — Reusable compact top-of-page section header.
 *
 * Provides consistent eyebrow → title → body structure across all
 * major Canton Quests pages (Quest Board, Leaderboard, Profile,
 * Prize Vault, Watch, Event pages, etc.).
 *
 * The `accent` prop controls the left bar color and eyebrow color:
 * - gold    (default) — amber/gold for general pages
 * - cyan    — system / spectator / leaderboard context
 * - crimson — challenge path / urgent context
 * - purple  — secret path context
 * - emerald — success / prize / live context
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="MISSION SYSTEM"
 *     title="QUEST BOARD"
 *     body="Complete quests to earn XP and climb the Canton leaderboard."
 *     accent="gold"
 *     action={<Link href="/events" className="cq-btn-sm cq-gold-button">START PLAYING</Link>}
 *     divider
 *   />
 */
export default function PageHeader({
  eyebrow,
  title,
  body,
  accent = 'gold',
  action,
  icon,
  divider = false,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`cq-page-header is-${accent} ${className}`} role="banner">
      <div className="cq-page-header-inner">
        {(eyebrow || action) && (
          <div className="cq-page-header-row" style={{ marginBottom: eyebrow ? '0' : '0.75rem' }}>
            <div>
              {eyebrow && (
                <p className="cq-page-header-eyebrow">
                  {icon && <span aria-hidden="true">{icon}</span>}
                  {eyebrow}
                </p>
              )}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        {icon && !eyebrow && (
          <div style={{ marginBottom: '0.5rem' }} aria-hidden="true">
            {icon}
          </div>
        )}
        <h1 className="cq-page-header-title">{title}</h1>
        {body && <p className="cq-page-header-body">{body}</p>}
      </div>
      {divider && <div className="cq-page-header-divider" aria-hidden="true" />}
    </div>
  );
}
