'use client';

import React, { useEffect, useRef } from 'react';

export type ParticleMode = 'gold-embers' | 'kinetic-streaks' | 'cryptic-glyphs' | 'xp-burst' | 'city-nodes';

interface HudParticlesCanvasProps {
  mode?: ParticleMode;
  count?: number;
  color?: string;
  className?: string;
  reducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  char?: string;
  angle?: number;
  speed?: number;
}

const GLYPH_CHARS = ['Ø', '∑', '∆', 'Ψ', 'Ω', '§', '◊', '◈', '0', '1', '7', 'X', 'CQ', '3114'];

export default function HudParticlesCanvas({
  mode = 'gold-embers',
  count,
  color,
  className = '',
  reducedMotion = false,
}: HudParticlesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle count based on mode
    const numParticles = count ?? (mode === 'kinetic-streaks' ? 35 : mode === 'cryptic-glyphs' ? 24 : 45);
    const particles: Particle[] = [];

    const createParticle = (initialRandomAge = true): Particle => {
      const pColor = color || (mode === 'kinetic-streaks' ? '#ef4444' : mode === 'cryptic-glyphs' ? '#a855f7' : '#f59e0b');

      if (mode === 'kinetic-streaks') {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        return {
          x: width / 2 + (Math.random() - 0.5) * 100,
          y: height / 2 + (Math.random() - 0.5) * 100,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 2.5,
          opacity: 0.1,
          maxOpacity: 0.7 + Math.random() * 0.3,
          life: initialRandomAge ? Math.random() * 80 : 0,
          maxLife: 60 + Math.random() * 40,
          angle,
          speed,
        };
      }

      if (mode === 'cryptic-glyphs') {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.3 - Math.random() * 0.6,
          size: 9 + Math.random() * 6,
          opacity: 0.1,
          maxOpacity: 0.5 + Math.random() * 0.4,
          life: initialRandomAge ? Math.random() * 120 : 0,
          maxLife: 100 + Math.random() * 80,
          char: GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)],
        };
      }

      if (mode === 'xp-burst') {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 5;
        return {
          x: width / 2,
          y: height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size: 1.5 + Math.random() * 3,
          opacity: 0.1,
          maxOpacity: 0.8 + Math.random() * 0.2,
          life: initialRandomAge ? Math.random() * 60 : 0,
          maxLife: 50 + Math.random() * 40,
        };
      }

      // Default: gold-embers drifting upwards
      return {
        x: Math.random() * width,
        y: height + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.8 - Math.random() * 1.4,
        size: 1.5 + Math.random() * 3,
        opacity: 0.1,
        maxOpacity: 0.6 + Math.random() * 0.4,
        life: initialRandomAge ? Math.random() * 140 : 0,
        maxLife: 120 + Math.random() * 80,
      };
    };

    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle(true));
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Lifecycle fade in/out
        const progress = p.life / p.maxLife;
        if (progress < 0.2) {
          p.opacity = (progress / 0.2) * p.maxOpacity;
        } else if (progress > 0.7) {
          p.opacity = ((1 - progress) / 0.3) * p.maxOpacity;
        } else {
          p.opacity = p.maxOpacity;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle based on mode
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

        const baseColor = color || (mode === 'kinetic-streaks' ? '#ef4444' : mode === 'cryptic-glyphs' ? '#c084fc' : '#fbbf24');

        if (mode === 'kinetic-streaks') {
          // Draw kinetic streak line
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3.5, p.y - p.vy * 3.5);
          ctx.stroke();
        } else if (mode === 'cryptic-glyphs' && p.char) {
          ctx.font = `${Math.round(p.size)}px monospace`;
          ctx.fillStyle = baseColor;
          ctx.fillText(p.char, p.x, p.y);
        } else {
          // Glowing circle
          ctx.fillStyle = baseColor;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Respawn when dead or out of bounds
        if (p.life >= p.maxLife || p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) {
          particles[i] = createParticle(false);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [mode, count, color, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none w-full h-full ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
