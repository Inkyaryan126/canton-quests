'use client';

import { useState } from 'react';
import { Team, TeamMember, Player } from '@/lib/types';
import { createTeam, joinTeamByCode } from '@/lib/game-engine';

interface TeamHubProps {
  eventId: string;
  currentPlayer: Player;
  team?: Team;
  teamMembers: TeamMember[];
  onTeamUpdated: () => void;
}

export default function TeamHub({
  eventId,
  currentPlayer,
  team,
  teamMembers,
  onTeamUpdated,
}: TeamHubProps) {
  const [mode, setMode] = useState<'view' | 'create' | 'join'>('view');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [avatarSymbolInput, setAvatarSymbolInput] = useState('🛡️');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamNameInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      createTeam(eventId, teamNameInput, currentPlayer.id, avatarSymbolInput);
      setMessage({ text: `Squad "${teamNameInput}" formed successfully!`, isError: false });
      setTeamNameInput('');
      setMode('view');
      onTeamUpdated();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create team', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = joinTeamByCode(joinCodeInput, currentPlayer.id, eventId);
      if (res.success) {
        setMessage({ text: res.message, isError: false });
        setJoinCodeInput('');
        setMode('view');
        onTeamUpdated();
      } else {
        setMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to join team', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyJoinCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="glass-panel p-5 md:p-6 mb-6 border-cyan-500/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            👥 Squad Operations
          </h2>
          <p className="text-xs text-gray-400 font-mono">
            Form or join a team to tackle Canton Quests together
          </p>
        </div>

        {team && (
          <span className="badge badge-medium bg-cyan-500/20 text-cyan-400 border-cyan-500/40">
            SQUAD ACTIVE
          </span>
        )}
      </div>

      {message && (
        <div
          className={`p-3 text-xs font-mono rounded-xl mb-4 ${
            message.isError
              ? 'bg-red-950/40 border border-red-800 text-red-300'
              : 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
          }`}
        >
          {message.isError ? '❌' : '✅'} {message.text}
        </div>
      )}

      {/* CASE 1: Player is on a Team */}
      {team ? (
        <div className="space-y-4">
          {/* Team Header Card */}
          <div className="p-4 bg-obsidian/80 rounded-xl border border-cyan-800/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-2xl">
                {team.avatarSymbol || '🛡️'}
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{team.name}</h3>
                <span className="text-xs font-mono text-cyan-400">
                  {teamMembers.length} Active {teamMembers.length === 1 ? 'Agent' : 'Agents'}
                </span>
              </div>
            </div>

            {/* Join Code Card */}
            <div className="bg-cyan-950/40 border border-cyan-800/60 px-4 py-2 rounded-xl text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Squad Join Code</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-400 font-extrabold text-base tracking-widest">
                  {team.joinCode}
                </span>
                <button
                  onClick={() => copyJoinCode(team.joinCode)}
                  className="text-xs font-mono text-cyan-300 hover:text-white bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-700/50"
                  title="Copy join code"
                >
                  {copiedCode ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Team Members List */}
          <div>
            <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">
              Squad Roster ({teamMembers.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teamMembers.map((m) => {
                const isCaptain = m.playerId === team.captainId;
                const isCurrent = m.playerId === currentPlayer.id;
                return (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                      isCurrent
                        ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                        : 'bg-card border-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{m.player?.avatarUrl || '⚡'}</span>
                      <span className="font-bold">{m.player?.displayName || 'Agent'}</span>
                      {isCurrent && <span className="text-[10px] text-amber-400">(You)</span>}
                    </div>
                    {isCaptain && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                        👑 Captain
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* CASE 2: Player is Solo & Can Create or Join */
        <div className="space-y-4">
          {mode === 'view' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-3xl mx-auto">
                🛡️
              </div>
              <p className="text-xs text-gray-300 font-mono max-w-md mx-auto">
                You are playing solo. Form a squad with friends or join an existing team using a 6-character code!
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setMode('create')}
                  className="btn btn-primary text-xs py-2.5 px-5 font-bold"
                >
                  ➕ Form New Squad
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="btn btn-cyan text-xs py-2.5 px-5 font-bold"
                >
                  🔑 Join Squad with Code
                </button>
              </div>
            </div>
          )}

          {/* CREATE FORM */}
          {mode === 'create' && (
            <form onSubmit={handleCreateTeam} className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-white font-mono">Form a New Canton Squad</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-gray-400 block mb-1">Squad Name</label>
                  <input
                    type="text"
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    placeholder="e.g. Canton Cipher Syndicate"
                    className="input-field text-sm"
                    maxLength={30}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-gray-400 block mb-1">Squad Emblem</label>
                  <div className="flex gap-2">
                    {['🛡️', '⚔️', '🦅', '⚡', '🔥', '🏆', '🎯'].map((sym) => (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => setAvatarSymbolInput(sym)}
                        className={`text-xl p-2 rounded-xl border transition-all ${
                          avatarSymbolInput === sym
                            ? 'bg-amber-500/20 border-amber-400 scale-110'
                            : 'bg-card border-gray-800 hover:border-gray-600'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !teamNameInput.trim()}
                  className="btn btn-primary text-xs py-2.5 px-4 font-bold flex-1"
                >
                  {isSubmitting ? 'Forming Squad...' : '🚀 Initialize Squad'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="btn btn-secondary text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* JOIN FORM */}
          {mode === 'join' && (
            <form onSubmit={handleJoinTeam} className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-white font-mono">Join Existing Squad</h3>
              <div>
                <label className="text-xs font-mono text-gray-400 block mb-1">
                  Enter 6-Character Squad Join Code
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CQ-7X9K"
                  className="input-field font-mono uppercase text-amber-400 tracking-widest text-center text-lg font-bold"
                  maxLength={10}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !joinCodeInput.trim()}
                  className="btn btn-cyan text-xs py-2.5 px-4 font-bold flex-1"
                >
                  {isSubmitting ? 'Joining...' : '🔑 Transmit Join Code'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="btn btn-secondary text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
