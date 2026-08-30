'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';
import ThreePathSelector from '@/components/ThreePathSelector';
import CreatePlayerIdentityPanel from '@/components/CreatePlayerIdentityPanel';

function sanitizeNext(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !raw.includes('\0')) {
    return raw;
  }
  return undefined;
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get('next'));
  const [requiresPath, setRequiresPath] = useState(true);
  const [eventSlug, setEventSlug] = useState('canton-weekend-1');
  const [resolved, setResolved] = useState(!next);

  useEffect(() => {
    if (!next) return;

    const eventMatch = next.match(/^\/events\/([^/]+)/);
    if (eventMatch) {
      const slug = eventMatch[1];
      setEventSlug(slug);
      fetch(`/api/game/events/${slug}`)
        .then((res) => res.json())
        .then((data: { event?: { requiresPath?: boolean } }) => {
          setRequiresPath(Boolean(data.event?.requiresPath));
        })
        .catch(() => {})
        .finally(() => setResolved(true));
      return;
    }

    // A physical QR scan (e.g. every Fair QR Hunt signal) redirects here as
    // /qr/[code] before the player has an account. That destination isn't
    // self-describing about which Mission it belongs to, so without this
    // lookup requiresPath silently kept its canton-weekend-1 default (true)
    // for ANY non-/events/ destination — showing the Family/Challenge/Secret
    // path selector to a first-time Fair player even though the Fair is
    // explicitly path-free.
    const qrMatch = next.match(/^\/qr\/([^/?]+)/);
    if (qrMatch) {
      const code = decodeURIComponent(qrMatch[1]);
      fetch(`/api/qr/lookup?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data: { found?: boolean; eventSlug?: string; requiresPath?: boolean }) => {
          if (data.found) {
            if (data.eventSlug) setEventSlug(data.eventSlug);
            setRequiresPath(Boolean(data.requiresPath));
          }
        })
        .catch(() => {})
        .finally(() => setResolved(true));
      return;
    }

    setResolved(true);
  }, [next]);

  return (
    <main className="min-h-screen bg-[#080b10] text-stone-100 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-stone-800/60">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <Image
            src={cqImages.logoNav || '/brand/canton-quests-master-logo.png'}
            alt="Canton Quests Logo"
            width={40}
            height={40}
            priority
            className="rounded-xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <div className="text-left">
            <span className="font-display font-black text-lg text-white tracking-tight block">
              CANTON <span className="text-amber-400">QUESTS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 tracking-wider block uppercase">
              Field Operations // Canton, OH
            </span>
          </div>
        </Link>

        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft size={13} />
          Already have an account? Access Command Center
        </Link>
      </div>

      {/* Registration form */}
      <div className="relative z-10">
        {!resolved ? null : requiresPath ? (
          <ThreePathSelector eventSlug={eventSlug} redirectTo={next} />
        ) : (
          <div className="max-w-md mx-auto px-4 py-16">
            <CreatePlayerIdentityPanel redirectTo={next || '/profile'} acquisitionSource="operation_entry" />
          </div>
        )}
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
