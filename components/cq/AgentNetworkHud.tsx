import React from 'react';

export default function AgentNetworkHud() {
  return (
    <div
      className="hidden lg:block"
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(0,191,232,0.28)',
        borderRadius: '6px',
        padding: '8px 14px',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        AGENT NETWORK
      </div>
      <div className="flex items-center gap-2">
        {/* Pulsing green dot */}
        <span className="relative flex items-center justify-center">
          <span
            className="animate-ping absolute inline-flex"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22c55e',
              opacity: 0.6,
            }}
          />
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 5px rgba(34,197,94,0.7)',
            }}
          />
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#00bfe8',
          }}
        >
          ACTIVE
        </span>
        <span
          style={{
            fontSize: '10px',
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          127 AGENTS ONLINE
        </span>
      </div>
    </div>
  );
}
