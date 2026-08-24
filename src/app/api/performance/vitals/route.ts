import { NextResponse } from 'next/server';

const ALLOWED_METRICS = new Set(['LCP', 'INP', 'CLS']);

export async function POST(request: Request) {
  try {
    const metric = (await request.json()) as {
      id?: string;
      name?: string;
      value?: number;
      rating?: string;
      navigationType?: string;
      pathname?: string;
      userAgent?: string;
      recordedAt?: string;
    };

    if (
      !metric.name ||
      !ALLOWED_METRICS.has(metric.name) ||
      typeof metric.value !== 'number' ||
      !Number.isFinite(metric.value)
    ) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }

    console.info('[web-vitals]', {
      ...metric,
      pathname: metric.pathname?.slice(0, 256),
      userAgent: metric.userAgent?.slice(0, 512),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
