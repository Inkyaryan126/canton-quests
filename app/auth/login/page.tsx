'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  KeyRound,
  AlertCircle,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import LoginField from '@/components/auth/LoginField';
import PasswordField from '@/components/auth/PasswordField';
import SecureAccess from '@/components/auth/SecureAccess';
import FieldStatusHud from '@/components/cq/FieldStatusHud';
import AgentNetworkHud from '@/components/cq/AgentNetworkHud';
import TacticalMapOverlay from '@/components/cq/TacticalMapOverlay';

// ─────────────────────────────────────────────────────────────────
// LoginBackground
// ─────────────────────────────────────────────────────────────────
function LoginBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Hero image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${cqImages.heroCityBeam})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="mobile-bg-pos"
      />

      {/* Dark gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(3,6,8,.65) 0%, rgba(3,6,8,.72) 45%, rgba(3,6,8,.88) 100%)',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,.7) 100%)',
        }}
      />

      {/* Subtle scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Tactical SVG overlay */}
      <TacticalMapOverlay />

      {/* Mobile bg position override */}
      <style>{`
        @media (max-width: 1023px) {
          .mobile-bg-pos {
            background-position: 42% center !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LoginHero — compact top branding, shared across breakpoints.
// HUD chips sit in a compact row above the logo (AgentNetworkHud
// hides itself below lg via its own internal class).
// ─────────────────────────────────────────────────────────────────
function LoginHero() {
  return (
    <div className="login-hero relative z-10 flex flex-col items-center">
      <style>{`
        .login-hero {
          padding: 16px 16px 12px;
        }
        @media (min-width: 1024px) {
          .login-hero {
            padding: 6px 16px 4px;
          }
        }
        .login-hero-huds {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .login-hero-logo {
          filter: drop-shadow(0 0 22px rgba(214,167,45,0.5)) drop-shadow(0 0 6px rgba(214,167,45,0.28));
          display: inline-flex;
          width: 72px;
          height: 72px;
        }
        @media (min-width: 1024px) {
          .login-hero-logo {
            width: 92px;
            height: 92px;
          }
        }
        .login-hero-logo img {
          width: 100%;
          height: 100%;
        }
        .login-hero-wordmark {
          font-family: serif;
          font-weight: 900;
          color: #d6a72d;
          letter-spacing: -0.01em;
          text-align: center;
          margin: 8px 0 3px;
          line-height: 1.05;
          font-size: 28px;
        }
        @media (min-width: 1024px) {
          .login-hero-wordmark {
            font-size: 36px;
            margin: 10px 0 4px;
          }
        }
        .login-hero-subtitle {
          font-family: monospace;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.42);
          text-align: center;
          text-transform: uppercase;
          font-size: 11px;
        }
        @media (min-width: 1024px) {
          .login-hero-subtitle {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="login-hero-huds">
        <FieldStatusHud />
        <AgentNetworkHud />
      </div>

      <div className="login-hero-logo">
        <CantonQuestsLogo variant="mark" size={100} priority />
      </div>

      <h1 className="login-hero-wordmark">CANTON QUESTS</h1>
      <p className="login-hero-subtitle">FIELD OPERATIONS // CANTON, OH</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LoginCard props
// ─────────────────────────────────────────────────────────────────
interface LoginCardProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  isLoading: boolean;
  errorMessage: string;
  onSubmit: (e: React.FormEvent) => void;
}

// ─────────────────────────────────────────────────────────────────
// LoginCard
// ─────────────────────────────────────────────────────────────────
function LoginCard({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  onTogglePassword,
  isLoading,
  errorMessage,
  onSubmit,
}: LoginCardProps) {
  const [rememberMe, setRememberMe] = useState(false);
  const [enterHover, setEnterHover] = useState(false);
  const [createHover, setCreateHover] = useState(false);

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(10,14,17,.97), rgba(5,8,11,.95))',
        border: '1px solid rgba(214,167,45,.70)',
        borderRadius: '20px',
        boxShadow:
          '0 24px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04), 0 0 32px rgba(214,167,45,.07)',
      }}
      className="login-card-padding"
    >
      <style>{`
        .login-card-padding {
          padding: 22px 20px 24px;
        }
        @media (min-width: 1024px) {
          .login-card-padding {
            padding: 22px 32px 22px;
          }
        }
        .login-form-inner {
          max-width: 720px;
          margin: 0 auto;
        }
        .login-btn-primary {
          height: 60px;
        }
        .login-btn-secondary {
          height: 60px;
        }
        @media (min-width: 1024px) {
          .login-btn-primary {
            height: 56px;
          }
          .login-btn-secondary {
            height: 52px;
          }
        }
      `}</style>

      <div className="login-form-inner">
        {/* Eyebrow badge */}
        <div className="flex justify-center mb-2">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(214,167,45,0.10)',
              border: '1px solid rgba(214,167,45,0.35)',
              borderRadius: '999px',
              padding: '4px 14px',
            }}
          >
            <KeyRound size={12} style={{ color: '#d6a72d' }} />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#d6a72d',
                textTransform: 'uppercase',
              }}
            >
              PLAYER ACCESS
            </span>
          </div>
        </div>

        {/* Heading */}
        <h2
          className="login-heading"
          style={{
            color: '#fff',
            fontWeight: 800,
            textAlign: 'center',
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
            lineHeight: 1.08,
          }}
        >
          Welcome Back
        </h2>
        <style>{`
          .login-heading {
            font-size: 38px;
          }
          @media (min-width: 1024px) {
            .login-heading {
              font-size: 42px;
            }
          }
        `}</style>

        {/* Subtext */}
        <p
          style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
            lineHeight: 1.45,
            margin: '0 0 18px',
          }}
        >
          Sign in to access your Player Command Center and continue your missions.
        </p>

        {/* Error panel */}
        {errorMessage && (
          <div
            aria-live="polite"
            role="alert"
            style={{
              background: 'rgba(153,27,27,0.30)',
              border: '1px solid rgba(239,68,68,0.40)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#fca5a5' }}>
              {errorMessage}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="flex flex-col" style={{ gap: '14px' }}>
          {/* Email */}
          <LoginField
            id="login-email-input"
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="agent@example.com"
            icon={<Mail size={17} />}
            required
            autoFocus
            autoComplete="email"
          />

          {/* Password */}
          <PasswordField
            id="login-password-input"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            showPassword={showPassword}
            onToggleShow={onTogglePassword}
            required
            autoComplete="current-password"
          />

          {/* Remember me + Forgot password row */}
          <div
            className="flex items-center justify-between"
            style={{ marginTop: '8px', marginBottom: '14px' }}
          >
            <label
              className="flex items-center gap-2 cursor-pointer"
              style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: '#d6a72d', width: 14, height: 14, cursor: 'pointer' }}
              />
              Remember me
            </label>
            <Link
              href="/auth/forgot-password"
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#00bfe8',
                textDecoration: 'none',
                letterSpacing: '0.04em',
              }}
            >
              Forgot Password?
            </Link>
          </div>

          {/* Enter button */}
          <button
            type="submit"
            disabled={isLoading}
            onMouseEnter={() => setEnterHover(true)}
            onMouseLeave={() => setEnterHover(false)}
            className="login-btn-primary"
            style={{
              width: '100%',
              borderRadius: '10px',
              background: 'linear-gradient(90deg, #c79119, #f3c849, #c8921b)',
              color: '#0a0d0f',
              fontWeight: 800,
              fontSize: '14px',
              letterSpacing: '0.1em',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 0 22px rgba(234,183,49,.18)',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.18s',
              filter: enterHover && !isLoading ? 'brightness(1.08)' : 'brightness(1)',
              transform: enterHover && !isLoading ? 'translateY(-1px)' : 'translateY(0)',
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <KeyRound size={17} />
                <span>ENTER CANTON QUESTS</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3" style={{ margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            NEW TO CANTON QUESTS?
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
        </div>

        {/* Create Account button */}
        <Link
          href="/register"
          onMouseEnter={() => setCreateHover(true)}
          onMouseLeave={() => setCreateHover(false)}
          className="login-btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            borderRadius: '10px',
            background: createHover ? 'rgba(0,191,232,.07)' : 'rgba(0,0,0,.12)',
            border: '1px solid #00bfe8',
            color: '#00bfe8',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'all 0.18s',
            boxShadow: createHover ? '0 0 18px rgba(0,191,232,.10)' : 'none',
          }}
        >
          <UserPlus size={17} />
          <span>CREATE YOUR AGENT PROFILE</span>
        </Link>

        {/* Secure Access footer */}
        <SecureAccess />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────────────────────────────
function LoginLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030608',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'monospace',
          color: '#d6a72d',
          fontSize: '13px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
        className="animate-pulse"
      >
        Loading terminal...
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LoginContent — all auth state + layout
// ─────────────────────────────────────────────────────────────────
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || searchParams.get('redirectTo') || '/profile';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated, redirect to next or /profile
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
            window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
          }
          router.push(nextParam);
        }
      })
      .catch(() => {});
  }, [router, nextParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        if (data.player) {
          window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
        }
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
      }

      router.push(nextParam);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Login failed. Please check your credentials.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Layer 0: Background */}
      <LoginBackground />

      <style>{`
        .login-page-pad {
          padding: 16px 16px 24px;
        }
        .login-shell {
          position: relative;
          z-index: 10;
          width: 100%;
          margin: 0;
        }
        @media (min-width: 1024px) {
          .login-page-pad {
            padding: 6px 0 6px;
          }
          .login-shell {
            max-width: 820px;
            width: calc(100% - 64px);
            margin: 6px auto 0;
          }
        }
      `}</style>

      {/* Content wrapper */}
      <div className="relative z-10 min-h-screen flex flex-col items-center login-page-pad">
        <LoginHero />

        <div className="login-shell">
          <LoginCard
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((p) => !p)}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onSubmit={handleLogin}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LoginPage — export default
// ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
