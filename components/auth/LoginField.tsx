'use client';

import React from 'react';

interface LoginFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}

export default function LoginField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  required,
  autoFocus,
  autoComplete,
}: LoginFieldProps) {
  return (
    <div className="flex flex-col" style={{ gap: '7px' }}>
      <style>{`
        .cq-login-input {
          height: 58px;
        }
        @media (min-width: 1024px) {
          .cq-login-input {
            height: 54px;
          }
        }
      `}</style>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.85)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {/* Left icon */}
        <span
          className="absolute left-4 flex items-center pointer-events-none"
          style={{ color: '#00bfe8' }}
        >
          {icon}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="cq-login-input"
          style={{
            width: '100%',
            paddingLeft: '44px',
            paddingRight: '16px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '16px',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'border-color 0.18s, box-shadow 0.18s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#00bfe8';
            e.currentTarget.style.boxShadow =
              '0 0 0 1px rgba(0,191,232,.22), 0 0 14px rgba(0,191,232,.14)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
}
