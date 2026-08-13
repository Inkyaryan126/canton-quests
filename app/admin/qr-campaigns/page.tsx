'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Archive, ArrowLeft, Copy, Download, Power, Printer, QrCode, Sparkles, Trash2 } from 'lucide-react';
import {
  CampaignAnalytics,
  CampaignDistributor,
  CampaignFlyerVariant,
  CampaignQrCode,
  QrCampaign,
} from '@/lib/types';
import { createQrSvgDataUri } from '@/lib/qr-svg';
import { GAME_MASTER_DISPLAY_NAME, getGameMasterGreeting } from '@/lib/admin-persona';
import { ACQUISITION_LANDING_DESTINATION_PRESETS } from '@/lib/acquisition-landing-content';

interface CampaignApiState {
  campaigns: QrCampaign[];
  flyerVariants: CampaignFlyerVariant[];
  distributors: CampaignDistributor[];
  qrCodes: CampaignQrCode[];
  analytics: CampaignAnalytics | null;
}

type CampaignPostAction =
  | {
      action: 'create_campaign';
      name: string;
      destinationUrl: string;
      notes?: string;
    }
  | {
      action: 'create_flyer_variant';
      campaignId: string;
      name: string;
      description?: string;
    }
  | {
      action: 'create_distributor';
      campaignId: string;
      name: string;
      notes?: string;
    }
  | {
      action: 'generate_batch';
      campaignId: string;
      flyerVariantIds: string[];
      distributorIds: string[];
      destinationUrlByFlyerVariantId?: Record<string, string>;
    }
  | {
      action: 'archive_campaign' | 'delete_campaign';
      campaignId: string;
      confirmed?: boolean;
    }
  | {
      action: 'delete_flyer_variant' | 'delete_distributor' | 'delete_qr_code';
      id: string;
      confirmed?: boolean;
    };

const emptyState: CampaignApiState = {
  campaigns: [],
  flyerVariants: [],
  distributors: [],
  qrCodes: [],
  analytics: null,
};

function getFairDestinationForFlyer(flyerName: string): string | undefined {
  const normalized = flyerName.trim().toLowerCase();
  if (/\b(a|family)\b/.test(normalized)) return '/start/family';
  if (/\b(b|challenge)\b/.test(normalized)) return '/start/challenge';
  if (/\b(c|secret)\b/.test(normalized)) return '/start/secret';
  return undefined;
}

export default function QrCampaignsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<CampaignApiState>(emptyState);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [campaignName, setCampaignName] = useState('STARK COUNTY FAIR 2026');
  const [destinationUrl, setDestinationUrl] = useState('/quests');
  const [campaignNotes, setCampaignNotes] = useState('');
  const [flyerName, setFlyerName] = useState('Flyer A');
  const [flyerDescription, setFlyerDescription] = useState('');
  const [distributorName, setDistributorName] = useState('Dustin');
  const [distributorNotes, setDistributorNotes] = useState('');
  const [selectedFlyerIds, setSelectedFlyerIds] = useState<string[]>([]);
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>([]);
  const [useFairDestinationSplit, setUseFairDestinationSplit] = useState(false);

  const selectedCampaign = state.campaigns.find((campaign) => campaign.id === selectedCampaignId) || state.campaigns[0];
  const campaignId = selectedCampaign?.id || '';

  const campaignFlyers = useMemo(
    () => state.flyerVariants.filter((flyer) => flyer.campaignId === campaignId),
    [state.flyerVariants, campaignId]
  );
  const campaignDistributors = useMemo(
    () => state.distributors.filter((distributor) => distributor.campaignId === campaignId),
    [state.distributors, campaignId]
  );
  const campaignQrs = useMemo(
    () => state.qrCodes.filter((qr) => qr.campaignId === campaignId),
    [state.qrCodes, campaignId]
  );
  const campaignVisits = state.analytics?.totalVisits || 0;

  const loadCampaigns = useCallback(async (nextCampaignId?: string) => {
    const targetCampaignId = nextCampaignId || selectedCampaignId;
    const res = await fetch(`/api/admin/qr-campaigns${targetCampaignId ? `?campaignId=${targetCampaignId}` : ''}`);
    if (!res.ok) {
      setState(emptyState);
      return;
    }
    const data = await res.json();
    setState({
      campaigns: data.campaigns || [],
      flyerVariants: data.flyerVariants || [],
      distributors: data.distributors || [],
      qrCodes: data.qrCodes || [],
      analytics: data.analytics || null,
    });
    const firstCampaignId = nextCampaignId || targetCampaignId || data.campaigns?.[0]?.id || '';
    setSelectedCampaignId(firstCampaignId);
  }, [selectedCampaignId]);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then(async (data) => {
        setIsAdmin(Boolean(data.isAdmin));
        if (data.isAdmin) await loadCampaigns();
      })
      .finally(() => setIsLoading(false));
  }, [loadCampaigns]);

  const postAction = async (body: CampaignPostAction) => {
    const res = await fetch('/api/admin/qr-campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'QR campaign action failed.');
    return data;
  };

  const handleCreateCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = await postAction({
      action: 'create_campaign',
      name: campaignName,
      destinationUrl,
      notes: campaignNotes,
    });
    setMessage(`Campaign created: ${data.campaign.name}`);
    await loadCampaigns(data.campaign.id);
  };

  const handleCreateFlyer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignId) return;
    await postAction({
      action: 'create_flyer_variant',
      campaignId,
      name: flyerName,
      description: flyerDescription,
    });
    setFlyerName('');
    setFlyerDescription('');
    setMessage('Flyer variant added.');
    await loadCampaigns(campaignId);
  };

  const handleCreateDistributor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignId) return;
    await postAction({
      action: 'create_distributor',
      campaignId,
      name: distributorName,
      notes: distributorNotes,
    });
    setDistributorName('');
    setDistributorNotes('');
    setMessage('Distributor added.');
    await loadCampaigns(campaignId);
  };

  const handleBatchGenerate = async () => {
    if (!campaignId) return;
    const destinationUrlByFlyerVariantId = useFairDestinationSplit
      ? Object.fromEntries(
          campaignFlyers
            .filter((flyer) => selectedFlyerIds.includes(flyer.id))
            .map((flyer) => [flyer.id, getFairDestinationForFlyer(flyer.name)])
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
        )
      : undefined;
    const data = await postAction({
      action: 'generate_batch',
      campaignId,
      flyerVariantIds: selectedFlyerIds,
      distributorIds: selectedDistributorIds,
      destinationUrlByFlyerVariantId,
    });
    setMessage(`${data.qrCodes.length} Flyer x Distributor tracking QR records are ready.`);
    await loadCampaigns(campaignId);
  };

  const handleSafeAction = async (body: CampaignPostAction, confirmation: string) => {
    if (!window.confirm(confirmation)) return;
    const data = await postAction(body);
    setMessage(data.result?.message || 'QR campaign record updated.');
    await loadCampaigns(campaignId);
  };

  const toggle = (id: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#050607] text-amber-100 p-6 font-mono">Opening command ledger...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050607] text-amber-100 p-6 font-mono">
        <div className="max-w-xl mx-auto mt-24 border border-amber-500/30 bg-black/60 p-6">
          <h1 className="text-2xl font-black text-white">Game Master authorization required</h1>
          <p className="mt-2 text-sm text-amber-100/70">QR campaign analytics and generation remain private.</p>
          <Link href="/admin" className="btn btn-primary mt-5">
            Return to Game Master Login
          </Link>
        </div>
      </div>
    );
  }

  const analytics = state.analytics;

  return (
    <div className="min-h-screen bg-[#050607] text-[#f5efe1] font-mono cq-gm-shell">
      <main className="max-w-7xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-6">
        <header className="cq-gm-panel p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <Link href="/admin" className="inline-flex items-center gap-2 text-xs text-amber-200/80 hover:text-amber-100">
                <ArrowLeft size={16} /> Command Center
              </Link>
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300/70">Private campaign table</p>
                <h1 className="text-3xl md:text-5xl font-black text-white">QR Campaigns</h1>
              </div>
              <p className="max-w-2xl text-sm md:text-base text-stone-300">{getGameMasterGreeting()}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => window.print()} className="cq-gm-button">
                <Printer size={17} /> Print Sheet
              </button>
              <Link href="/admin/live" className="cq-gm-button">
                <Sparkles size={17} /> Live Control
              </Link>
            </div>
          </div>
        </header>

        {message && <div className="cq-gm-panel border-emerald-400/40 p-3 text-sm text-emerald-200">{message}</div>}

        <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
          <div className="space-y-5">
            <form onSubmit={handleCreateCampaign} className="cq-gm-panel p-5 space-y-4">
              <h2 className="cq-gm-heading">Create Campaign</h2>
              <label className="cq-gm-label">Campaign name</label>
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="cq-gm-input" required />
              <label className="cq-gm-label">Destination</label>
              <input value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} className="cq-gm-input" required />
              <div className="cq-gm-preset-row" aria-label="Evergreen start destination presets">
                {ACQUISITION_LANDING_DESTINATION_PRESETS.map((preset) => (
                  <button
                    key={preset.path}
                    type="button"
                    onClick={() => setDestinationUrl(preset.path)}
                    className="cq-gm-mini-button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="cq-gm-label">Campaign notes</label>
              <textarea value={campaignNotes} onChange={(event) => setCampaignNotes(event.target.value)} className="cq-gm-input min-h-20" />
              <button className="btn btn-primary w-full" type="submit">Create Campaign</button>
            </form>

            <div className="cq-gm-panel p-5 space-y-3">
              <h2 className="cq-gm-heading">Active Campaign</h2>
              <select
                value={campaignId}
                onChange={(event) => {
                  setSelectedCampaignId(event.target.value);
                  loadCampaigns(event.target.value);
                }}
                className="cq-gm-input"
              >
                {state.campaigns.length === 0 && <option value="">No campaigns yet</option>}
                {state.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
              {selectedCampaign && (
                <div className="text-xs text-stone-300 space-y-1">
                  <p>Destination: <span className="text-amber-200">{selectedCampaign.destinationUrl}</span></p>
                  <p>Status: <span className={selectedCampaign.status === 'active' ? 'text-emerald-200' : 'text-stone-400'}>{selectedCampaign.status.toUpperCase()}</span></p>
                  <p>Operator: {GAME_MASTER_DISPLAY_NAME}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSafeAction(
                        { action: 'archive_campaign', campaignId },
                        'ARCHIVE this campaign? Existing QR attribution and visit analytics will be preserved.'
                      )}
                      className="cq-gm-mini-button border-orange-300/40 text-orange-100"
                    >
                      <Archive size={14} /> ARCHIVE
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSafeAction(
                        { action: 'delete_campaign', campaignId, confirmed: true },
                        campaignQrs.length || campaignVisits
                          ? 'DELETE is blocked when a campaign has QR codes or visit history. The server will preserve analytics and explain why.'
                          : 'DELETE this unused campaign permanently? This is only allowed when no QR codes or visits exist.'
                      )}
                      className="cq-gm-mini-button border-red-400/50 text-red-100"
                    >
                      <Trash2 size={14} /> DELETE UNUSED
                    </button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleCreateFlyer} className="cq-gm-panel p-5 space-y-4">
              <h2 className="cq-gm-heading">Flyer Variants</h2>
              <input value={flyerName} onChange={(event) => setFlyerName(event.target.value)} className="cq-gm-input" placeholder="Flyer A" required />
              <input value={flyerDescription} onChange={(event) => setFlyerDescription(event.target.value)} className="cq-gm-input" placeholder="Optional description" />
              <button className="cq-gm-button w-full" type="submit">Add Flyer</button>
              <div className="space-y-2">
                {campaignFlyers.map((flyer) => {
                  const flyerQrCount = campaignQrs.filter((qr) => qr.flyerVariantId === flyer.id).length;
                  const flyerVisitCount = analytics?.flyerPerformance.find((row) => row.id === flyer.id)?.visits || 0;
                  const willDeactivate = flyerQrCount > 0 || flyerVisitCount > 0;
                  return (
                    <div key={flyer.id} className="cq-gm-check items-start justify-between">
                      <label className="flex min-w-0 items-center gap-2">
                        <input type="checkbox" checked={selectedFlyerIds.includes(flyer.id)} onChange={() => toggle(flyer.id, selectedFlyerIds, setSelectedFlyerIds)} />
                        <span className="truncate">{flyer.name} <span className="text-stone-500">({flyer.status})</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSafeAction(
                          { action: 'delete_flyer_variant', id: flyer.id, confirmed: true },
                          willDeactivate
                            ? 'DEACTIVATE this flyer variant? Existing QR and visit attribution will be preserved.'
                            : 'DELETE this unused flyer variant permanently?'
                        )}
                        className={willDeactivate ? 'cq-gm-mini-button border-orange-300/40 text-orange-100' : 'cq-gm-mini-button border-red-400/40 text-red-100'}
                      >
                        {willDeactivate ? <Power size={13} /> : <Trash2 size={13} />}
                        {willDeactivate ? 'DEACTIVATE' : 'DELETE UNUSED'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </form>

            <form onSubmit={handleCreateDistributor} className="cq-gm-panel p-5 space-y-4">
              <h2 className="cq-gm-heading">Distributors</h2>
              <input value={distributorName} onChange={(event) => setDistributorName(event.target.value)} className="cq-gm-input" placeholder="Dustin" required />
              <input value={distributorNotes} onChange={(event) => setDistributorNotes(event.target.value)} className="cq-gm-input" placeholder="Optional notes" />
              <button className="cq-gm-button w-full" type="submit">Add Distributor</button>
              <div className="space-y-2">
                {campaignDistributors.map((distributor) => {
                  const distributorQrCount = campaignQrs.filter((qr) => qr.distributorId === distributor.id).length;
                  const distributorVisitCount = analytics?.distributorPerformance.find((row) => row.id === distributor.id)?.visits || 0;
                  const willDeactivate = distributorQrCount > 0 || distributorVisitCount > 0;
                  return (
                    <div key={distributor.id} className="cq-gm-check items-start justify-between">
                      <label className="flex min-w-0 items-center gap-2">
                        <input type="checkbox" checked={selectedDistributorIds.includes(distributor.id)} onChange={() => toggle(distributor.id, selectedDistributorIds, setSelectedDistributorIds)} />
                        <span className="truncate">{distributor.name} <span className="text-stone-500">({distributor.status})</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSafeAction(
                          { action: 'delete_distributor', id: distributor.id, confirmed: true },
                          willDeactivate
                            ? 'DEACTIVATE this distributor? Existing QR and visit attribution will be preserved.'
                            : 'DELETE this unused distributor permanently?'
                        )}
                        className={willDeactivate ? 'cq-gm-mini-button border-orange-300/40 text-orange-100' : 'cq-gm-mini-button border-red-400/40 text-red-100'}
                      >
                        {willDeactivate ? <Power size={13} /> : <Trash2 size={13} />}
                        {willDeactivate ? 'DEACTIVATE' : 'DELETE UNUSED'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </form>
          </div>

          <div className="space-y-5">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="cq-gm-stat"><span>Total Visits</span><strong>{analytics?.totalVisits || 0}</strong></div>
              <div className="cq-gm-stat"><span>Unique Visitors</span><strong>{analytics?.uniqueVisitors || 0}</strong></div>
              <div className="cq-gm-stat"><span>Active QR Codes</span><strong>{analytics?.activeQrCodes || 0}</strong></div>
            </section>

            <section className="cq-gm-panel p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="cq-gm-heading">Batch Generate</h2>
                  <p className="text-xs text-stone-400">Select flyer variants and distributors, then generate every Flyer x Distributor combination.</p>
                </div>
                <label className="cq-gm-check">
                  <input
                    type="checkbox"
                    checked={useFairDestinationSplit}
                    onChange={(event) => setUseFairDestinationSplit(event.target.checked)}
                  />
                  <span>A/B/C start destinations</span>
                </label>
                <button
                  onClick={handleBatchGenerate}
                  disabled={!campaignId || selectedFlyerIds.length === 0 || selectedDistributorIds.length === 0}
                  className="btn btn-primary disabled:opacity-50"
                >
                  <QrCode size={18} /> Generate {selectedFlyerIds.length * selectedDistributorIds.length || ''} Codes
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <AnalyticsList title="Flyer Performance" rows={analytics?.flyerPerformance || []} />
              <AnalyticsList title="Distributor Performance" rows={analytics?.distributorPerformance || []} />
              <AnalyticsList title="Destination Performance" rows={analytics?.destinationPerformance || []} />
              <AnalyticsList title="Combination Performance" rows={analytics?.combinationPerformance || []} />
            </section>

            <section className="cq-gm-panel p-5 space-y-4">
              <h2 className="cq-gm-heading">QR Assets</h2>
              {campaignQrs.length === 0 ? (
                <p className="text-sm text-stone-400">No QR combinations yet. Create flyers and distributors, select them, then generate the batch.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaignQrs.map((qr) => {
                    const flyer = campaignFlyers.find((item) => item.id === qr.flyerVariantId);
                    const distributor = campaignDistributors.find((item) => item.id === qr.distributorId);
                    const qrVisitCount = analytics?.combinationPerformance.find((row) => row.qrCodeId === qr.id)?.visits || 0;
                    const dataUri = createQrSvgDataUri(qr.trackingUrl);
                    return (
                      <article key={qr.id} className="bg-black/50 border border-amber-300/20 p-4 space-y-3">
                        <div className="flex gap-4">
                          <Image
                            src={dataUri}
                            alt={`QR for ${qr.internalName}`}
                            width={112}
                            height={112}
                            unoptimized
                            className="w-28 h-28 bg-white p-1"
                          />
                          <div className="min-w-0 space-y-1">
                            <h3 className="font-black text-white">{flyer?.name} / {distributor?.name}</h3>
                            <p className="text-xs text-stone-400">{selectedCampaign?.name}</p>
                            <p className={qr.status === 'active' ? 'text-xs text-emerald-200' : 'text-xs text-stone-400'}>{qr.status.toUpperCase()} · {qrVisitCount} visits</p>
                            <p className="text-xs text-cyan-100 break-all">Destination: {qr.destinationUrl}</p>
                            <p className="text-[11px] text-amber-200 break-all">{qr.trackingUrl}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 print:hidden">
                          <button onClick={() => navigator.clipboard?.writeText(qr.trackingUrl)} className="cq-gm-mini-button">
                            <Copy size={14} /> Copy URL
                          </button>
                          <a href={dataUri} download={`${qr.trackingSlug}.svg`} className="cq-gm-mini-button">
                            <Download size={14} /> SVG
                          </a>
                          <button
                            onClick={() => handleSafeAction(
                              { action: 'delete_qr_code', id: qr.id, confirmed: qrVisitCount === 0 },
                              qrVisitCount > 0
                                ? 'DEACTIVATE this QR code? The scan record will remain so attribution history is preserved.'
                                : 'DELETE this unused QR code permanently? There is no recorded visit history for this code.'
                            )}
                            className={qrVisitCount > 0 ? 'cq-gm-mini-button border-orange-300/40 text-orange-100' : 'cq-gm-mini-button border-red-400/50 text-red-100'}
                          >
                            {qrVisitCount > 0 ? <Power size={14} /> : <Trash2 size={14} />}
                            {qrVisitCount > 0 ? 'DEACTIVATE' : 'DELETE UNUSED'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="cq-gm-panel p-5 space-y-2 print:hidden">
              <h2 className="cq-gm-heading">Game Master Operating Notes</h2>
              <ol className="list-decimal pl-5 text-sm text-stone-300 space-y-1">
                <li>Create the campaign and choose a destination preset or enter a custom path.</li>
                <li>For the evergreen split, turn on the checkbox so Flyer A {'->'} Family, Flyer B {'->'} Challenge, and Flyer C {'->'} Secret are stored on the generated QR records.</li>
                <li>Select all six records and generate the nine combinations.</li>
                <li>Print this sheet and place the matching QR on each physical flyer batch.</li>
                <li>Return here to compare flyer, distributor, and exact combination performance.</li>
              </ol>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function AnalyticsList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id?: string; qrCodeId?: string; label: string; visits: number; uniqueVisitors: number }>;
}) {
  return (
    <div className="cq-gm-panel p-4 space-y-3">
      <h2 className="cq-gm-heading">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-stone-500">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id || row.qrCodeId} className="flex items-center justify-between gap-3 border-b border-amber-300/10 pb-2">
              <span className="text-xs text-stone-200">{row.label}</span>
              <span className="text-xs text-amber-200">{row.visits} / {row.uniqueVisitors}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
