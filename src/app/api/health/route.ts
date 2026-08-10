import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export async function GET() {
  const timestamp = new Date().toISOString();

  const commitSha =
    process.env.APPWRITE_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    'unknown';

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
