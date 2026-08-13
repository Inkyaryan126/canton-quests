'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setCurrentPlayer, completeSpectatorConversion } from '@/lib/game-engine';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Consent Checkboxes
  const [ageConsent, setAgeConsent] = useState<boolean>(false);
  const [safetyConsent, setSafetyConsent] = useState<boolean>(false);
  const [isMinorChecked, setIsMinorChecked] = useState<boolean>(false);

  // Step 2: Player Callsign
  const [callsign, setCallsign] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleCompleteConversion = async () => {
    if (!callsign.trim()) {
      setErrorMsg('Please enter an Agent Callsign.');
      return;
    }

    const trimmed = callsign.trim();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Initial candidate player profile via game engine
      const player = setCurrentPlayer(trimmed, '⚡');

      // 2. Derive token for server conversion (verified Supabase JWT if configured, or local dev token)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
          }
        } catch {
          // ignore
        }
      } else {
        headers['x-player-token'] = player.id;
      }

      // 3. Call server conversion endpoint
      const res = await fetch('/api/game/spectator', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'convert_to_player',
          callsign: trimmed,
          playerId: player.id,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Server conversion failed');
      }

      // 4. Synchronize canonical game engine state & spectator profile with server-derived DB player ID
      const finalPlayerId = data.session?.convertedToPlayerId || player.id;
      completeSpectatorConversion(trimmed, finalPlayerId);

      onClose();
      router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete conversion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-lg w-full p-6 rounded-3xl border-2 border-amber-500/50 bg-[#161e2e] shadow-2xl shadow-amber-500/20 space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold p-1"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-mono border border-amber-500/30 font-bold">
            ⚡ WALK-UP PLAYING CONVERSION • STEP {step} OF 2
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {step === 1 ? '🛡️ Safety & Age Gate Onboarding' : '🎮 Choose Your Agent Callsign'}
          </h2>
          <p className="text-xs text-gray-300">
            {step === 1
              ? 'Before entering Canton physical field operations, verify safety compliance.'
              : 'Set your player handle to start scanning emblems and earning XP.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs font-mono">
            {errorMsg}
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
              className="btn btn-primary text-xs py-3 px-6 w-full font-mono font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Recording Consent...' : 'CONTINUE TO AGENT SETUP →'}
            </button>
          </div>
        )}

        {/* Step 2: Agent Callsign & Conversion */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2 bg-obsidian/70 p-4 rounded-xl border border-gray-800">
              <label className="block text-xs font-mono font-bold text-amber-400 uppercase">
                Agent Display Callsign
              </label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="e.g. CipherAgent_2026, SquadLeader, NeonFox"
                maxLength={24}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400">
                This callsign will appear on Canton leaderboard rankings and quest achievements.
              </p>
            </div>

            <button
              onClick={handleCompleteConversion}
              className="btn btn-primary text-xs py-3 px-6 w-full font-mono font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform"
            >
              🚀 ENTER THE GAME NOW →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
