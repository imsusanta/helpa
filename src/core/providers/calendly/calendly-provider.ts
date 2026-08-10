/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CalendlyProvider,
  CalendlyEventType,
  CalendlyAvailabilitySlot,
  CalendlyBookingRequest,
} from './calendly-provider.interface';
import { CalendlyEvent } from '../../types';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { Query, ID } from 'node-appwrite';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import crypto from 'crypto';

export class DefaultCalendlyProvider implements CalendlyProvider {
  private baseUrl = 'https://api.calendly.com';

  private async getAccessToken(account_id: string): Promise<string> {
    const { databases } = getAppwriteAdminClient();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calendlyConnections,
      [Query.equal('accountId', account_id), Query.limit(1)]
    );

    if (res.documents.length === 0) {
      throw new Error(
        `Calendly connection not found for account ${account_id}`
      );
    }

    const conn = res.documents[0] as any;
    return decrypt(conn.encryptedAccessToken || conn.encrypted_access_token);
  }

  async connect(clinicId: string, authCode: string): Promise<boolean> {
    const { databases } = getAppwriteAdminClient();
    const clientId = process.env.CALENDLY_CLIENT_ID || 'dummy_client_id';
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET || 'dummy_secret';
    const redirectUri =
      process.env.CALENDLY_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.helpa.studio'}/api/webhooks/calendly`;

    const resp = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: redirectUri,
      }),
    });

    if (!resp.ok) {
      return false;
    }

    const tokenData = await resp.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calendlyConnections,
      ID.unique(),
      {
        accountId: clinicId,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        status: 'active',
        lastSyncedAt: new Date().toISOString(),
      }
    );

    return true;
  }

  async refreshCredentials(_clinicId: string): Promise<boolean> {
    return true;
  }

  async listEventTypes(clinicId: string): Promise<CalendlyEventType[]> {
    try {
      const token = await this.getAccessToken(clinicId);
      const resp = await fetch(`${this.baseUrl}/event_types`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) return [];

      const json = await resp.json();
      const items = json.collection || [];

      return items.map((item: Record<string, unknown>) => ({
        uri: item.uri as string,
        name: item.name as string,
        slug: item.slug as string,
        duration: item.duration as number,
        schedulingUrl: item.scheduling_url as string,
      }));
    } catch {
      return [];
    }
  }

  async getAvailableTimes(
    clinicId: string,
    eventTypeUri: string,
    startDate: string,
    endDate: string
  ): Promise<CalendlyAvailabilitySlot[]> {
    try {
      const token = await this.getAccessToken(clinicId);
      const url = `${this.baseUrl}/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${encodeURIComponent(startDate)}&end_time=${encodeURIComponent(endDate)}`;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) return [];

      const json = await resp.json();
      const slots = json.collection || [];

      return slots.map((slot: Record<string, unknown>) => ({
        startTime: slot.start_time as string,
        endTime: (slot.end_time || slot.start_time) as string,
        status: 'available',
      }));
    } catch {
      return [];
    }
  }

  async createBooking(
    clinicId: string,
    req: CalendlyBookingRequest
  ): Promise<{ bookingUri: string; inviteeUri: string }> {
    try {
      const token = await this.getAccessToken(clinicId);

      const resp = await fetch(`${this.baseUrl}/invitees`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: req.eventTypeId,
          start_time: req.startAt,
          name: req.patientName,
          email: req.patientEmail,
          phone: req.patientPhone,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(
          `Calendly API Error (${resp.status}): ${resp.statusText} ${errText}`
        );
      }

      const json = await resp.json();
      const resObj = json.resource || {};
      if (!resObj.uri) {
        throw new Error('Calendly API response missing resource URI.');
      }

      return {
        bookingUri: resObj.uri,
        inviteeUri: resObj.uri,
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('Failed to create Calendly booking.');
    }
  }

  async cancelBooking(
    clinicId: string,
    bookingUri: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken(clinicId);
      const resp = await fetch(`${bookingUri}/cancellation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Patient requested cancellation',
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async rescheduleBooking(
    clinicId: string,
    bookingUri: string,
    newStartAt: string
  ): Promise<{ bookingUri: string; inviteeUri: string }> {
    await this.cancelBooking(clinicId, bookingUri, 'Rescheduled');
    return this.createBooking(clinicId, {
      eventTypeId: bookingUri,
      startAt: newStartAt,
      patientName: 'Rescheduled Patient',
      patientPhone: '',
    });
  }

  async verifyWebhook(request: Request, bodyText: string): Promise<boolean> {
    const signatureHeader = request.headers.get('calendly-webhook-signature');
    if (!signatureHeader) return false;

    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (!webhookSigningKey) return false;

    const parts = signatureHeader.split(',');
    const tPart = parts.find((p) => p.startsWith('t='))?.split('=')[1];
    const signaturePart = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!tPart || !signaturePart) return false;

    const payload = `${tPart}.${bodyText}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSigningKey)
      .update(payload)
      .digest('hex');

    return expectedSignature === signaturePart;
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<CalendlyEvent> {
    const event = (payload.event as string) || '';
    const pData = (payload.payload || {}) as Record<string, unknown>;

    let eventType: 'scheduled' | 'canceled' | 'rescheduled' = 'scheduled';
    if (event.includes('canceled')) eventType = 'canceled';
    if (event.includes('rescheduled')) eventType = 'rescheduled';

    const invitee = (pData.invitee || pData) as Record<string, unknown>;
    const scheduledEvent = (pData.scheduled_event || {}) as Record<
      string,
      unknown
    >;

    const getStr = (val: unknown): string =>
      typeof val === 'string' ? val : '';

    const startTime =
      getStr(scheduledEvent.start_time) ||
      getStr(pData.start_time) ||
      new Date().toISOString();
    const endTime =
      getStr(scheduledEvent.end_time) ||
      getStr(pData.end_time) ||
      new Date().toISOString();

    const patientName =
      getStr(invitee.name) || getStr(pData.name) || 'Unknown Patient';
    const patientPhone =
      getStr(invitee.text_reminder_number) || getStr(invitee.phone);
    const patientEmail = getStr(invitee.email) || getStr(pData.email);

    return {
      eventId:
        getStr(scheduledEvent.uri) ||
        getStr(pData.event) ||
        `evt_${Date.now()}`,
      clinicId:
        (payload.account_id as string) ||
        '00000000-0000-0000-0000-000000000000',
      type: eventType,
      eventType: event.includes('canceled')
        ? 'invitee.canceled'
        : 'invitee.created',
      eventUri: getStr(scheduledEvent.uri) || `evt_${Date.now()}`,
      inviteeUri: getStr(invitee.uri) || `invitee_${Date.now()}`,
      startTime,
      endTime,
      startAt: startTime,
      endAt: endTime,
      timezone: getStr(scheduledEvent.timezone) || 'UTC',
      status: eventType === 'canceled' ? 'canceled' : 'active',
      rescheduled: eventType === 'rescheduled',
      patientName,
      patientPhone,
      patientEmail,
      contactDetails: {
        name: patientName,
        email: patientEmail,
        phone: patientPhone,
      },
      occurredAt: new Date().toISOString(),
      rawPayload: payload,
    };
  }
}
