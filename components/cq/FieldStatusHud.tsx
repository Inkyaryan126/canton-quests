import React from 'react';

interface FieldStatusHudProps {
  className?: string;
}

export default function FieldStatusHud({ className = '' }: FieldStatusHudProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* Corner bracket: top-left */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 10,
          height: 10,
          borderTop: '1.5px solid rgba(0,191,232,0.7)',
          borderLeft: '1.5px solid rgba(0,191,232,0.7)',
        }}
      />
      {/* Corner bracket: top-right */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 10,
          height: 10,
          borderTop: '1.5px solid rgba(0,191,232,0.7)',
          borderRight: '1.5px solid rgba(0,191,232,0.7)',
        }}
      />
      {/* Corner bracket: bottom-left */}
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 10,
          height: 10,
          borderBottom: '1.5px solid rgba(0,191,232,0.7)',
          borderLeft: '1.5px solid rgba(0,191,232,0.7)',
        }}
      />
      {/* Corner bracket: bottom-right */}
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 10,
          height: 10,
          borderBottom: '1.5px solid rgba(0,191,232,0.7)',
          borderRight: '1.5px solid rgba(0,191,232,0.7)',
        }}
      />

      {/* Main panel */}
      <div
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: '1px solid rgba(0,191,232,0.22)',
          borderRadius: '4px',
          padding: '8px 12px',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            marginBottom: '3px',
          }}
        >
          FIELD OPS STATUS
        </div>
        <div className="flex items-center gap-1.5" style={{ marginBottom: '2px' }}>
          {/* Green dot */}
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 5px rgba(34,197,94,0.7)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#00bfe8',
              textTransform: 'uppercase',
            }}
          >
            ONLINE
          </span>
        </div>
        <div
          style={{
            fontSize: '9px',
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          CANTON, OH · 40.7984° N · 81.3784° W
        </div>
      </div>
    </div>
  );
}
