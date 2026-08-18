'use client';

import React, { useEffect, useRef } from 'react';
import { X, Play, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

interface BriefingVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BriefingVideoModal({ isOpen, onClose }: BriefingVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else {
      document.body.style.overflow = '';
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
    >
      <div
        className="relative w-full max-w-4xl bg-stone-950 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header HUD */}
        <div className="flex items-center justify-between px-4 py-3 bg-stone-900/90 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span id="briefing-modal-title" className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">
              OFFICIAL BRIEFING TRANSMISSION • CANTON QUESTS
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close briefing transmission"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Container */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={cqImages.promoVideo}
            poster={cqImages.promoVideoPoster}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          >
            Your browser does not support high-definition video playback.
          </video>
        </div>

        {/* Footer HUD */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-900/90 border-t border-stone-800 text-[11px] font-mono text-stone-400">
          <span>VOLUME 1: THE FOUNDER&apos;S CIPHER</span>
          <span>LAUNCHES SEPTEMBER 11, 2026</span>
        </div>
      </div>
    </div>
  );
}
