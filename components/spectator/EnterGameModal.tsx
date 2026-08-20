'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Player, StartingPath } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { KeyRound, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

interface EnterGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdate: (params: { ageAcknowledged: boolean; safetyAcknowledged: boolean; isMinor?: boolean }) => Promise<void>;
}

export default function EnterGameModal({
  isOpen,
  onClose,
  onSessionUpdate,
}: EnterGameModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Consent Checkboxes
  const [ageConsent, setAgeConsent] = useState<boolean>(false);
  const [safetyConsent, setSafetyConsent] = useState<boolean>(false);
  const [isMinorChecked, setIsMinorChecked] = useState<boolean>(false);

  // Step 2: Player Callsign, Email, & Starting Path
  const [callsign, setCallsign] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<StartingPath>('family');

  // Step 3: OTP Code
  const [otpCode, setOtpCode] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStep1Next = async () => {
    if (!ageConsent || !safetyConsent) {
      setErrorMsg('You must acknowledge both age eligibility and safety rules to enter the game.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Record consent and sticky minor state on server
      await onSessionUpdate({
        ageAcknowledged: true,
        safetyAcknowledged: true,
        isMinor: isMinorChecked,
      });
      setStep(2);
    } catch {
      setErrorMsg('Failed to update spectator consent session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Send OTP Code
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim() || callsign.trim().length < 2) {
      setErrorMsg('Please enter an Agent Callsign (at least 2 characters).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address for instant verification.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: email.trim().toLowerCase(),
          selectedStartingPath: selectedPath,
          acquisitionSource: 'spectator_conversion',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setInfoMsg(data.message || `Verification code sent to ${email}.`);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Verify OTP & Complete Conversion
  const handleCompleteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the confirmation code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: email.trim().toLowerCase(),
          token: otpCode.trim(),
          displayName: callsign.trim(),
          selectedStartingPath: selectedPath,
          acquisitionSource: 'spectator_conversion',
          isMinor: isMinorChecked,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check the code and try again.');
      }

      const player = data.player;
      const sessionToken = data.session?.access_token;

      if (typeof window !== 'undefined' && window.localStorage && player) {
        window.localStorage.setItem('canton_quests_current_player', JSON.stringify(player));
        window.localStorage.setItem('canton_player_profile', JSON.stringify(player));
        if (sessionToken) {
          window.localStorage.setItem('canton_auth_token', sessionToken);
        }
      }

      // Convert spectator session on server
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
        await fetch('/api/game/spectator', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'convert_to_player',
            callsign: player.displayName,
            playerId: player.id,
            selectedStartingPath: selectedPath,
          }),
        });
      } catch {
        // Continue even if spectator linkage note fails
      }

      onClose();
      router.push('/profile');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete conversion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: email.trim().toLowerCase(),
          selectedStartingPath: selectedPath,
          acquisitionSource: 'spectator_conversion',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setInfoMsg('New verification code sent! Check your inbox.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-lg w-full p-6 rounded-3xl border-2 border-amber-500/50 bg-[#161e2e] shadow-2xl shadow-amber-500/20 space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-mono border border-amber-500/30 font-bold">
            ⚡ WALK-UP PLAYING CONVERSION • STEP {step} OF 3
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {step === 1
              ? '🛡️ Safety & Age Gate Onboarding'
              : step === 2
              ? '🎮 Choose Callsign & Verify Account'
              : '✉️ Enter Confirmation Code'}
          </h2>
          <p className="text-xs text-gray-300">
            {step === 1
              ? 'Before entering Canton physical field operations, verify safety compliance.'
              : step === 2
              ? 'Set your player handle and email for passwordless verification.'
              : `Enter the confirmation code sent to ${email}.`}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs font-mono">
            ⚠️ {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-mono">
            ✉️ {infoMsg}
          </div>
        )}

        {/* Step 1: Safety & Age Gate */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-3 bg-obsidian/70 p-4 rounded-xl border border-gray-800 text-xs text-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConsent}
                  onChange={(e) => setAgeConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  <strong className="text-white block">Age Eligibility Confirmation</strong>
                  I confirm I am 18 years or older, or participating with parent/guardian consent.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-800">
                <input
                  type="checkbox"
                  checked={safetyConsent}
                  onChange={(e) => setSafetyConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  <strong className="text-white block">Agent Field Safety Rules</strong>
                  I agree to obey traffic laws, remain in public areas, respect private property, and never enter hazardous zones.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-800 text-cyan-300">
                <input
                  type="checkbox"
                  checked={isMinorChecked}
                  onChange={(e) => setIsMinorChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-400 focus:ring-cyan-400"
                />
                <span>
                  <strong className="text-cyan-400 block">Minor Participant Designation (Under 18)</strong>
                  Check if you are under 18 years old. Minor participants receive enhanced public privacy protection.
                </span>
              </label>
            </div>

            <button
              onClick={handleStep1Next}
              disabled={isSubmitting || !ageConsent || !safetyConsent}
              className="btn btn-primary text-xs py-3 px-6 w-full font-mono font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Recording Consent...' : 'CONTINUE TO AGENT SETUP →'}
            </button>
          </div>
        )}

        {/* Step 2: Agent Callsign, Email & Starting Path */}
        {step === 2 && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
            <div className="space-y-2 bg-obsidian/70 p-4 rounded-xl border border-gray-800">
              <label className="block text-xs font-mono font-bold text-amber-400 uppercase">
                Agent Display Callsign *
              </label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="e.g. CipherAgent_2026, ApexHunter, NeonFox"
                maxLength={24}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 bg-obsidian/70 p-4 rounded-xl border border-gray-800">
              <label className="block text-xs font-mono font-bold text-amber-400 uppercase">
                Email for Verification & Prizes *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400">
                We will send a confirmation code to verify your account without passwords.
              </p>
            </div>

            <div className="space-y-2 bg-obsidian/70 p-4 rounded-xl border border-gray-800">
              <label className="block text-xs font-mono font-bold text-amber-400 uppercase">
                Select Your Starting Path
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'family', label: 'Family', desc: 'Downtown Arts', color: 'border-amber-500 text-amber-300' },
                  { id: 'challenge', label: 'Challenge', desc: 'Athletic Skill', color: 'border-red-500 text-red-300' },
                  { id: 'secret', label: 'Secret', desc: 'Ciphers & Lore', color: 'border-purple-500 text-purple-300' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPath(p.id as StartingPath)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      selectedPath === p.id
                        ? `${p.color} bg-white/10 font-bold scale-[1.02]`
                        : 'border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-mono">{p.label}</div>
                    <div className="text-[10px] opacity-75 truncate">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary text-xs py-3 px-6 w-full font-mono font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              {isSubmitting ? 'Sending Magic Code...' : 'SEND MAGIC CODE →'}
            </button>
          </form>
        )}

        {/* Step 3: Enter Confirmation Code */}
        {step === 3 && (
          <form onSubmit={handleCompleteConversion} className="space-y-4 pt-2">
            <div className="space-y-2 bg-obsidian/70 p-4 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold text-amber-400 uppercase">
                  Confirmation Code *
                </label>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-[11px] font-mono text-gray-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Change Email
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter confirmation code"
                autoFocus
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-900 border-2 border-amber-500/60 text-white font-mono text-xl tracking-widest text-center focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-amber-400 hover:text-amber-300 underline disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
                <span>{isResending ? 'Resending...' : 'Resend Code'}</span>
              </button>
              <span className="text-gray-400 text-[11px]">Valid for 15 min</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary text-xs py-3 px-6 w-full font-mono font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              {isSubmitting ? 'Verifying...' : '🚀 VERIFY & ENTER CANTON QUESTS →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
