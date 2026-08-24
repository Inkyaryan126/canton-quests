'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';
import ThreePathSelector from '@/components/ThreePathSelector';

export default function RegisterPage() {
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
          href="/auth/login"
          className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft size={13} />
          Already have an account? Log in
        </Link>
      </div>

      {/* Registration form */}
      <div className="relative z-10">
        <ThreePathSelector />
      </div>
    </main>
  );
}
