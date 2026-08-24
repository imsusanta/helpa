import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron/security';
import { expireStaleTrials } from '@/lib/saas/subscription';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionLifecycleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionLifecycleCron(request);
}

async function handleSubscriptionLifecycleCron(
  request: NextRequest
): Promise<NextResponse> {
  const authorization = authorizeCronRequest(request, [
    'CRON_SECRET',
    'AUTOMATION_CRON_SECRET',
  ]);
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const result = await expireStaleTrials();

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        ...result,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    console.error('[Subscription Lifecycle Cron] error:', err);
    return NextResponse.json(
      { error: 'Subscription lifecycle run failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
