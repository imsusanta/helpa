import { NextResponse } from 'next/server';

/**
 * Public Service Health Endpoint
 *
 * Requirements:
 * - No authentication required.
 * - Zero secrets, database URLs, or internal system paths exposed.
 * - Returns service health status and timestamp.
 * - Explicit no-store cache control headers.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  // Validate presence of core configuration without exposing values
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const isHealthy = hasSupabaseUrl;

  const responseBody = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp,
  };

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, private',
      'Content-Type': 'application/json',
    },
  });
}
