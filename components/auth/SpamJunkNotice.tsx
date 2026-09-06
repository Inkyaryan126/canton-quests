'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Check,
} from 'lucide-react';

export interface SpamJunkNoticeProps {
  /**
   * Flow context: signup confirmation, password reset, or unconfirmed account login.
   */
  type: 'signup_confirmation' | 'password_reset' | 'unconfirmed_login';
  /**
   * The destination email address where the message was sent.
   */
  email: string;
  /**
   * Optional async callback to resend the email.
   */
  onResend?: () => Promise<{ success: boolean; message?: string; error?: string }>;
  /**
   * Optional label for the resend button.
   */
  resendButtonLabel?: string;
  /**
   * Optional callback allowing the user to change or retype their email.
   */
  onChangeEmail?: () => void;
  /**
   * Optional change email label.
   */
  changeEmailLabel?: string;
}

export default function SpamJunkNotice({
  type,
  email,
  onResend,
  resendButtonLabel,
  onChangeEmail,
  changeEmailLabel = 'Need to change your email address?',
}: SpamJunkNoticeProps) {
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 30-second cooldown timer after resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResendClick = async () => {
    if (!onResend || isResending || cooldown > 0) return;
    setIsResending(true);
    setResendStatus(null);

    try {
      const result = await onResend();
      if (result.success) {
        setCooldown(30);
        setResendStatus({
          type: 'success',
          message:
            result.message ||
            (type === 'password_reset'
              ? `Password-reset link resent to ${email}! Check your inbox — and your Spam, Junk, or Promotions folder.`
              : `Confirmation email resent to ${email}! Check your inbox — and your Spam, Junk, or Promotions folder.`),
        });
      } else {
        setResendStatus({
          type: 'error',
          message: result.error || 'Failed to resend email. Please wait a moment and try again.',
        });
      }
    } catch (err: unknown) {
      setResendStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to resend. Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const defaultButtonLabel =
    resendButtonLabel ||
    (type === 'password_reset' ? 'Resend Reset Link' : 'Resend Confirmation Email');

  return (
    <div className="cq-spam-card" role="region" aria-label="Spam and Junk Folder Guidance">
      {/* Prominent Eyebrow Badge */}
      <div className="cq-spam-badge-row">
        <span className="cq-spam-badge">
          <span className="cq-spam-badge-live" aria-hidden="true" />
          <span>CHECK SPAM / JUNK / PROMOTIONS</span>
        </span>
      </div>

      {/* Main Notice Heading */}
      <h2 className="cq-spam-heading">
        ⚠ Don&apos;t See The Email? Check Spam or Junk
      </h2>

      {/* Plain-English Explanation */}
      <p className="cq-spam-text">
        These emails can occasionally land in <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> because Canton Quests may be a new sender to your email provider and this is an automated account message. Email providers sometimes filter new automated senders until they recognize them.
      </p>

      {/* Quick Action Checklist */}
      <ul className="cq-spam-checklist">
        <li className="cq-spam-checklist-item">
          <Search size={14} className="cq-spam-checklist-icon" aria-hidden="true" />
          <span>
            Check your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folder right now.
          </span>
        </li>
        <li className="cq-spam-checklist-item">
          <Clock size={14} className="cq-spam-checklist-icon" aria-hidden="true" />
          <span>
            Allow 1–2 minutes for automated mail delivery across provider networks.
          </span>
        </li>
        {email && (
          <li className="cq-spam-checklist-item">
            <Mail size={14} className="cq-spam-checklist-icon" aria-hidden="true" />
            <span>
              Verify sent destination: <strong style={{ wordBreak: 'break-all' }}>{email}</strong>
            </span>
          </li>
        )}
      </ul>

      {/* Resend status feedback */}
      {resendStatus && (
        <div
          className={
            resendStatus.type === 'success'
              ? 'cq-spam-status-success'
              : 'cq-spam-status-error'
          }
          role="status"
          aria-live="polite"
        >
          {resendStatus.type === 'success' ? (
            <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
          )}
          <span>{resendStatus.message}</span>
        </div>
      )}

      {/* Resend & Action Row */}
      {(onResend || onChangeEmail) && (
        <div className="cq-spam-resend-row">
          {onResend && (
            <button
              type="button"
              onClick={handleResendClick}
              disabled={isResending || cooldown > 0}
              className="cq-spam-resend-btn"
              aria-label={cooldown > 0 ? `Resend in ${cooldown} seconds` : defaultButtonLabel}
            >
              {isResending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                  <span>Resending...</span>
                </>
              ) : cooldown > 0 ? (
                <>
                  <Clock size={14} aria-hidden="true" />
                  <span>Send Again ({cooldown}s)</span>
                </>
              ) : (
                <>
                  <Mail size={14} aria-hidden="true" />
                  <span>{defaultButtonLabel}</span>
                </>
              )}
            </button>
          )}

          {onChangeEmail && (
            <button
              type="button"
              onClick={onChangeEmail}
              className="cq-spam-action-link"
            >
              {changeEmailLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
