'use client';

import { ShieldCheck } from 'lucide-react';
import FastPlayerOnboardForm from './FastPlayerOnboardForm';

interface CreatePlayerIdentityPanelProps {
  redirectTo?: string;
  acquisitionSource?: string;
}

/**
 * Path-free permanent account creation — no Family/Challenge/Secret choice.
 * Used whenever the entry point into Canton Quests doesn't come through the
 * Sept 11 Main Operation's three-door experience (e.g. the Fair QR Hunt, or
 * any other future path-free Operation, or a generic "Create Player
 * Identity" access point). Renders the same trusted FastPlayerOnboardForm
 * used everywhere else — no second account system.
 */
export default function CreatePlayerIdentityPanel({
  redirectTo = '/profile',
  acquisitionSource = 'command_center',
}: CreatePlayerIdentityPanelProps) {
  return (
    <div className="cq-create-identity-panel">
      <div className="cq-three-doors-intro" style={{ marginBottom: '1.5rem' }}>
        <span className="cq-three-doors-eyebrow">ONE PERMANENT ACCOUNT</span>
        <h2 className="cq-three-doors-title">Create Your Player Identity</h2>
        <p className="cq-three-doors-desc">
          <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '0.35rem' }} aria-hidden="true" />
          One callsign works across every Canton Quests Mission — no path required to join.
        </p>
      </div>
      <FastPlayerOnboardForm redirectTo={redirectTo} acquisitionSource={acquisitionSource} />
    </div>
  );
}
