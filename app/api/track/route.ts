import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as supabaseModule from '@/lib/supabase';

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' | 'bot' {
  if (!ua) return 'desktop';
  const lower = ua.toLowerCase();
  if (/bot|crawler|spider|scraper|slurp|bingbot|googlebot|yandex|baidu/i.test(lower)) return 'bot';
  if (/tablet|ipad|kindle|silk|playbook/i.test(lower)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini|iemobile/i.test(lower)) return 'mobile';
  return 'desktop';
}

function hashSession(token: string): string {
  return crypto.createHash('sha256').update(token + (process.env.SPECTATOR_SESSION_SECRET || 'cq-visitor')).digest('hex').slice(0, 16);
}

// Simple in-memory dedup: prevent same session from firing twice within 5 minutes
const recentSessions = new Map<string, number>();

export async function POST(request: Request) {
  try {
    if (!supabaseModule.supabaseAdmin) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const body = await request.json().catch(() => ({}));
    const pagePath: string = (body.page || '/').substring(0, 200);
    const referrer: string = (body.referrer || '').substring(0, 500);

    // Vercel geo headers (populated automatically in production)
    const country     = request.headers.get('x-vercel-ip-country') || null;
    const countryCode = request.headers.get('x-vercel-ip-country') || null;
    const region      = request.headers.get('x-vercel-ip-region') || null;
    const city        = request.headers.get('x-vercel-ip-city')   || null;
    const latStr      = request.headers.get('x-vercel-ip-latitude') || null;
    const lonStr      = request.headers.get('x-vercel-ip-longitude') || null;
    const latitude    = latStr  ? parseFloat(latStr)  : null;
    const longitude   = lonStr  ? parseFloat(lonStr)  : null;

    const ua         = request.headers.get('user-agent') || '';
    const deviceType = detectDevice(ua);

    // Skip bots
    if (deviceType === 'bot') {
      return NextResponse.json({ ok: true });
    }

    // Derive a session hash from the spectator or player cookie (anonymous if none)
    const cookieHeader = request.headers.get('cookie') || '';
    const specMatch   = cookieHeader.match(/cq_spectator=([^;]+)/);
    const playerMatch = cookieHeader.match(/cq_player=([^;]+)/);
    const rawToken    = playerMatch?.[1] || specMatch?.[1] || (request.headers.get('x-forwarded-for') || 'anon');
    const sessionHash = hashSession(rawToken);

    // Deduplicate: same session + same page within 5 min → skip
    const dedupeKey = `${sessionHash}:${pagePath}`;
    const now = Date.now();
    const lastSeen = recentSessions.get(dedupeKey);
    if (lastSeen && now - lastSeen < 5 * 60 * 1000) {
      return NextResponse.json({ ok: true });
    }
    recentSessions.set(dedupeKey, now);

    // Prune old dedup entries every 500 entries
    if (recentSessions.size > 500) {
      const cutoff = now - 5 * 60 * 1000;
      for (const [k, v] of recentSessions.entries()) {
        if (v < cutoff) recentSessions.delete(k);
      }
    }

    await supabaseModule.supabaseAdmin.from('site_visits').insert({
      session_hash: sessionHash,
      page_path:    pagePath,
      country,
      country_code: countryCode,
      region,
      city,
      latitude,
      longitude,
      device_type:  deviceType,
      referrer:     referrer || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
