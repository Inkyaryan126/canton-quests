export function formatCredits(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export interface GridCountdown {
  label: string;
  urgent: boolean;
  ended: boolean;
}

export function formatCountdown(targetIso: string, nowMs: number): GridCountdown {
  const targetMs = Date.parse(targetIso);
  const remainingMs = targetMs - nowMs;

  if (!Number.isFinite(targetMs) || remainingMs <= 0) {
    return { label: 'ENDED', urgent: false, ended: true };
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const label =
    days > 0
      ? `${days}D ${hours}H`
      : hours > 0
        ? `${hours}H ${minutes}M`
        : `${Math.max(minutes, 0)}M`;

  return { label, urgent: remainingMs < 60 * 60_000, ended: false };
}

export function timeAgo(iso: string, nowMs: number): string {
  const targetMs = Date.parse(iso);
  if (!Number.isFinite(targetMs)) return '—';
  const diffMs = Math.max(nowMs - targetMs, 0);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
