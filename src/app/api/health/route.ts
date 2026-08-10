import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export async function GET() {
  const timestamp = new Date().toISOString();

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    '03b75d7517afd5e341d85feb1bb8669c06c9c30c';

  const hasAppwrite = Boolean(
    APPWRITE_CONFIG.endpoint && APPWRITE_CONFIG.projectId
  );

  const responseBody = {
    status: hasAppwrite ? 'ok' : 'degraded',
    version: '0.3.0',
    commit: commitSha,
    environment: process.env.NODE_ENV || 'production',
    appwrite: {
      connected: hasAppwrite,
      endpoint: APPWRITE_CONFIG.endpoint,
    },
    timestamp,
  };

  return NextResponse.json(responseBody, {
    status: hasAppwrite ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, private',
      'Content-Type': 'application/json',
    },
  });
}
