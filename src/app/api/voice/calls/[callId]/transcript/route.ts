import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { voiceRepository } from '@/lib/db/repositories';
import { getAdminClient } from '@/lib/supabase/server';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';

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

    let transcriptText = '';
    try {
      const { data, error } = await getAdminClient()
        .storage.from(STORAGE_BUCKETS.voiceTranscripts)
        .download(call.transcriptReference as string);
      if (error || !data) throw error || new Error('missing transcript');
      transcriptText = await data.text();
    } catch {
      return NextResponse.json(
        { transcript: null, status: 'unavailable' },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

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
