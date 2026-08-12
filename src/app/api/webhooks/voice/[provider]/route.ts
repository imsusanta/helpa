import crypto from 'crypto';
import { ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { NextResponse } from 'next/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import {
  VoiceProviderError,
  type VoiceProviderName,
} from '@/core/providers/voice/voice-provider.interface';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';

const MAX_PAYLOAD_BYTES = 1_000_000;
const ALLOWED_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;

function sanitizedError(error: unknown): { error: string; status: number } {
  if (error instanceof VoiceProviderError)
    return { error: error.code, status: error.status };
  return { error: 'VOICE_PROVIDER_REQUEST_FAILED', status: 502 };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  if (!['sarvam', 'xai', 'elevenlabs'].includes(providerParam))
    return NextResponse.json(
      { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
      { status: 400 }
    );
  if (!ALLOWED_CONTENT_TYPE.test(request.headers.get('content-type') || ''))
    return NextResponse.json(
      { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
      { status: 415 }
    );
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES)
    return NextResponse.json(
      { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
      { status: 413 }
    );

  const providerName = providerParam as VoiceProviderName;
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_PAYLOAD_BYTES)
    return NextResponse.json(
      { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
      { status: 413 }
    );
  const provider = getVoiceProvider(providerName);
  try {
    const verification = await provider.verifyWebhook(rawBody, request.headers);
    if (!verification || verification.verified !== true) {
      throw new VoiceProviderError(
        'VOICE_SIGNATURE_INVALID',
        'Voice webhook signature verification failed',
        401
      );
    }
    const event = await provider.normalizeWebhook(rawBody, request.headers);
    const integration = await voiceRepository.findUniqueTenant(
      providerName,
      event.externalAgentId,
      event.externalPhoneNumberId
    );
    if (!integration)
      throw new VoiceProviderError(
        'VOICE_TENANT_MAPPING_NOT_FOUND',
        'No unique server-side voice integration mapping exists',
        422
      );

    const payloadHash = crypto
      .createHash('sha256')
      .update(rawBody)
      .digest('hex');
    const duplicate = await voiceRepository.findProviderEvent(
      providerName,
      event.externalEventId
    );
    if (duplicate)
      return NextResponse.json(
        { accepted: true, duplicate: true },
        { status: 200 }
      );

    const storage = getAppwriteAdminClient().storage;
    const filename = `${providerName}_${event.externalEventId.replace(/[^a-zA-Z0-9_.:-]/g, '_')}_${payloadHash.slice(0, 16)}.json`;
    const createdFile = await storage.createFile(
      APPWRITE_CONFIG.buckets.webhookPayloads,
      ID.unique(),
      InputFile.fromBuffer(Buffer.from(rawBody), filename)
    );
    const rawPayloadReference = createdFile.$id;
    try {
      await voiceRepository.createProviderEvent({
        accountId: integration.accountId,
        provider: providerName,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payloadHash,
        rawPayloadReference,
        processingStatus: 'queued',
        processingAttempts: 0,
        receivedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 409) {
        return NextResponse.json(
          { accepted: true, duplicate: true },
          { status: 200 }
        );
      }
      throw err;
    }

    await voiceRepository.upsertCall(
      integration.accountId,
      event.externalCallId,
      {
        provider: providerName,
        direction: event.direction || 'outbound',
        status: event.status || 'in_progress',
        agentId: event.externalAgentId,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationSeconds: event.durationSeconds,
        transcriptStatus: event.transcript ? 'available' : 'pending',
        ...(event.transcript ? { transcript: event.transcript } : {}),
        failureCode: event.failureCode,
        failureMessageSanitized: event.failureMessageSanitized,
      }
    );
    return NextResponse.json({ accepted: true }, { status: 200 });
  } catch (error) {
    const result = sanitizedError(error);
    console.warn('[voice-webhook]', {
      provider: providerName,
      code: result.error,
    });
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }
}
