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
import { enqueueProviderEventJob } from '@/queues/producers/provider-events-producer';

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

    // Server-side Tenant Resolution: Never trust payload accountId
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

    // Webhook Deduplication Race Control: Atomic creation with unique provider + externalEventId index
    const storage = getAppwriteAdminClient().storage;
    const filename = `${providerName}_${event.externalEventId.replace(/[^a-zA-Z0-9_.:-]/g, '_')}_${payloadHash.slice(0, 16)}.json`;

    let rawPayloadReference = '';
    try {
      const createdFile = await storage.createFile(
        APPWRITE_CONFIG.buckets.webhookPayloads,
        ID.unique(),
        InputFile.fromBuffer(Buffer.from(rawBody), filename)
      );
      rawPayloadReference = createdFile.$id;
    } catch (storageErr) {
      console.warn(
        '[voice-webhook] Failed to store raw payload in storage:',
        storageErr
      );
      rawPayloadReference = 'inline_hash:' + payloadHash;
    }

    let transcriptReference: string | undefined = undefined;
    if (event.transcript) {
      try {
        const transcriptFile = await storage.createFile(
          APPWRITE_CONFIG.buckets.webhookPayloads,
          ID.unique(),
          InputFile.fromBuffer(
            Buffer.from(event.transcript),
            `transcript_${event.externalCallId}.txt`
          )
        );
        transcriptReference = transcriptFile.$id;
      } catch (tErr) {
        console.warn('[voice-webhook] Failed to store transcript file:', tErr);
      }
    }

    let eventDoc: { $id: string };
    try {
      eventDoc = (await voiceRepository.createProviderEvent({
        accountId: integration.accountId,
        provider: providerName,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payloadHash,
        rawPayloadReference,
        processingStatus: 'queued',
        processingAttempts: 0,
        receivedAt: new Date().toISOString(),
      })) as unknown as { $id: string };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 409) {
        const existingEvent = await voiceRepository.findProviderEvent(
          providerName,
          event.externalEventId
        );
        if (existingEvent && existingEvent.payloadHash !== payloadHash) {
          return NextResponse.json(
            {
              error: 'VOICE_PROVIDER_REQUEST_FAILED',
              message: 'Payload hash mismatch on duplicate event',
            },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { accepted: true, duplicate: true },
          { status: 200 }
        );
      }
      throw err;
    }

    // Submit job to BullMQ queue
    const enqueued = await enqueueProviderEventJob({
      documentId: eventDoc.$id,
      provider: providerName,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      rawPayloadReference,
      accountId: integration.accountId,
    });

    if (!enqueued) {
      // Outbox fallback: Mark event retrying so background worker picks it up from database
      await getAppwriteAdminClient()
        .databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.providerEvents,
          eventDoc.$id,
          {
            processingStatus: 'retrying',
            nextAttemptAt: new Date(Date.now() + 5000).toISOString(),
          }
        )
        .catch(() => null);
    }

    // Update Call document using Call State Machine (storing transcriptReference, NOT raw transcript text)
    if (event.status) {
      await voiceRepository.upsertCall(
        integration.accountId,
        event.externalCallId,
        {
          provider: providerName,
          direction: event.direction || 'outbound',
          status: event.status,
          agentId: event.externalAgentId,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          durationSeconds: event.durationSeconds,
          transcriptStatus: event.transcript ? 'available' : 'pending',
          ...(transcriptReference ? { transcriptReference } : {}),
          failureCode: event.failureCode,
          failureMessageSanitized: event.failureMessageSanitized,
        }
      );
    }

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
