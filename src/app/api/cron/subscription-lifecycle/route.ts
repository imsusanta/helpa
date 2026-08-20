import { NextRequest, NextResponse } from 'next/server';
import { expireStaleTrials } from '@/lib/saas/subscription';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionLifecycleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionLifecycleCron(request);
}

async function handleSubscriptionLifecycleCron(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production with a secret set, enforce bearer token
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Unauthorized cron request' },
          { status: 401 }
        );
      }
    }

    const result = await expireStaleTrials();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    console.error('[Subscription Lifecycle Cron] error:', err);
    const message =
      err instanceof Error ? err.message : 'Cron execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
