'use client';

import React from 'react';

interface HudReticleProps {
  size?: number;
  color?: string;
  spinning?: boolean;
  className?: string;
  glow?: boolean;
  variant?: 'compass' | 'kinetic' | 'cryptic';
}

export default function HudReticle({
  size = 120,
  color = '#f59e0b',
  spinning = true,
  className = '',
  glow = true,
  variant = 'compass',
}: HudReticleProps) {
  const half = size / 2;

  return (
    <div
      className={`relative inline-flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: glow ? `drop-shadow(0 0 12px ${color}60)` : undefined,
      }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        className={spinning ? 'animate-[spin_12s_linear_infinite]' : ''}
      >
        {/* Outer Ring */}
        <circle
          cx={half}
          cy={half}
          r={half - 4}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeOpacity="0.6"
        />

        {/* Inner Ring */}
        <circle
          cx={half}
          cy={half}
          r={half * 0.7}
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.4"
        />

        {/* Core Ring */}
        <circle
          cx={half}
          cy={half}
          r={half * 0.35}
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />

        {/* Crosshair Marks */}
        <line
          x1={half}
          y1={2}
          x2={half}
          y2={12}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={half}
          y1={size - 12}
          x2={half}
          y2={size - 2}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={2}
          y1={half}
          x2={12}
          y2={half}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={size - 12}
          y1={half}
          x2={size - 2}
          y2={half}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Variant specific markers */}
        {variant === 'compass' && (
          <>
            {/* Cardinal 45-degree ticks */}
            <line
              x1={half - half * 0.5}
              y1={half - half * 0.5}
              x2={half - half * 0.4}
              y2={half - half * 0.4}
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.5"
            />
            <line
              x1={half + half * 0.5}
              y1={half - half * 0.5}
              x2={half + half * 0.4}
              y2={half - half * 0.4}
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.5"
            />
            <line
              x1={half - half * 0.5}
              y1={half + half * 0.5}
              x2={half - half * 0.4}
              y2={half + half * 0.4}
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.5"
            />
            <line
              x1={half + half * 0.5}
              y1={half + half * 0.5}
              x2={half + half * 0.4}
              y2={half + half * 0.4}
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.5"
            />
          </>
        )}

        {variant === 'kinetic' && (
          <>
            {/* Speed chevron brackets */}
            <path
              d={`M ${half - 16} ${half - 24} L ${half} ${half - 32} L ${half + 16} ${half - 24}`}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M ${half - 16} ${half + 24} L ${half} ${half + 32} L ${half + 16} ${half + 24}`}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {variant === 'cryptic' && (
          <>
            {/* Triangular mystic cipher nodes */}
            <polygon
              points={`${half},${half * 0.3} ${half * 1.6},${half * 1.4} ${half * 0.4},${half * 1.4}`}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="2 3"
              strokeOpacity="0.7"
            />
          </>
        )}
      </svg>

      {/* Center Target Dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: Math.max(4, size * 0.05),
          height: Math.max(4, size * 0.05),
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}
