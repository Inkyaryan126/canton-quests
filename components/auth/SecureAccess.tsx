import React from 'react';
import Image from 'next/image';
import { cqImages } from '@/lib/marketing-assets';

export default function SecureAccess() {
  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: '14px',
        marginTop: '18px',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Image
          src={cqImages.iconShield}
          alt="Secure access shield"
          width={18}
          height={18}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(214,167,45,0.55))' }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#d6a72d',
            textTransform: 'uppercase',
          }}
        >
          SECURE ACCESS
        </span>
      </div>
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.38)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Your account is protected through secure authentication.
      </p>
    </div>
  );
}
