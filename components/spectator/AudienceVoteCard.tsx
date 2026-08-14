'use client';

import { useState, useEffect } from 'react';
import { PublicAudienceEvent, PublicAudienceEventOption } from '@/lib/types';

interface AudienceVoteCardProps {
  event: PublicAudienceEvent | null;
  options: PublicAudienceEventOption[];
  votedOptionId: string | null;
  onVoteSubmitted: (optionId: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  isSystemDisabled?: boolean;
}

export default function AudienceVoteCard({
  event,
  options,
  votedOptionId,
  onVoteSubmitted,
  isSystemDisabled = false,
}: AudienceVoteCardProps) {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Countdown Timer
  useEffect(() => {
    if (!event || !event.endsAt) {
      setTimeLeftStr('');
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(event.endsAt!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeftStr('00:00');
        return;
      }

      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [event]);

  if (!event) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 text-center space-y-3">
        <div className="text-3xl">⌛</div>
        <h3 className="text-base font-bold text-white uppercase tracking-wider">
          No Active Audience Vote Right Now
        </h3>
        <p className="text-xs text-gray-400 max-w-md mx-auto">
          The Game Master has not opened an active audience vote yet. Stay tuned to this channel for live host broadcasts and community prompts.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[11px] font-mono border border-cyan-500/30">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          LISTENING FOR LIVE BROADCASTS
        </div>
      </div>
    );
  }

  const totalVotes = options.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);
  const isCancelled = event.status === 'cancelled';
  const isOverridden = (event as any).isManuallyOverridden || (event as any).status === 'overridden';
  const isResolved = ['resolved', 'effect_applied'].includes(event.status);
  const isVotingActive = event.status === 'voting_active' && !event.isPaused && !isSystemDisabled && !isCancelled;

  const handleVoteClick = async (optionId: string) => {
    if (!isVotingActive || isSubmitting || votedOptionId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await onVoteSubmitted(optionId);
    setIsSubmitting(false);

    if (!res.success) {
      if (res.code === 'DUPLICATE_VOTE' || res.code === 'VOTE_LIMIT_REACHED') {
        setErrorMessage('⚠️ You have already voted in this decision (1 vote limit per spectator).');
      } else if (res.code === 'SPECTATOR_SYSTEM_DISABLED') {
        setErrorMessage('🚫 Spectator voting is currently paused by the Game Master.');
      } else {
        setErrorMessage(res.error || 'Failed to submit vote. Please try again.');
      }
    }
  };

  return (
    <div className="glass-panel p-5 md:p-6 rounded-2xl border-2 border-amber-500/40 bg-[#161e2e]/90 shadow-xl shadow-amber-500/10 space-y-5">
      {/* Event Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-warning text-[10px] uppercase font-bold tracking-wider font-mono">
              🗳️ LIVE SPECTATOR VOTE
            </span>
            {event.publicTargetDescription && (
              <span className="badge badge-medium text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                🎯 {event.publicTargetDescription}
              </span>
            )}
            <span className="text-[10px] font-mono text-gray-400">
              🔒 1 Vote Per Spectator
            </span>
          </div>

          <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug">
            {event.title}
          </h2>

          {event.description && (
            <p className="text-xs text-gray-300 leading-relaxed">
              {event.description}
            </p>
          )}
        </div>

        {/* Status / Timer Badge */}
        <div className="text-right flex flex-col items-end space-y-1">
          {isSystemDisabled ? (
            <span className="px-3 py-1 bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-mono font-bold rounded-lg animate-pulse">
              ⛔ SYSTEM FROZEN
            </span>
          ) : isCancelled ? (
            <span className="px-3 py-1 bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-mono font-bold rounded-lg">
              ⛔ DECISION CANCELLED
            </span>
          ) : isOverridden ? (
            <span className="px-3 py-1 bg-purple-950/80 border border-purple-500/60 text-purple-300 text-xs font-mono font-bold rounded-lg">
              ⚡ GM OVERRIDE
            </span>
          ) : event.isPaused ? (
            <span className="px-3 py-1 bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-mono font-bold rounded-lg animate-pulse">
              ⏸️ VOTING PAUSED
            </span>
          ) : isVotingActive ? (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl font-mono text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span className="text-[10px] uppercase font-bold">VOTE CLOSES IN:</span>
              <span className="font-extrabold text-sm text-white font-mono tracking-wider">
                {timeLeftStr || 'ACTIVE'}
              </span>
            </div>
          ) : isResolved ? (
            <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-bold rounded-lg">
              🏆 RESOLVED
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs font-mono font-bold rounded-lg">
              🔒 TALLYING CLOSED
            </span>
          )}

          <div className="text-[10px] font-mono text-gray-400">
            Total Community Votes: <span className="text-white font-bold">{totalVotes}</span>
          </div>
        </div>
      </div>

      {/* Error / Warning Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs font-mono flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-gray-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* User Voted Confirmation Banner */}
      {votedOptionId && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
          <span className="text-base">✅</span>
          <div>
            <span className="font-bold block">YOUR VOTE IS RECORDED!</span>
            <span className="text-[10px] text-emerald-400/80">
              Thank you for influencing Canton Quests field operations.
            </span>
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-3">
        {options.map((opt) => {
          const voteCount = opt.voteCount || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isUserVoted = votedOptionId === opt.id;
          const isWinningOption = isResolved && event.publicWinningOptionId === opt.id;

          return (
            <div
              key={opt.id}
              className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                isWinningOption
                  ? 'border-emerald-500/80 bg-emerald-950/30 glow-emerald'
                  : isUserVoted
                  ? 'border-amber-500/80 bg-amber-950/20'
                  : 'border-gray-800 bg-obsidian/60 hover:border-gray-700'
              }`}
            >
              {/* Progress Bar Background fill */}
              <div
                className={`absolute top-0 left-0 bottom-0 transition-all duration-700 ease-out ${
                  isWinningOption
                    ? 'bg-emerald-500/20'
                    : isUserVoted
                    ? 'bg-amber-500/20'
                    : 'bg-cyan-500/10'
                }`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative z-10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isWinningOption && (
                      <span className="text-xs bg-emerald-500 text-obsidian font-extrabold px-2 py-0.5 rounded font-mono uppercase">
                        🏆 WINNER
                      </span>
                    )}
                    {isUserVoted && (
                      <span className="text-xs bg-amber-500 text-obsidian font-extrabold px-2 py-0.5 rounded font-mono uppercase">
                        ✓ YOUR VOTE
                      </span>
                    )}
                    <span className="font-extrabold text-sm text-white">
                      {opt.optionLabel}
                    </span>
                  </div>

                  <div className="font-mono text-xs text-right">
                    <span className="font-extrabold text-amber-400">{percentage}%</span>
                    <span className="text-gray-400 text-[10px] ml-1.5">({voteCount} votes)</span>
                  </div>
                </div>

                {opt.optionDescription && (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {opt.optionDescription}
                  </p>
                )}

                {/* Vote Action Button */}
                {isVotingActive && !votedOptionId && (
                  <div className="pt-1">
                    <button
                      onClick={() => handleVoteClick(opt.id)}
                      disabled={isSubmitting}
                      className="btn btn-primary text-xs py-2 px-4 w-full sm:w-auto font-mono font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                    >
                      {isSubmitting ? (
                        <span>Submitting...</span>
                      ) : (
                        <span>⚡ VOTE FOR THIS OPTION</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
