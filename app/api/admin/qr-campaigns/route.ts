import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, authorizeGameMasterRequest, verifyAdminSecret } from '@/lib/admin-auth';
import {
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  generateCampaignQrCodes,
  getCampaignAnalytics,
  getCampaignBundle,
} from '@/lib/qr-campaigns';

function isAuthorized(request: Request): boolean {
  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) return true;

  const adminCookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(adminCookie && verifyAdminSecret(adminCookie));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Game Master authorization required.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  const bundle = await getCampaignBundle();
  const analytics = campaignId ? await getCampaignAnalytics(campaignId) : null;
  return NextResponse.json({ success: true, ...bundle, analytics });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Game Master authorization required.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'create_campaign') {
      const campaign = await createQrCampaign({
        name: body.name,
        destinationUrl: body.destinationUrl,
        description: body.description,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, campaign });
    }

    if (action === 'create_flyer_variant') {
      const flyerVariant = await createCampaignFlyerVariant({
        campaignId: body.campaignId,
        name: body.name,
        description: body.description,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, flyerVariant });
    }

    if (action === 'create_distributor') {
      const distributor = await createCampaignDistributor({
        campaignId: body.campaignId,
        name: body.name,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, distributor });
    }

    if (action === 'generate_batch') {
      const qrCodes = await generateCampaignQrCodes({
        campaignId: body.campaignId,
        flyerVariantIds: Array.isArray(body.flyerVariantIds) ? body.flyerVariantIds : [],
        distributorIds: Array.isArray(body.distributorIds) ? body.distributorIds : [],
      });
      return NextResponse.json({ success: true, qrCodes });
    }

    return NextResponse.json({ error: `Unknown QR campaign action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'QR campaign action failed.' }, { status: 400 });
  }
}
