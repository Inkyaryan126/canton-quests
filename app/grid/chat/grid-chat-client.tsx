'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  ChevronRight,
  CircleDot,
  Flag,
  Hash,
  LockKeyhole,
  MessageCircle,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Signal,
  Users,
  X,
} from 'lucide-react';
import type {
  GridChatChannelSummary,
  GridChatDistrictOption,
  GridChatMessagePage,
  GridChatMessageView,
  GridChatPartyMember,
} from '@/lib/grid/core/chat-types';

interface ChannelsResponse {
  success: boolean;
  enabled: boolean;
  channels: GridChatChannelSummary[];
  error?: string;
}

interface MessageResponse extends GridChatMessagePage {
  success: boolean;
  error?: string;
}

function channelIcon(type: GridChatChannelSummary['channelType']) {
  if (type === 'direct') return LockKeyhole;
  if (type === 'party') return Users;
  if (type === 'district') return Hash;
  if (type === 'system') return Radio;
  return Signal;
}

function nonce(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `chat:${crypto.randomUUID()}`;
  }
  return `chat:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function GridChatClient() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<GridChatChannelSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GridChatMessageView[]>([]);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showDirect, setShowDirect] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [districts, setDistricts] = useState<GridChatDistrictOption[]>([]);
  const [districtBusyId, setDistrictBusyId] = useState<string | null>(null);
  const [showParty, setShowParty] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [showPartyInvite, setShowPartyInvite] = useState(false);
  const [partyCallsign, setPartyCallsign] = useState('');
  const [partyBusy, setPartyBusy] = useState(false);
  const [showPartyManage, setShowPartyManage] = useState(false);
  const [partyMembers, setPartyMembers] = useState<GridChatPartyMember[]>([]);
  const [partyManageLoading, setPartyManageLoading] = useState(false);
  const [partyManageBusyId, setPartyManageBusyId] = useState<string | null>(null);
  const [directCallsign, setDirectCallsign] = useState('');
  const [startingDirect, setStartingDirect] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<GridChatMessageView | null>(null);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => channels.find((channel) => channel.channelId === selectedId) ?? null,
    [channels, selectedId],
  );

  const loadChannels = useCallback(async () => {
    try {
      const response = await fetch('/api/grid/chat/channels', { cache: 'no-store' });
      const body = (await response.json()) as ChannelsResponse;
      if (!response.ok || !body.success) throw new Error(body.error || 'Comms unavailable');
      setEnabled(body.enabled);
      setChannels(body.channels ?? []);
      setChannelError(null);
      setSelectedId((current) => {
        if (current && body.channels.some((channel) => channel.channelId === current)) return current;
        return body.channels[0]?.channelId ?? null;
      });
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'Comms unavailable');
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/grid/chat/channels/${encodeURIComponent(channelId)}/messages?limit=80`,
        { cache: 'no-store' },
      );
      const body = (await response.json()) as MessageResponse;
      if (!response.ok || !body.success) throw new Error(body.error || 'Message feed unavailable');
      setMessages(body.messages ?? []);
      setMessageError(null);
      void fetch(`/api/grid/chat/channels/${encodeURIComponent(channelId)}/read`, {
        method: 'PUT',
      });
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Message feed unavailable');
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!selectedId || enabled !== true) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
    const timer = window.setInterval(() => {
      void loadMessages(selectedId, true);
      void loadChannels();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [enabled, loadChannels, loadMessages, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedId]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;
    const outgoing = draft;
    setDraft('');
    setSending(true);
    setMessageError(null);
    try {
      const response = await fetch(`/api/grid/chat/channels/${encodeURIComponent(selectedId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: outgoing, clientNonce: nonce() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Message failed');
      await loadMessages(selectedId, true);
      await loadChannels();
    } catch (error) {
      setDraft(outgoing);
      setMessageError(error instanceof Error ? error.message : 'Message failed');
    } finally {
      setSending(false);
    }
  }

  async function loadDistricts() {
    setChannelError(null);
    try {
      const response = await fetch('/api/grid/chat/districts', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'District comms unavailable');
      setDistricts(body.districts ?? []);
      setShowDistricts(true);
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'District comms unavailable');
    }
  }

  async function joinDistrict(district: GridChatDistrictOption) {
    if (districtBusyId) return;
    if (district.joined && district.channelId) {
      setSelectedId(district.channelId);
      setShowDistricts(false);
      return;
    }
    setDistrictBusyId(district.districtId);
    try {
      const response = await fetch('/api/grid/chat/districts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: district.districtId }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to join district comms');
      await loadChannels();
      setSelectedId(body.channelId);
      setShowDistricts(false);
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'Unable to join district comms');
    } finally {
      setDistrictBusyId(null);
    }
  }

  async function createParty(event: FormEvent) {
    event.preventDefault();
    if (creatingParty || partyName.trim().length < 2) return;
    setCreatingParty(true);
    setChannelError(null);
    try {
      const response = await fetch('/api/grid/chat/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: partyName }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to create party');
      setPartyName('');
      setShowParty(false);
      await loadChannels();
      setSelectedId(body.channelId);
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'Unable to create party');
    } finally {
      setCreatingParty(false);
    }
  }

  async function inviteParty(event: FormEvent) {
    event.preventDefault();
    if (!selected || selected.channelType !== 'party' || partyBusy || partyCallsign.trim().length < 2) return;
    setPartyBusy(true);
    setMessageError(null);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: partyCallsign }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to invite player');
      setPartyCallsign('');
      setShowPartyInvite(false);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to invite player');
    } finally {
      setPartyBusy(false);
    }
  }

  async function loadPartyMembers(open = true) {
    if (!selected || selected.channelType !== 'party') return;
    if (open) setShowPartyManage(true);
    setPartyManageLoading(true);
    setMessageError(null);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/members`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load party members');
      setPartyMembers(body.members ?? []);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to load party members');
    } finally {
      setPartyManageLoading(false);
    }
  }

  async function setPartyRole(member: GridChatPartyMember, role: 'member' | 'moderator') {
    if (!selected || selected.channelType !== 'party' || partyManageBusyId) return;
    setPartyManageBusyId(member.playerId);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/members/${encodeURIComponent(member.playerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to update party role');
      await loadPartyMembers(false);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to update party role');
    } finally {
      setPartyManageBusyId(null);
    }
  }

  async function removePartyMember(member: GridChatPartyMember) {
    if (!selected || selected.channelType !== 'party' || partyManageBusyId) return;
    if (!window.confirm(`Remove ${member.callsign} from ${selected.displayName}?`)) return;
    setPartyManageBusyId(member.playerId);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/members/${encodeURIComponent(member.playerId)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to remove party member');
      await loadPartyMembers(false);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to remove party member');
    } finally {
      setPartyManageBusyId(null);
    }
  }

  async function transferPartyOwner(member: GridChatPartyMember) {
    if (!selected || selected.channelType !== 'party' || selected.memberRole !== 'owner' || partyManageBusyId) return;
    if (!window.confirm(`Transfer ownership of ${selected.displayName} to ${member.callsign}?`)) return;
    setPartyManageBusyId(member.playerId);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/owner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: member.playerId }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to transfer party ownership');
      await loadChannels();
      await loadPartyMembers(false);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to transfer party ownership');
    } finally {
      setPartyManageBusyId(null);
    }
  }

  async function leaveParty() {
    if (!selected || selected.channelType !== 'party' || partyBusy) return;
    if (!window.confirm(`Leave ${selected.displayName}?`)) return;
    setPartyBusy(true);
    try {
      const response = await fetch(`/api/grid/chat/parties/${encodeURIComponent(selected.channelId)}/leave`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to leave party');
      setSelectedId(null);
      await loadChannels();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unable to leave party');
    } finally {
      setPartyBusy(false);
    }
  }

  async function startDirect(event: FormEvent) {
    event.preventDefault();
    if (!directCallsign.trim() || startingDirect) return;
    setStartingDirect(true);
    setChannelError(null);
    try {
      const response = await fetch('/api/grid/chat/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: directCallsign }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to open direct chat');
      setDirectCallsign('');
      setShowDirect(false);
      await loadChannels();
      setSelectedId(body.channelId);
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : 'Unable to open direct chat');
    } finally {
      setStartingDirect(false);
    }
  }

  async function blockPlayer(message: GridChatMessageView) {
    if (message.isMine || message.sender.isSystem || !message.sender.playerId) return;
    if (!window.confirm(`Block ${message.sender.callsign}? Their messages will disappear from your feed.`)) return;
    try {
      const response = await fetch('/api/grid/chat/block', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: message.sender.playerId, blocked: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Block failed');
      if (selectedId) await loadMessages(selectedId, true);
      await loadChannels();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Block failed');
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!reportingMessage || submittingReport) return;
    setSubmittingReport(true);
    try {
      const response = await fetch(
        `/api/grid/chat/messages/${encodeURIComponent(reportingMessage.messageId)}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reportReason, details: reportDetails }),
        },
      );
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Report failed');
      setReportingMessage(null);
      setReportDetails('');
      setReportReason('inappropriate');
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Report failed');
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loadingChannels || enabled === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white">
        <div className="font-mono text-xs font-black uppercase tracking-[.25em] text-cyan-300">Connecting to Grid Comms…</div>
      </main>
    );
  }

  if (enabled === false) {
    return (
      <main className="min-h-screen bg-[#050607] px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href="/grid" className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-cyan-300">
            <ArrowLeft size={14} /> City Board
          </Link>
          <div className="mt-16 overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-950/25 via-black to-black p-8 sm:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[.2em] text-amber-300">
              <CircleDot size={11} /> Network Standby
            </div>
            <h1 className="mt-5 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">Grid Comms</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-400">
              The player communications network is being wired into Canton City 001. City channels, district comms, private parties, and direct messages will live here.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['CITY', 'The shared Canton signal'],
                ['DISTRICT', 'Talk inside zones and neighborhoods'],
                ['PARTY', 'Private scrimmage and squad comms'],
                ['DIRECT', 'One-to-one player messages'],
              ].map(([label, note]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <div className="font-mono text-xs font-black tracking-widest text-cyan-300">{label}</div>
                  <div className="mt-2 text-xs leading-relaxed text-stone-500">{note}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs text-stone-600">
              <ShieldCheck size={14} className="text-emerald-400" /> Blocking, reporting, rate limits, and minor-safety rules are built into the foundation.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/70 lg:w-[340px] lg:border-b-0 lg:border-r">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <Link href="/grid" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-cyan-300">
                <ArrowLeft size={13} /> Grid
              </Link>
              <button type="button" onClick={() => void loadChannels()} className="rounded-lg border border-white/10 p-2 text-stone-500 hover:text-white" aria-label="Refresh channels">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Canton // City 001</div>
                <h1 className="mt-1 font-display text-3xl font-black uppercase">Comms</h1>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => void loadDistricts()} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-stone-300 hover:border-cyan-300/30 hover:text-cyan-300">
                  <Hash size={12} /> District
                </button>
                <button type="button" onClick={() => setShowParty(true)} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-stone-300 hover:border-cyan-300/30 hover:text-cyan-300">
                  <Users size={12} /> Party
                </button>
                <button type="button" onClick={() => setShowDirect(true)} className="inline-flex items-center gap-1 rounded-xl bg-cyan-300 px-2.5 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-black hover:bg-cyan-200">
                  <Plus size={12} /> Direct
                </button>
              </div>
            </div>
            {channelError && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">{channelError}</div>}
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:max-h-[calc(100vh-155px)] lg:space-y-1 lg:overflow-y-auto lg:px-3">
            {channels.map((channel) => {
              const Icon = channelIcon(channel.channelType);
              const active = channel.channelId === selectedId;
              return (
                <button
                  key={channel.channelId}
                  type="button"
                  onClick={() => setSelectedId(channel.channelId)}
                  className={`min-w-[220px] rounded-2xl border p-3 text-left transition lg:min-w-0 lg:w-full ${
                    active ? 'border-cyan-300/45 bg-cyan-300/10' : 'border-transparent hover:border-white/10 hover:bg-white/[.035]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${active ? 'bg-cyan-300 text-black' : 'bg-white/5 text-stone-500'}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-black uppercase">{channel.displayName}</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-600">{channel.channelType}</div>
                    </div>
                    {channel.unreadCount > 0 && (
                      <span className="min-w-6 rounded-full bg-amber-300 px-1.5 py-1 text-center font-mono text-[9px] font-black text-black">
                        {Math.min(channel.unreadCount, 99)}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-stone-700 lg:hidden" />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-1 flex-col lg:min-h-screen">
          {selected ? (
            <>
              <header className="border-b border-white/10 bg-black/35 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
                      <MessageCircle size={17} />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-black uppercase">{selected.displayName}</h2>
                      <div className="font-mono text-[9px] uppercase tracking-[.18em] text-stone-600">
                        {selected.channelType === 'direct' ? 'Private player channel · server protected' : `${selected.channelType} channel · Canton Grid`}
                      </div>
                    </div>
                  </div>
                  {selected.channelType === 'party' && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => void loadPartyMembers(true)} className="rounded-xl border border-white/10 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-stone-300 hover:border-cyan-300/20 hover:text-cyan-300">
                        Members
                      </button>
                      {(selected.memberRole === 'owner' || selected.memberRole === 'moderator') && (
                        <button type="button" onClick={() => setShowPartyInvite(true)} className="rounded-xl border border-cyan-300/20 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-cyan-300 hover:bg-cyan-300/10">
                          + Invite
                        </button>
                      )}
                      <button type="button" onClick={() => void leaveParty()} disabled={partyBusy} className="rounded-xl border border-white/10 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-stone-500 hover:border-rose-300/20 hover:text-rose-300 disabled:opacity-30">
                        Leave
                      </button>
                    </div>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
                {loadingMessages ? (
                  <div className="py-16 text-center font-mono text-xs uppercase tracking-widest text-stone-600">Reading signal…</div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto mt-16 max-w-md text-center">
                    <Signal size={30} className="mx-auto text-stone-700" />
                    <h3 className="mt-4 font-display text-xl font-black uppercase text-stone-300">Channel Quiet</h3>
                    <p className="mt-2 text-sm text-stone-600">Be the first player to break the silence.</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-3">
                    {messages.map((message) => (
                      <article key={message.messageId} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`group max-w-[88%] rounded-2xl border px-4 py-3 sm:max-w-[75%] ${
                          message.sender.isSystem
                            ? 'border-amber-300/35 bg-amber-300/[.07] shadow-[0_0_30px_rgba(252,211,77,.05)]'
                            : message.isMine
                              ? 'border-cyan-300/25 bg-cyan-300/10'
                              : 'border-white/10 bg-white/[.035]'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`font-display text-xs font-black uppercase ${message.sender.isSystem ? 'text-amber-300' : message.isMine ? 'text-cyan-300' : 'text-stone-300'}`}>
                              {message.sender.isSystem ? `SYSTEM // ${message.sender.callsign}` : message.isMine ? 'YOU' : message.sender.callsign}
                            </span>
                            <span className="font-mono text-[9px] text-stone-700">{timeLabel(message.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-200">{message.body}</p>
                          {!message.isMine && !message.sender.isSystem && (
                            <div className="mt-2 flex gap-3 opacity-50 transition group-hover:opacity-100">
                              <button type="button" onClick={() => setReportingMessage(message)} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-600 hover:text-amber-300">
                                <Flag size={10} /> Report
                              </button>
                              <button type="button" onClick={() => void blockPlayer(message)} className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-600 hover:text-rose-300">
                                <Ban size={10} /> Block
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-black/65 p-3 sm:p-5">
                {messageError && <div className="mx-auto mb-3 max-w-4xl rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{messageError}</div>}
                <form onSubmit={sendMessage} className="mx-auto flex max-w-4xl items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={1}
                    maxLength={1200}
                    placeholder={`Message ${selected.displayName}…`}
                    className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm text-white outline-none placeholder:text-stone-700 focus:border-cyan-300/40"
                  />
                  <button type="submit" disabled={sending || !draft.trim()} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Send message">
                    <Send size={18} />
                  </button>
                </form>
                <div className="mx-auto mt-2 flex max-w-4xl justify-between px-1 font-mono text-[9px] uppercase tracking-wider text-stone-700">
                  <span>{draft.length}/1200</span>
                  <span>Rate-limited · Reportable · Blockable</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <MessageCircle size={34} className="mx-auto text-stone-700" />
                <h2 className="mt-4 font-display text-2xl font-black uppercase">No Channel Selected</h2>
              </div>
            </div>
          )}
        </section>
      </div>

      {showDistricts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Local Comms</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">District Channels</h2>
              </div>
              <button type="button" onClick={() => setShowDistricts(false)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-600">Join by approved Grid district. Your precise location is never broadcast to the channel.</p>
            <div className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto">
              {districts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 p-5 text-center text-xs text-stone-600">No district channels are available yet.</div>
              ) : districts.map((district) => (
                <button key={district.districtId} type="button" onClick={() => void joinDistrict(district)} disabled={Boolean(districtBusyId)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left hover:border-cyan-300/25 hover:bg-cyan-300/5 disabled:opacity-40">
                  <div>
                    <div className="font-display text-sm font-black uppercase">{district.name}</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-stone-600">{district.joined ? 'Joined' : 'Available'}</div>
                  </div>
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider text-cyan-300">{districtBusyId === district.districtId ? 'Joining…' : district.joined ? 'Open' : 'Join'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={createParty} className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Private Squad</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">Create Party</h2>
              </div>
              <button type="button" onClick={() => setShowParty(false)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <input autoFocus value={partyName} onChange={(event) => setPartyName(event.target.value)} maxLength={60} placeholder="Party / scrimmage name" className="mt-6 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
            <p className="mt-3 text-xs leading-relaxed text-stone-600">Private parties are designed for squads and scrimmages. Minor accounts are restricted from private party chat in the first release.</p>
            <button disabled={creatingParty || partyName.trim().length < 2} className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-mono text-xs font-black uppercase tracking-widest text-black disabled:opacity-30">{creatingParty ? 'Creating…' : 'Create Party Channel'}</button>
          </form>
        </div>
      )}

      {showPartyManage && selected?.channelType === 'party' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-cyan-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">{selected.displayName}</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">Party Roster</h2>
              </div>
              <button type="button" onClick={() => setShowPartyManage(false)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">
              {partyManageLoading ? (
                <div className="py-10 text-center font-mono text-[10px] uppercase tracking-widest text-stone-600">Reading roster…</div>
              ) : partyMembers.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-600">No active party members.</div>
              ) : partyMembers.map((member) => {
                const canOwnerManage = selected.memberRole === 'owner' && member.role !== 'owner';
                const canModeratorRemove = selected.memberRole === 'moderator' && member.role === 'member';
                return (
                  <div key={member.playerId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 font-display text-sm font-black text-stone-400">{member.callsign.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="font-display text-sm font-black uppercase">{member.callsign}</div>
                        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-stone-600">{member.role}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {canOwnerManage && member.role === 'member' && (
                        <button type="button" disabled={Boolean(partyManageBusyId)} onClick={() => void setPartyRole(member, 'moderator')} className="rounded-lg border border-cyan-300/20 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-cyan-300 disabled:opacity-30">Promote</button>
                      )}
                      {canOwnerManage && member.role === 'moderator' && (
                        <button type="button" disabled={Boolean(partyManageBusyId)} onClick={() => void setPartyRole(member, 'member')} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-stone-400 disabled:opacity-30">Demote</button>
                      )}
                      {canOwnerManage && (
                        <button type="button" disabled={Boolean(partyManageBusyId)} onClick={() => void transferPartyOwner(member)} className="rounded-lg border border-amber-300/20 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-amber-300 disabled:opacity-30">Make Owner</button>
                      )}
                      {(canOwnerManage || canModeratorRemove) && (
                        <button type="button" disabled={Boolean(partyManageBusyId)} onClick={() => void removePartyMember(member)} className="rounded-lg border border-rose-300/20 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-rose-300 disabled:opacity-30">Remove</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showPartyInvite && selected?.channelType === 'party' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={inviteParty} className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">{selected.displayName}</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">Invite Player</h2>
              </div>
              <button type="button" onClick={() => setShowPartyInvite(false)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <input autoFocus value={partyCallsign} onChange={(event) => setPartyCallsign(event.target.value)} maxLength={80} placeholder="Exact callsign" className="mt-6 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
            <button disabled={partyBusy || partyCallsign.trim().length < 2} className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-mono text-xs font-black uppercase tracking-widest text-black disabled:opacity-30">{partyBusy ? 'Inviting…' : 'Invite to Party'}</button>
          </form>
        </div>
      )}

      {showDirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={startDirect} className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Private Channel</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">Start Direct Chat</h2>
              </div>
              <button type="button" onClick={() => setShowDirect(false)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <label className="mt-6 block font-mono text-[10px] font-bold uppercase tracking-widest text-stone-500">Player Callsign</label>
            <input
              autoFocus
              value={directCallsign}
              onChange={(event) => setDirectCallsign(event.target.value)}
              maxLength={80}
              placeholder="Exact callsign"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
            />
            <p className="mt-3 text-xs leading-relaxed text-stone-600">Direct messaging is restricted for minor accounts in the first Grid communications release.</p>
            <button disabled={startingDirect || directCallsign.trim().length < 2} className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-mono text-xs font-black uppercase tracking-widest text-black disabled:opacity-30">
              {startingDirect ? 'Opening Channel…' : 'Open Direct Channel'}
            </button>
          </form>
        </div>
      )}

      {reportingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={submitReport} className="w-full max-w-md rounded-3xl border border-amber-400/20 bg-[#0a0c0e] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Safety Signal</div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">Report Message</h2>
              </div>
              <button type="button" onClick={() => setReportingMessage(null)} className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
            </div>
            <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-6 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none">
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="safety">Safety concern</option>
              <option value="cheating">Cheating / manipulation</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
            <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} rows={4} placeholder="Optional details…" className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40" />
            <button disabled={submittingReport} className="mt-5 w-full rounded-2xl bg-amber-300 px-4 py-3 font-mono text-xs font-black uppercase tracking-widest text-black disabled:opacity-30">
              {submittingReport ? 'Sending Report…' : 'Submit Report'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
