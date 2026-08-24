'use client';

import React from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  showPassword: boolean;
  onToggleShow: () => void;
  required?: boolean;
  autoComplete?: string;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
  required,
  autoComplete,
}: PasswordFieldProps) {
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
        {/* Left lock icon */}
        <span
          className="absolute left-4 flex items-center pointer-events-none"
          style={{ color: '#00bfe8' }}
        >
          <Lock size={17} />
        </span>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="cq-login-input"
          style={{
            width: '100%',
            paddingLeft: '44px',
            paddingRight: '52px',
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
        {/* Right toggle button */}
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-4 flex items-center"
          style={{
            color: 'rgba(255,255,255,0.45)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#00bfe8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}
