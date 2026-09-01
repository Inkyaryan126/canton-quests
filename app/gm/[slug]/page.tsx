'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import { QuestEvent } from '@/lib/types';
import { CityStateProjection } from '@/lib/city-state';

/**
 * Canton Quests — Game Master Control Room
 * ============================================
 * The GM interface OVER the systems built across this session — Live City
 * Events, the Field NPC/Courier system, Watchers, the Founder's Cipher
 * Finale, Player search, and a generic audit log — reusing the existing
 * admin authorization exactly (GET/POST /api/admin/session,
 * POST /api/admin/live), the same pattern app/admin/live/page.tsx already
 * uses. Nothing here is a second admin system: every action dispatches
 * through the same /api/admin/live route the Live Director dashboard does.
 *
 * Mobile-first accordion layout (native <details>/<summary> — large touch
 * targets, no extra JS state needed per section) with the mission's 9
 * required sections plus the audit log.
 */

function sendAdminAction(payload: Record<string, any>) {
  return fetch('/api/admin/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden" open={defaultOpen}>
      <summary className="px-4 py-3 cursor-pointer select-none font-display font-black uppercase tracking-wide text-sm text-amber-400 bg-stone-900/60 flex items-center justify-between">
        {title}
      </summary>
      <div className="p-4 space-y-3 text-xs">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-stone-400 font-mono">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full px-3 py-2.5 bg-black/60 border border-stone-700 rounded-lg text-white text-sm min-h-[44px]';
const btnCls = 'px-4 py-3 rounded-lg font-bold uppercase tracking-wide text-xs min-h-[44px] active:scale-95 transition-transform';

export default function GameMasterControlRoom() {
  const params = useParams();
  const slug = params.slug as string;

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [cityState, setCityState] = useState<CityStateProjection | null>(null);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [watcherEligibleCount, setWatcherEligibleCount] = useState<number>(0);
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const [newLiveEvent, setNewLiveEvent] = useState({ eventType: 'CITY_EVENT', title: '', description: '', sectorScope: '', multiplierValue: '', progressTarget: '', durationMinutes: '60' });
  const [newNpc, setNewNpc] = useState({ npcType: 'COURIER', aliasName: '', publicDescription: '', broadAreaLabel: '', rewardXp: '25', claimLimit: '' });
  const [broadcast, setBroadcast] = useState({ headline: '', body: '', tone: 'announcement', targetChannel: 'all' });
  const [emergencyBroadcast, setEmergencyBroadcast] = useState('');
  const [watcherActivatePlayerId, setWatcherActivatePlayerId] = useState('');
  const [finaleForm, setFinaleForm] = useState({ requiredSigilCount: '3', requiresWatcherEligibility: false, finalAnswer: '', finalDestinationReveal: '', confirm: false });

  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => setIsAdminAuthenticated(!!data.isAdmin))
      .catch(() => setIsAdminAuthenticated(false))
      .finally(() => setIsCheckingAuth(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    const data = await res.json();
    if (res.ok && data.isAdmin) {
      setIsAdminAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError(data.error || 'Invalid Game Master passphrase.');
    }
  };

  const refreshAll = useCallback(() => {
    fetch(`/api/game/events/${slug}`)
      .then((res) => res.json())
      .then((data) => setEvent(data.event || null));

    fetch(`/api/game/city-state?eventSlug=${slug}`)
      .then((res) => res.json())
      .then((data) => setCityState(data.cityState || null));

    sendAdminAction({ action: 'list_live_events', eventSlug: slug }).then((d) => d.success && setLiveEvents(d.liveEvents || []));
    sendAdminAction({ action: 'list_field_npcs', eventSlug: slug }).then((d) => d.success && setNpcs(d.npcs || []));
    sendAdminAction({ action: 'list_pending_submissions', eventSlug: slug }).then((d) => d.success && setPendingSubmissions(d.submissions || []));
    sendAdminAction({ action: 'get_watcher_eligible_count', eventSlug: slug }).then((d) => d.success && setWatcherEligibleCount(d.count || 0));
    sendAdminAction({ action: 'get_admin_audit_log', eventSlug: slug, limit: 40 }).then((d) => d.success && setAuditLog(d.entries || []));
  }, [slug]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [isAdminAuthenticated, refreshAll]);

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const runAction = async (payload: Record<string, any>, successMsg: string) => {
    const res = await sendAdminAction({ ...payload, eventSlug: slug });
    if (res.success) {
      notify(successMsg);
      refreshAll();
    } else {
      notify(`Failed: ${res.error}`);
    }
    return res;
  };

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Checking access…</div>;
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Header />
        <main className="flex-1 max-w-sm w-full mx-auto p-6 flex flex-col justify-center space-y-4">
          <div className="text-center space-y-2">
            <div className="text-3xl">🎛️</div>
            <h1 className="text-lg font-black font-display uppercase text-amber-400">Game Master Control Room</h1>
            <p className="text-xs text-stone-400">Server-verified Game Master authorization required.</p>
          </div>
          {authError && <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-lg text-red-300 text-xs">{authError}</div>}
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Game Master secret"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className={inputCls}
            />
            <button type="submit" className={`${btnCls} w-full bg-amber-500 text-black`}>
              Authenticate
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3 pb-24">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black font-display uppercase text-amber-400">GM Control Room</h1>
          <span className="text-[10px] font-mono text-stone-500">{slug}</span>
        </div>

        {notice && <div className="p-3 bg-cyan-950/60 border border-cyan-500/50 rounded-lg text-cyan-300 text-xs">{notice}</div>}

        {/* 1. MISSION STATUS */}
        <Section title="Mission Status" defaultOpen>
          {event && (
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>Phase: <strong className="text-amber-400">{event.currentPhase}</strong></div>
              <div>Status: <strong>{event.status}</strong></div>
              <div>Emergency Pause: <strong className={event.isPaused ? 'text-red-400' : 'text-emerald-400'}>{event.isPaused ? 'PAUSED' : 'ACTIVE'}</strong></div>
            </div>
          )}
          {cityState && (
            <div className="grid grid-cols-2 gap-2 font-mono pt-2 border-t border-stone-800">
              <div>Registered: <strong>{cityState.registeredPlayers}</strong></div>
              <div>Active: <strong>{cityState.activePlayers}</strong></div>
              <div>Quests completed: <strong>{cityState.totalCompletedQuests}</strong></div>
              <div>Player links: <strong>{cityState.totalPlayerLinks}</strong></div>
              <div>Signal carriers: <strong>{cityState.totalSignalCarriers}</strong></div>
              <div>Convergence-ready: <strong className="text-amber-400">{cityState.convergenceReadyPlayers}</strong></div>
              <div>Arts progress: <strong>{Math.round(cityState.districtProgress.arts.fractionComplete * 100)}%</strong></div>
              <div>Challenge progress: <strong>{Math.round(cityState.districtProgress.challenge.fractionComplete * 100)}%</strong></div>
              <div>Secret progress: <strong>{Math.round(cityState.districtProgress.secret.fractionComplete * 100)}%</strong></div>
              <div>Sigils 1/2/3: <strong>{cityState.sigilDistribution.oneDistrict}/{cityState.sigilDistribution.twoDistricts}/{cityState.sigilDistribution.threeDistricts}</strong></div>
            </div>
          )}
        </Section>

        {/* 2. LIVE EVENTS */}
        <Section title="Live Events">
          <div className="space-y-2">
            {liveEvents.length === 0 && <p className="text-stone-500">No active live events.</p>}
            {liveEvents.map((le) => (
              <div key={le.id} className="p-2 bg-stone-900 rounded-lg flex items-center justify-between">
                <span>{le.eventType}: {le.title}</span>
                <button className="text-red-400 text-[10px] font-bold" onClick={() => runAction({ action: 'cancel_live_event', liveEventId: le.id }, 'Live event cancelled')}>
                  CANCEL
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800">
            <Field label="Type">
              <select className={inputCls} value={newLiveEvent.eventType} onChange={(e) => setNewLiveEvent({ ...newLiveEvent, eventType: e.target.value })}>
                {['FLASH_DROP', 'CITY_EVENT', 'SECTOR_EVENT', 'XP_MULTIPLIER', 'TEMPORARY_UNLOCK', 'SPECIAL_OBJECTIVE'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration (min)">
              <input className={inputCls} type="number" value={newLiveEvent.durationMinutes} onChange={(e) => setNewLiveEvent({ ...newLiveEvent, durationMinutes: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Title">
                <input className={inputCls} value={newLiveEvent.title} onChange={(e) => setNewLiveEvent({ ...newLiveEvent, title: e.target.value })} />
              </Field>
            </div>
            {newLiveEvent.eventType === 'XP_MULTIPLIER' && (
              <Field label="Multiplier">
                <input className={inputCls} type="number" step="0.1" value={newLiveEvent.multiplierValue} onChange={(e) => setNewLiveEvent({ ...newLiveEvent, multiplierValue: e.target.value })} />
              </Field>
            )}
          </div>
          <button
            className={`${btnCls} w-full bg-amber-500 text-black`}
            onClick={() => {
              const now = new Date();
              const ends = new Date(now.getTime() + (parseInt(newLiveEvent.durationMinutes, 10) || 60) * 60000);
              runAction(
                {
                  action: 'create_live_event',
                  eventType: newLiveEvent.eventType,
                  title: newLiveEvent.title || newLiveEvent.eventType,
                  startsAt: now.toISOString(),
                  endsAt: ends.toISOString(),
                  multiplierValue: newLiveEvent.multiplierValue ? parseFloat(newLiveEvent.multiplierValue) : undefined,
                  activateImmediately: true,
                },
                'Live event activated'
              );
              setNewLiveEvent({ ...newLiveEvent, title: '' });
            }}
          >
            Activate Now
          </button>
        </Section>

        {/* 3. COMMANDER */}
        <Section title="Commander">
          <Field label="Headline">
            <input className={inputCls} value={broadcast.headline} onChange={(e) => setBroadcast({ ...broadcast, headline: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className={inputCls} rows={2} value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tone">
              <select className={inputCls} value={broadcast.tone} onChange={(e) => setBroadcast({ ...broadcast, tone: e.target.value })}>
                {['announcement', 'theatrical', 'urgent', 'flash'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Channel">
              <select className={inputCls} value={broadcast.targetChannel} onChange={(e) => setBroadcast({ ...broadcast, targetChannel: e.target.value })}>
                {['all', 'players', 'spectators', 'internal'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <button
            className={`${btnCls} w-full bg-amber-500 text-black`}
            onClick={() => runAction({ action: 'create_host_broadcast', headline: broadcast.headline, body: broadcast.body, tone: broadcast.tone, targetChannel: broadcast.targetChannel, isPublished: true }, 'Transmission sent')}
          >
            Send Transmission
          </button>
        </Section>

        {/* 4. NPC / COURIER */}
        <Section title="NPC / Courier">
          <div className="space-y-2">
            {npcs.map((npc) => (
              <div key={npc.id} className="p-2 bg-stone-900 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{npc.aliasName} ({npc.npcType})</span>
                  <span className={npc.isActive ? 'text-emerald-400' : 'text-stone-500'}>{npc.isActive ? 'ACTIVE' : 'OFF'}</span>
                </div>
                <div className="text-stone-400 font-mono">Claims: {npc.currentClaims}{npc.claimLimit ? `/${npc.claimLimit}` : ''} · Code: {npc.currentCode}</div>
                <div className="flex gap-2">
                  <button className="text-cyan-400 text-[10px] font-bold" onClick={() => runAction({ action: 'set_field_npc_active', npcId: npc.id, isActive: !npc.isActive }, 'NPC updated')}>
                    {npc.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                  </button>
                  <button className="text-amber-400 text-[10px] font-bold" onClick={() => runAction({ action: 'rotate_field_npc_code', npcId: npc.id }, 'Code rotated')}>
                    ROTATE CODE
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800">
            <Field label="Type">
              <select className={inputCls} value={newNpc.npcType} onChange={(e) => setNewNpc({ ...newNpc, npcType: e.target.value })}>
                {['COURIER', 'WITNESS', 'MESSENGER', 'KEYHOLDER', 'COMMANDER_AGENT'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Reward XP">
              <input className={inputCls} type="number" value={newNpc.rewardXp} onChange={(e) => setNewNpc({ ...newNpc, rewardXp: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Alias name">
                <input className={inputCls} value={newNpc.aliasName} onChange={(e) => setNewNpc({ ...newNpc, aliasName: e.target.value })} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Public description">
                <input className={inputCls} value={newNpc.publicDescription} onChange={(e) => setNewNpc({ ...newNpc, publicDescription: e.target.value })} />
              </Field>
            </div>
          </div>
          <button
            className={`${btnCls} w-full bg-amber-500 text-black`}
            onClick={() => {
              runAction({ action: 'create_field_npc', npcType: newNpc.npcType, aliasName: newNpc.aliasName, publicDescription: newNpc.publicDescription, broadAreaLabel: newNpc.broadAreaLabel, rewardXp: parseInt(newNpc.rewardXp, 10) || 0, claimLimit: newNpc.claimLimit ? parseInt(newNpc.claimLimit, 10) : undefined }, 'NPC created');
              setNewNpc({ ...newNpc, aliasName: '', publicDescription: '' });
            }}
          >
            Create NPC
          </button>
        </Section>

        {/* 5. PLAYERS */}
        <Section title="Players">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Search callsign or ID…" value={playerQuery} onChange={(e) => setPlayerQuery(e.target.value)} />
            <button
              className={`${btnCls} bg-amber-500 text-black shrink-0`}
              onClick={() => sendAdminAction({ action: 'search_players', eventSlug: slug, query: playerQuery }).then((d) => d.success && setPlayerResults(d.players || []))}
            >
              Search
            </button>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {playerResults.map((p) => (
              <div key={p.playerId} className="p-2 bg-stone-900 rounded-lg font-mono text-[11px] space-y-0.5">
                <div className="font-bold text-sm">{p.displayName} <span className="text-stone-500">#{p.rank}</span></div>
                <div>Path: {p.path || '—'} · XP: {p.totalXp} · Quests: {p.questsCompletedCount}</div>
                <div>Entries: {p.drawingEntriesCount} · Sigils: {p.unlockedSigilCount} · Badges: {p.badgeCount}</div>
                <div>Roles: {p.personalRoleTypes.join(', ') || '—'}</div>
                <button className="text-amber-400 font-bold" onClick={() => runAction({ action: 'activate_watcher_eligibility', playerId: p.playerId, detail: 'GM manual activation' }, 'Watcher eligibility granted')}>
                  GRANT WATCHER SIGNAL
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. QUEST OPERATIONS */}
        <Section title="Quest Operations">
          <p className="text-stone-400 font-mono text-xs">{pendingSubmissions.length} pending approval{pendingSubmissions.length === 1 ? '' : 's'}</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingSubmissions.length === 0 && (
              <p className="text-stone-500 font-mono text-xs py-2">No pending photo or manual submissions.</p>
            )}
            {pendingSubmissions.map((s) => {
              const photoSrc = s.proofUrl || (s.submittedContent && (s.submittedContent.startsWith('http') || s.submittedContent.startsWith('/')) ? s.submittedContent : null);
              return (
                <div key={s.submissionId} className="p-3 bg-stone-900 border border-stone-800 rounded-xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-white">{s.questTitle}</div>
                      <div className="text-amber-400 font-mono text-xs">
                        {s.playerDisplayName ? `Agent: ${s.playerDisplayName}` : `Player: ${s.playerId}`}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-stone-800 text-stone-300 font-mono text-[10px] rounded uppercase shrink-0">
                      {s.proofType}
                    </span>
                  </div>

                  {photoSrc && (
                    <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-stone-700 bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoSrc}
                        alt="Submitted proof"
                        style={{ width: '100%', height: 'auto', maxHeight: '192px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                      />
                    </div>
                  )}

                  {s.submittedContent && !photoSrc && (
                    <div className="p-2 bg-black/50 border border-stone-800 rounded text-stone-300 font-mono text-xs break-words">
                      {s.submittedContent}
                    </div>
                  )}

                  <div className="text-stone-500 font-mono text-[10px]">
                    Submitted: {new Date(s.submittedAt).toLocaleTimeString()} · {new Date(s.submittedAt).toLocaleDateString()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-mono text-xs font-bold uppercase rounded-lg transition-transform"
                      onClick={async () => {
                        await fetch('/api/game/admin/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: s.submissionId, status: 'verified' }) });
                        notify(`Approved: ${s.questTitle}`);
                        refreshAll();
                      }}
                    >
                      ✓ APPROVE
                    </button>
                    <button
                      className="min-h-[44px] px-3 py-2 bg-red-900/80 hover:bg-red-800 active:scale-[0.98] text-red-200 font-mono text-xs font-bold uppercase rounded-lg border border-red-700/50 transition-transform"
                      onClick={async () => {
                        await fetch('/api/game/admin/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: s.submissionId, status: 'rejected', feedback: 'Reviewed by Game Master' }) });
                        notify(`Rejected: ${s.questTitle}`);
                        refreshAll();
                      }}
                    >
                      ✕ REJECT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 7. WATCHERS */}
        <Section title="Watchers">
          <p className="font-mono">Eligible players: <strong className="text-amber-400">{watcherEligibleCount}</strong></p>
          <Field label="Manually activate for player ID">
            <input className={inputCls} value={watcherActivatePlayerId} onChange={(e) => setWatcherActivatePlayerId(e.target.value)} />
          </Field>
          <button
            className={`${btnCls} w-full bg-amber-500 text-black`}
            onClick={() => watcherActivatePlayerId && runAction({ action: 'activate_watcher_eligibility', playerId: watcherActivatePlayerId, detail: 'GM manual activation' }, 'Watcher eligibility granted')}
          >
            Grant Watcher Signal
          </button>
        </Section>

        {/* 8. FINALE (high-risk) */}
        <Section title="Finale">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Required sigils">
              <input className={inputCls} type="number" min={1} max={3} value={finaleForm.requiredSigilCount} onChange={(e) => setFinaleForm({ ...finaleForm, requiredSigilCount: e.target.value })} />
            </Field>
            <Field label="Requires Watcher">
              <select className={inputCls} value={finaleForm.requiresWatcherEligibility ? '1' : '0'} onChange={(e) => setFinaleForm({ ...finaleForm, requiresWatcherEligibility: e.target.value === '1' })}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </Field>
          </div>
          <Field label="Final answer (plaintext — hashed server-side, never stored as typed)">
            <input className={inputCls} type="password" value={finaleForm.finalAnswer} onChange={(e) => setFinaleForm({ ...finaleForm, finalAnswer: e.target.value })} />
          </Field>
          <Field label="Destination reveal (shown on completion)">
            <input className={inputCls} value={finaleForm.finalDestinationReveal} onChange={(e) => setFinaleForm({ ...finaleForm, finalDestinationReveal: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={finaleForm.confirm} onChange={(e) => setFinaleForm({ ...finaleForm, confirm: e.target.checked })} />
            I confirm this changes the live Master Cipher answer.
          </label>
          <button
            className={`${btnCls} w-full bg-amber-500 text-black`}
            disabled={!finaleForm.confirm || !finaleForm.finalAnswer}
            onClick={() => runAction({ action: 'configure_finale', requiredSigilCount: parseInt(finaleForm.requiredSigilCount, 10), requiresWatcherEligibility: finaleForm.requiresWatcherEligibility, finalAnswer: finaleForm.finalAnswer, finalDestinationReveal: finaleForm.finalDestinationReveal, confirm: true }, 'Finale configured')}
          >
            Save Finale Configuration
          </button>

          <div className="pt-2 border-t border-stone-800 space-y-2">
            <p className="text-red-400 font-bold uppercase text-[10px]">High-risk phase controls — require confirmation</p>
            <div className="flex flex-wrap gap-2">
              {(['final_hours', 'finale', 'ended'] as const).map((phase) => (
                <button
                  key={phase}
                  className={`${btnCls} bg-red-950 border border-red-600 text-red-300`}
                  onClick={() => {
                    if (!window.confirm(`Set event phase to "${phase.toUpperCase()}"? This is a high-risk, Mission-wide change.`)) return;
                    runAction({ action: 'set_phase', phase, confirm: true }, `Phase set to ${phase}`);
                  }}
                >
                  Open {phase.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* 9. EMERGENCY */}
        <Section title="Emergency">
          <button
            className={`${btnCls} w-full ${event?.isPaused ? 'bg-emerald-500 text-black' : 'bg-red-600 text-white'}`}
            onClick={() => runAction({ action: 'toggle_pause', isPaused: !event?.isPaused, reason: 'GM Control Room action' }, event?.isPaused ? 'Event resumed' : 'Event paused')}
          >
            {event?.isPaused ? 'Resume Submissions' : 'Emergency Pause (block all submissions)'}
          </button>
          <Field label="Emergency broadcast message">
            <input className={inputCls} value={emergencyBroadcast} onChange={(e) => setEmergencyBroadcast(e.target.value)} />
          </Field>
          <button
            className={`${btnCls} w-full bg-red-600 text-white`}
            onClick={() => emergencyBroadcast && runAction({ action: 'create_host_broadcast', headline: 'COMMANDER ALERT', body: emergencyBroadcast, tone: 'urgent', targetChannel: 'all', isPublished: true }, 'Emergency broadcast sent')}
          >
            Send Emergency Broadcast
          </button>
        </Section>

        {/* AUDIT LOG */}
        <Section title="Audit Log">
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-[10px]">
            {auditLog.length === 0 && <p className="text-stone-500">No recorded mutations yet.</p>}
            {auditLog.map((entry) => (
              <div key={entry.id} className="p-2 bg-stone-900 rounded-lg">
                <div className="text-amber-400 font-bold">{entry.action}</div>
                <div className="text-stone-400">{entry.actor} · {new Date(entry.createdAt).toLocaleString()}</div>
                {entry.targetType && <div className="text-stone-500">{entry.targetType}: {entry.targetId}</div>}
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
