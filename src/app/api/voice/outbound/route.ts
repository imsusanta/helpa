import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { contactsRepository } from '@/infrastructure/appwrite/repositories/contacts.repository';
import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200)
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message: 'A valid Idempotency-Key header is required',
        },
        { status: 400 }
      );
    const body = (await request.json().catch(() => null)) as {
      contactId?: unknown;
      provider?: unknown;
      context?: unknown;
    } | null;
    if (typeof body?.contactId !== 'string' || body.contactId.length === 0)
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message: 'contactId is required',
        },
        { status: 400 }
      );
    if (body.provider !== 'elevenlabs')
      return NextResponse.json(
        { error: 'VOICE_OPERATION_UNSUPPORTED' },
        { status: 501 }
      );
    const contact = await contactsRepository.getContact(
      ctx.accountId,
      body.contactId
    );
    if (!contact || !contact.phone || contact.consentStatus !== 'opted_in')
      return NextResponse.json(
        {
          error: 'VOICE_PROVIDER_REQUEST_FAILED',
          message:
            'Contact is not eligible for an outbound call (explicit opted_in consent is required)',
        },
        { status: 422 }
      );
    const integration = await voiceRepository.findIntegration(
      ctx.accountId,
      'elevenlabs'
    );
    if (!integration)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs is not configured for this account',
        503
      );
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          accountId: ctx.accountId,
          contactId: contact.$id,
          provider: integration.provider,
          context: body.context || null,
        })
      )
      .digest('hex');
    const existing = await voiceRepository.findCommand(
      ctx.accountId,
      idempotencyKey
    );
    if (existing) {
      if (existing.commandFingerprint !== fingerprint)
        return NextResponse.json(
          {
            error: 'VOICE_PROVIDER_REQUEST_FAILED',
            message: 'Idempotency-Key was already used for a different command',
          },
          { status: 409 }
        );

      let existingCall: Record<string, unknown> | null = null;
      if (existing.externalCallId) {
        existingCall = await voiceRepository.findCallByExternalId(
          ctx.accountId,
          existing.externalCallId
        );
      }
      return NextResponse.json(
        { call: existingCall || existing },
        { status: 200 }
      );
    }

    const command = await voiceRepository.createCommand({
      accountId: ctx.accountId,
      commandType: 'initiate_outbound_call',
      idempotencyKey,
      commandFingerprint: fingerprint,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Pre-call persistence: Create local INITIATING call before calling remote provider
    const localCall = await voiceRepository.createCall(ctx.accountId, {
      provider: 'elevenlabs',
      direction: 'outbound',
      status: 'initiating',
      fromMasked: integration.phoneNumberMasked,
      toMasked: contact.phone.slice(-4).padStart(contact.phone.length, '*'),
      contactId: contact.$id,
      agentId: integration.agentId,
    });

    const provider = getVoiceProvider('elevenlabs');
    try {
      const result = await provider.initiateOutboundCall({
        toNumber: contact.phone,
        agentId: integration.agentId,
        phoneNumberId: integration.providerPhoneNumberId,
        context:
          typeof body.context === 'object' && body.context
            ? (body.context as Record<string, unknown>)
            : undefined,
      });

      const updatedCall = await voiceRepository.upsertCall(
        ctx.accountId,
        result.externalCallId,
        {
          provider: 'elevenlabs',
          direction: 'outbound',
          status: 'initiating',
          fromMasked: integration.phoneNumberMasked,
          toMasked: contact.phone.slice(-4).padStart(contact.phone.length, '*'),
          contactId: contact.$id,
          agentId: integration.agentId,
        }
      );

      await voiceRepository.updateCommand(command.$id, {
        status: 'succeeded',
        externalCallId: result.externalCallId,
        resultReference: result.externalCallId,
      });

      return NextResponse.json({ call: updatedCall }, { status: 201 });
    } catch (error) {
      // Compensation: Mark local call record failed if provider initiation fails
      const errorMessage =
        error instanceof VoiceProviderError
          ? error.message
          : 'VOICE_PROVIDER_REQUEST_FAILED';

      await voiceRepository.updateCallStatus(
        ctx.accountId,
        localCall.$id,
        'failed',
        {
          failureCode:
            error instanceof VoiceProviderError
              ? error.code
              : 'VOICE_PROVIDER_REQUEST_FAILED',
          failureMessageSanitized: errorMessage.slice(0, 120),
        }
      );

      await voiceRepository.updateCommand(command.$id, {
        status: 'failed',
        lastErrorSanitized:
          error instanceof VoiceProviderError
            ? error.code
            : 'VOICE_PROVIDER_REQUEST_FAILED',
      });

      if (error instanceof VoiceProviderError)
        return NextResponse.json(
          { error: error.code },
          { status: error.status }
        );

      return NextResponse.json(
        { error: 'VOICE_PROVIDER_REQUEST_FAILED' },
        { status: 502 }
      );
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
