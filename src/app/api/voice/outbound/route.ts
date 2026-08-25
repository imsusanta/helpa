import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { contactsRepository } from '@/lib/db/repositories';
import { voiceRepository } from '@/lib/db/repositories';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';
import { resolveTenantVoiceConfig } from '@/core/providers/voice/credential-resolver';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message: 'A valid Idempotency-Key header is required',
        },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      contactId?: unknown;
      provider?: unknown;
      context?: unknown;
    } | null;

    if (typeof body?.contactId !== 'string' || body.contactId.length === 0) {
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message: 'contactId is required',
        },
        { status: 400 }
      );
    }

    if (body.provider !== 'elevenlabs') {
      return NextResponse.json(
        { error: 'VOICE_OPERATION_UNSUPPORTED' },
        { status: 501 }
      );
    }

    const contact = await contactsRepository.getContact(
      ctx.accountId,
      body.contactId
    );
    if (!contact || !contact.phone || contact.consentStatus !== 'opted_in') {
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message:
            'Contact is not eligible for an outbound call (explicit opted_in consent is required)',
        },
        { status: 422 }
      );
    }

    // Resolve trusted tenant-scoped configuration server-side
    const tenantConfig = await resolveTenantVoiceConfig(
      ctx.accountId,
      'elevenlabs'
    );
    const integration = await voiceRepository.findIntegration(
      ctx.accountId,
      'elevenlabs'
    );

    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          accountId: ctx.accountId,
          contactId: contact.$id,
          provider: 'elevenlabs',
          context: body.context || null,
        })
      )
      .digest('hex');

    // 1. Check idempotency command
    const existingCommand = await voiceRepository.findCommand(
      ctx.accountId,
      idempotencyKey
    );

    if (existingCommand) {
      if (existingCommand.commandFingerprint !== fingerprint) {
        return NextResponse.json(
          {
            error: 'VOICE_PROVIDER_REQUEST_FAILED',
            message: 'Idempotency-Key was already used for a different command',
          },
          { status: 409 }
        );
      }

      if (existingCommand.externalCallId) {
        const existingCall = await voiceRepository.findCallByExternalId(
          ctx.accountId,
          existingCommand.externalCallId
        );
        if (existingCall) {
          return NextResponse.json({ call: existingCall }, { status: 200 });
        }
      }

      return NextResponse.json(
        {
          command: existingCommand,
          status: existingCommand.status,
          message: 'Outbound command is being processed',
        },
        { status: 200 }
      );
    }

    // Atomically claim idempotency key
    let command: Record<string, unknown>;
    try {
      command = await voiceRepository.createCommand({
        accountId: ctx.accountId,
        commandType: 'initiate_outbound_call',
        idempotencyKey,
        commandFingerprint: fingerprint,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 409) {
        const raceCommand = await voiceRepository.findCommand(
          ctx.accountId,
          idempotencyKey
        );
        if (raceCommand) {
          if (raceCommand.commandFingerprint !== fingerprint) {
            return NextResponse.json(
              {
                error: 'VOICE_PROVIDER_REQUEST_FAILED',
                message:
                  'Idempotency-Key was already used for a different command',
              },
              { status: 409 }
            );
          }
          if (raceCommand.externalCallId) {
            const raceCall = await voiceRepository.findCallByExternalId(
              ctx.accountId,
              raceCommand.externalCallId
            );
            if (raceCall) {
              return NextResponse.json({ call: raceCall }, { status: 200 });
            }
          }
          return NextResponse.json(
            { command: raceCommand, status: raceCommand.status },
            { status: 200 }
          );
        }
      }
      throw err;
    }

    // 2. Persist ONE QUEUED call document
    const callDoc = await voiceRepository.createCall(ctx.accountId, {
      provider: 'elevenlabs',
      direction: 'outbound',
      status: 'queued',
      externalCallId: `pending_${command.$id}`,
      fromMasked:
        integration?.phoneNumberMasked || tenantConfig.phoneNumberId || '***',
      toMasked: contact.phone.slice(-4).padStart(contact.phone.length, '*'),
      contactId: contact.$id,
      agentId: integration?.agentId || tenantConfig.agentId,
    });

    // 3. Transition call document status to INITIATING
    await voiceRepository.updateCallStatus(
      ctx.accountId,
      callDoc.$id,
      'initiating'
    );

    // 4. Contact ElevenLabs using tenant provider instance
    const provider = getVoiceProvider('elevenlabs', tenantConfig);
    let outboundResult: { externalCallId: string };

    try {
      outboundResult = await provider.initiateOutboundCall({
        toNumber: contact.phone,
        agentId: integration?.agentId || tenantConfig.agentId,
        phoneNumberId:
          integration?.providerPhoneNumberId || tenantConfig.phoneNumberId,
        context:
          typeof body.context === 'object' && body.context
            ? (body.context as Record<string, unknown>)
            : undefined,
      });
    } catch (error) {
      // Mark local call FAILED on provider error
      const errorMessage =
        error instanceof VoiceProviderError
          ? error.message
          : 'VOICE_PROVIDER_REQUEST_FAILED';

      await voiceRepository.updateCallStatus(
        ctx.accountId,
        callDoc.$id,
        'failed',
        {
          failureCode:
            error instanceof VoiceProviderError
              ? error.code
              : 'VOICE_PROVIDER_REQUEST_FAILED',
          failureMessageSanitized: errorMessage.slice(0, 120),
        }
      );

      await voiceRepository.updateCommand(command.$id as string, {
        status: 'failed',
        lastErrorSanitized:
          error instanceof VoiceProviderError
            ? error.code
            : 'VOICE_PROVIDER_REQUEST_FAILED',
      });

      if (error instanceof VoiceProviderError) {
        return NextResponse.json(
          { error: error.code },
          { status: error.status }
        );
      }

      return NextResponse.json(
        { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
        { status: 502 }
      );
    }

    // 5. Update that SAME Appwrite call document with externalCallId!
    try {
      const updatedCall = await voiceRepository.updateCallStatus(
        ctx.accountId,
        callDoc.$id,
        'initiating',
        {
          externalCallId: outboundResult.externalCallId,
          updatedAt: new Date().toISOString(),
        }
      );

      await voiceRepository.updateCommand(command.$id as string, {
        status: 'succeeded',
        externalCallId: outboundResult.externalCallId,
        resultReference: outboundResult.externalCallId,
      });

      return NextResponse.json({ call: updatedCall }, { status: 201 });
    } catch (err: unknown) {
      console.error(
        '[outbound-call] Call initiation succeeded but status update failed:',
        err
      );

      // Persist durable outbox reconciliation record
      try {
        await voiceRepository.createProviderEvent({
          accountId: ctx.accountId,
          provider: 'elevenlabs',
          externalEventId: `reconcile:${outboundResult.externalCallId}`,
          eventType: 'call_reconciliation_needed',
          payloadHash: 'partial_persistence',
          rawPayloadReference: outboundResult.externalCallId,
          processingStatus: 'queued',
          processingAttempts: 0,
          receivedAt: new Date().toISOString(),
        });
      } catch {
        /* best effort reconciliation persistence */
      }

      // Return sanitized failure—NOT fake success or partialSuccess!
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_PERSISTENCE_FAILED',
          message: 'Failed to record provider response; reconciliation queued',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
