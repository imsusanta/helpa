import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { callId } = await params;

    const call = await voiceRepository.findCallByExternalId(
      ctx.accountId,
      callId
    );
    if (!call) {
      return NextResponse.json(
        { error: 'VOICE_PROVIDER_REQUEST_FAILED', message: 'Call not found' },
        { status: 404 }
      );
    }

    // Tenant Isolation check: Verify account match
    if (call.accountId !== ctx.accountId) {
      return NextResponse.json(
        { error: 'ACCOUNT_MEMBERSHIP_REQUIRED' },
        { status: 403 }
      );
    }

    if (!call.transcriptReference) {
      return NextResponse.json(
        { transcript: null, status: call.transcriptStatus || 'pending' },
        {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store' },
        }
      );
    }

    const storage = getAppwriteAdminClient().storage;
    const fileBuffer = await storage.getFileDownload(
      APPWRITE_CONFIG.buckets.webhookPayloads,
      call.transcriptReference as string
    );

    const transcriptText = Buffer.from(fileBuffer).toString('utf8');
    return NextResponse.json(
      {
        callId: call.externalCallId,
        transcript: transcriptText,
        status: 'available',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
