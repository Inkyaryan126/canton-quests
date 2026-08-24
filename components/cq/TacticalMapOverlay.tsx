import React from 'react';

const CORNER_BRACKET_SIZE = 12;
const CORNER_BRACKET_INSET = 8;
const CORNER_BRACKET_COLOR = 'rgba(0,191,232,0.28)';
const CORNER_BRACKET_BORDER = `1.2px solid ${CORNER_BRACKET_COLOR}`;

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function CornerBracket({ position }: { position: CornerPosition }) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  return (
    <span
      style={{
        position: 'absolute',
        top: isTop ? CORNER_BRACKET_INSET : undefined,
        bottom: isTop ? undefined : CORNER_BRACKET_INSET,
        left: isLeft ? CORNER_BRACKET_INSET : undefined,
        right: isLeft ? undefined : CORNER_BRACKET_INSET,
        width: CORNER_BRACKET_SIZE,
        height: CORNER_BRACKET_SIZE,
        borderTop: isTop ? CORNER_BRACKET_BORDER : undefined,
        borderBottom: isTop ? undefined : CORNER_BRACKET_BORDER,
        borderLeft: isLeft ? CORNER_BRACKET_BORDER : undefined,
        borderRight: isLeft ? undefined : CORNER_BRACKET_BORDER,
      }}
    />
  );
}

export default function TacticalMapOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes dashMove {
          to { stroke-dashoffset: -100; }
        }
        @keyframes dashMoveGold {
          to { stroke-dashoffset: -80; }
        }
        .tmo-dash-cyan {
          animation: dashMove 12s linear infinite;
        }
        .tmo-dash-gold {
          animation: dashMoveGold 18s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tmo-dash-cyan,
          .tmo-dash-gold {
            animation: none;
          }
        }
      `}</style>
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* ── Grid lines ───────────────────────────────── */}
        {/* Horizontals */}
        <line x1="0%" y1="25%" x2="100%" y2="25%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
        <line x1="0%" y1="75%" x2="100%" y2="75%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
        {/* Verticals */}
        <line x1="25%" y1="0%" x2="25%" y2="100%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
        <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
        <line x1="75%" y1="0%" x2="75%" y2="100%" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />

        {/* ── Cyan dashed route (diagonal, right side) ─── */}
        {/* Reproduced as three <line> segments — <polyline points> does not
            accept percentage values, only unitless numbers. */}
        <line x1="68%" y1="12%" x2="78%" y2="35%" stroke="#00bfe8" strokeWidth="1.2" strokeOpacity="0.22" strokeDasharray="6 5" className="tmo-dash-cyan" />
        <line x1="78%" y1="35%" x2="72%" y2="58%" stroke="#00bfe8" strokeWidth="1.2" strokeOpacity="0.22" strokeDasharray="6 5" className="tmo-dash-cyan" />
        <line x1="72%" y1="58%" x2="82%" y2="80%" stroke="#00bfe8" strokeWidth="1.2" strokeOpacity="0.22" strokeDasharray="6 5" className="tmo-dash-cyan" />

        {/* ── Gold dashed route (left / bottom) ─────────── */}
        <line x1="8%" y1="20%" x2="22%" y2="42%" stroke="#d6a72d" strokeWidth="1.2" strokeOpacity="0.20" strokeDasharray="5 6" className="tmo-dash-gold" />
        <line x1="22%" y1="42%" x2="18%" y2="66%" stroke="#d6a72d" strokeWidth="1.2" strokeOpacity="0.20" strokeDasharray="5 6" className="tmo-dash-gold" />
        <line x1="18%" y1="66%" x2="32%" y2="85%" stroke="#d6a72d" strokeWidth="1.2" strokeOpacity="0.20" strokeDasharray="5 6" className="tmo-dash-gold" />

        {/* ── Waypoint nodes (stroke only) ─────────────── */}
        {/* Node 1 */}
        <circle cx="68%" cy="12%" r="5" fill="none" stroke="#00bfe8" strokeWidth="1.2" strokeOpacity="0.26" />
        <circle cx="68%" cy="12%" r="2" fill="#00bfe8" fillOpacity="0.18" />
        {/* Node 2 */}
        <circle cx="78%" cy="35%" r="4" fill="none" stroke="#00bfe8" strokeWidth="1" strokeOpacity="0.22" />
        {/* Node 3 */}
        <circle cx="72%" cy="58%" r="5" fill="none" stroke="#00bfe8" strokeWidth="1.2" strokeOpacity="0.24" />
        <circle cx="72%" cy="58%" r="2" fill="#00bfe8" fillOpacity="0.14" />
        {/* Node 4 */}
        <circle cx="82%" cy="80%" r="4" fill="none" stroke="#00bfe8" strokeWidth="1" strokeOpacity="0.22" />
        {/* Node 5 — gold route */}
        <circle cx="22%" cy="42%" r="4" fill="none" stroke="#d6a72d" strokeWidth="1" strokeOpacity="0.22" />
        {/* Node 6 — gold route */}
        <circle cx="32%" cy="85%" r="5" fill="none" stroke="#d6a72d" strokeWidth="1.2" strokeOpacity="0.24" />
        <circle cx="32%" cy="85%" r="2" fill="#d6a72d" fillOpacity="0.14" />

        {/* ── Numeric labels near nodes ──────────────── */}
        <text x="71%" y="10%" fill="#00bfe8" fillOpacity="0.25" fontSize="9" fontFamily="monospace">01</text>
        <text x="81%" y="33%" fill="#00bfe8" fillOpacity="0.25" fontSize="9" fontFamily="monospace">02</text>
        <text x="75%" y="56%" fill="#00bfe8" fillOpacity="0.25" fontSize="9" fontFamily="monospace">03</text>
        <text x="85%" y="78%" fill="#00bfe8" fillOpacity="0.25" fontSize="9" fontFamily="monospace">04</text>
        <text x="25%" y="41%" fill="#d6a72d" fillOpacity="0.22" fontSize="9" fontFamily="monospace">A1</text>
        <text x="35%" y="84%" fill="#d6a72d" fillOpacity="0.22" fontSize="9" fontFamily="monospace">A2</text>

        {/* ── Crosshair marks ──────────────────────── */}
        {/* Crosshair 1 at ~45%, 30% */}
        <line x1="43%" y1="30%" x2="47%" y2="30%" stroke="#00bfe8" strokeWidth="0.8" strokeOpacity="0.18" />
        <line x1="45%" y1="28%" x2="45%" y2="32%" stroke="#00bfe8" strokeWidth="0.8" strokeOpacity="0.18" />
        <circle cx="45%" cy="30%" r="3" fill="none" stroke="#00bfe8" strokeWidth="0.8" strokeOpacity="0.16" />

        {/* Crosshair 2 at ~15%, 65% */}
        <line x1="13%" y1="65%" x2="17%" y2="65%" stroke="#d6a72d" strokeWidth="0.8" strokeOpacity="0.18" />
        <line x1="15%" y1="63%" x2="15%" y2="67%" stroke="#d6a72d" strokeWidth="0.8" strokeOpacity="0.18" />
        <circle cx="15%" cy="65%" r="3" fill="none" stroke="#d6a72d" strokeWidth="0.8" strokeOpacity="0.16" />
      </svg>

      {/* ── Corner bracket marks ──────────────────────
          Fixed-pixel insets anchored to the container edges. CSS handles
          this natively; SVG path data cannot mix percentages with a pixel
          offset (calc() is not valid inside a `d` attribute). */}
      <CornerBracket position="top-left" />
      <CornerBracket position="top-right" />
      <CornerBracket position="bottom-left" />
      <CornerBracket position="bottom-right" />
    </div>
  );
}
