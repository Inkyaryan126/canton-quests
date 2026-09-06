import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  signUpWithPassword,
  signInWithPassword,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  resetMockAuthStores,
  setMockUserUnconfirmed,
} from '../lib/supabase-auth';
import { POST as loginHandler } from '../app/api/auth/login/route';

describe('Auth Spam/Junk Guidance & Resend Functionality', () => {
  beforeEach(() => {
    resetMockAuthStores();
  });

  describe('1. Unconfirmed Account Detection & Resend Confirmation', () => {
    it('detects unconfirmed account in signInWithPassword when marked unconfirmed', async () => {
      await signUpWithPassword({
        displayName: 'UnconfirmedPlayer',
        email: 'unconfirmed@example.com',
        password: 'Password123!',
      });

      // Mark the user as unconfirmed
      setMockUserUnconfirmed('unconfirmed@example.com', true);

      const loginRes = await signInWithPassword('unconfirmed@example.com', 'Password123!');
      expect(loginRes.success).toBe(false);
      expect(loginRes.isUnconfirmed).toBe(true);
      expect(loginRes.error).toMatch(/email confirmation/i);
    });

    it('returns status 401 and isUnconfirmed: true from POST /api/auth/login for unconfirmed accounts', async () => {
      await signUpWithPassword({
        displayName: 'UnconfirmedAgent',
        email: 'agent-unconfirmed@example.com',
        password: 'Password123!',
      });
      setMockUserUnconfirmed('agent-unconfirmed@example.com', true);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: 'agent-unconfirmed@example.com',
          password: 'Password123!',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.isUnconfirmed).toBe(true);
      expect(data.email).toBe('agent-unconfirmed@example.com');
      expect(data.error).toMatch(/email confirmation/i);
      expect(data.error).toMatch(/spam|junk/i);
    });

    it('resends confirmation email successfully via resendConfirmationEmail', async () => {
      const result = await resendConfirmationEmail('agent-unconfirmed@example.com');
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/confirmation email resent/i);
    });

    it('resends confirmation email via POST /api/auth/login action: "resend_confirmation"', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend_confirmation',
          email: 'agent-unconfirmed@example.com',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/confirmation email.*resent/i);
    });

    it('validates email requirement for action: "resend_confirmation"', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend_confirmation',
          email: '',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/email address is required/i);
    });
  });

  describe('2. Password Reset Resend & Account Enumeration Protection', () => {
    it('resends password reset email successfully via sendPasswordResetEmail', async () => {
      const result = await sendPasswordResetEmail('player@example.com');
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('resends password reset email via POST /api/auth/login action: "resend_password_reset"', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend_password_reset',
          email: 'player@example.com',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/password.*recovery.*link|password.*reset/i);
    });

    it('preserves generic success message to prevent account enumeration', async () => {
      // Non-existent email should still succeed from user perspective
      const result = await sendPasswordResetEmail('nonexistent-ghost-user@example.com');
      expect(result.success).toBe(true);
    });
  });

  describe('3. File & Template Static Compliance Checks', () => {
    const rootDir = path.resolve(__dirname, '..');

    it('SpamJunkNotice.tsx exists and contains essential deliverability advice', () => {
      const filePath = path.join(rootDir, 'components/auth/SpamJunkNotice.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/spam/i);
      expect(content).toMatch(/junk/i);
      expect(content).toMatch(/promotions/i);
      expect(content).toMatch(/resend|send again/i);
      expect(content).toMatch(/cooldown/i);
    });

    it('SpamJunkNotice.tsx obeys Rule 21 (Zero Tailwind utility classes)', () => {
      const filePath = path.join(rootDir, 'components/auth/SpamJunkNotice.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check that no forbidden Tailwind class names appear in className="..."
      const forbiddenTailwind = /\bclassName=["'][^"']*\b(flex|grid|absolute|relative|rounded-md|p-[0-9]|m-[0-9]|text-[a-z]+-[0-9]+)\b[^"']*["']/;
      expect(forbiddenTailwind.test(content)).toBe(false);
      // Ensure it uses cq-spam-* scoped classes
      expect(content).toContain('cq-spam-card');
      expect(content).toContain('cq-spam-heading');
      expect(content).toContain('cq-spam-checklist');
    });

    it('app/globals.css defines all required cq-spam-* and cq-unconfirmed-* classes', () => {
      const cssPath = path.join(rootDir, 'app/globals.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('.cq-spam-card');
      expect(css).toContain('.cq-spam-resend-btn');
      expect(css).toContain('.cq-spam-heading');
      expect(css).toContain('.cq-unconfirmed-card');
      expect(css).toContain('.cq-unconfirmed-actions');

      // Verify mobile-first touch target min-height: 44px
      expect(css).toMatch(/\.cq-spam-resend-btn\s*\{[^}]*min-height:\s*44px/);
    });

    it('FastPlayerOnboardForm.tsx integrates SpamJunkNotice and preserves core quest drawing entry rule', () => {
      const formPath = path.join(rootDir, 'components/FastPlayerOnboardForm.tsx');
      const content = fs.readFileSync(formPath, 'utf-8');

      expect(content).toContain('SpamJunkNotice');
      expect(content).toContain('cq-unconfirmed-card');
      expect(content).toContain('handleResendConfirmation');
      expect(content).toContain('handleResendPasswordReset');

      // Rule: Account creation alone does NOT grant cash drawing entries
      expect(content).toMatch(/Never\s+imply\s+a\s+free\s+drawing\s+entry/i);
    });

    it('app/auth/forgot-password/page.tsx integrates SpamJunkNotice, allows editing email and resending', () => {
      const pagePath = path.join(rootDir, 'app/auth/forgot-password/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('SpamJunkNotice');
      expect(content).toContain('handleResend');
      expect(content).toContain('setSent(false)');
    });

    it('app/auth/confirm/page.tsx guides user to forgot-password / login on expired/invalid links', () => {
      const pagePath = path.join(rootDir, 'app/auth/confirm/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('/auth/forgot-password');
      expect(content).toContain('/auth/login');
      expect(content).toMatch(/spam|junk/i);
    });

    it('app/auth/reset-password/page.tsx guides user to forgot-password on expired recovery session', () => {
      const pagePath = path.join(rootDir, 'app/auth/reset-password/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('/auth/forgot-password');
      expect(content).toMatch(/spam.*junk/i);
    });

    it('app/auth/login/page.tsx handles unconfirmedError and renders SpamJunkNotice and resend action', () => {
      const pagePath = path.join(rootDir, 'app/auth/login/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('unconfirmedError');
      expect(content).toContain('cq-unconfirmed-card');
      expect(content).toContain('SpamJunkNotice');
      expect(content).toContain('handleResendConfirmation');
    });
  });
});
