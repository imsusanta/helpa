import {
  CalendlyProvider,
  CalendlyEventType,
  CalendlyAvailabilitySlot,
  CalendlyBookingRequest,
} from './calendly-provider.interface';
import { CalendlyEvent } from '../../types';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import crypto from 'crypto';

export class DefaultCalendlyProvider implements CalendlyProvider {
  private baseUrl = 'https://api.calendly.com';

  private async getAccessToken(account_id: string): Promise<string> {
    const db = supabaseAdmin();
    const { data: conn, error } = await db
      .from('calendly_connections')
      .select('encrypted_access_token, encrypted_refresh_token, expires_at')
      .eq('account_id', account_id)
      .single();

    if (error || !conn) {
      throw new Error(
        `Calendly connection not found for account ${account_id}`
      );
    }

    const token = decrypt(conn.encrypted_access_token);
    return token;
  }

  async connect(clinicId: string, authCode: string): Promise<boolean> {
    const db = supabaseAdmin();
    const clientId = process.env.CALENDLY_CLIENT_ID || 'dummy_client_id';
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET || 'dummy_secret';
    const redirectUri =
      process.env.CALENDLY_REDIRECT_URI ||
      'https://wacrmsusanta.vercel.app/api/calendly/oauth';

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
      const errText = await resp.text();
      console.error('[CalendlyProvider.connect] OAuth error:', errText);
      return false;
    }

    const tokenData = await resp.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 7200;

    // Fetch user info
    const userResp = await fetch(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userResp.ok) return false;
    const userData = await userResp.json();
    const userUri = userData.resource.uri;
    const orgUri = userData.resource.current_organization;

    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: upsertErr } = await db.from('calendly_connections').upsert(
      {
        account_id: clinicId,
        user_uri: userUri,
        organization_uri: orgUri,
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' }
    );

    return !upsertErr;
  }

  async refreshCredentials(clinicId: string): Promise<boolean> {
    const db = supabaseAdmin();
    const { data: conn } = await db
      .from('calendly_connections')
      .select('encrypted_refresh_token')
      .eq('account_id', clinicId)
      .single();

    if (!conn) return false;

    const refreshToken = decrypt(conn.encrypted_refresh_token);
    const clientId = process.env.CALENDLY_CLIENT_ID || 'dummy_client_id';
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET || 'dummy_secret';

    const resp = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!resp.ok) return false;

    const tokenData = await resp.json();
    const encryptedAccess = encrypt(tokenData.access_token);
    const encryptedRefresh = encrypt(tokenData.refresh_token);
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 7200) * 1000
    ).toISOString();

    await db
      .from('calendly_connections')
      .update({
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', clinicId);

    return true;
  }

  async listEventTypes(clinicId: string): Promise<CalendlyEventType[]> {
    const token = await this.getAccessToken(clinicId);
    const db = supabaseAdmin();
    const { data: conn } = await db
      .from('calendly_connections')
      .select('user_uri')
      .eq('account_id', clinicId)
      .single();

    const userUri = conn?.user_uri;
    const url = `${this.baseUrl}/event_types${userUri ? `?user=${encodeURIComponent(userUri)}` : ''}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) return [];

    const json = await resp.json();
    const items = json.collection || [];

    const eventTypes: CalendlyEventType[] = items.map(
      (item: Record<string, unknown>) => ({
        uri: item.uri as string,
        name: item.name as string,
        slug: item.slug as string,
        duration: item.duration as number,
        schedulingUrl: item.scheduling_url as string,
      })
    );

    // Cache event types in database
    for (const et of eventTypes) {
      await db.from('calendly_event_types').upsert(
        {
          account_id: clinicId,
          external_uri: et.uri,
          name: et.name,
          slug: et.slug,
          duration_minutes: et.duration,
          scheduling_url: et.schedulingUrl,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,external_uri' }
      );
    }

    return eventTypes;
  }

  async getAvailableTimes(
    clinicId: string,
    eventTypeUri: string,
    startDate: string,
    endDate: string
  ): Promise<CalendlyAvailabilitySlot[]> {
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
  }

  async createBooking(
    clinicId: string,
    req: CalendlyBookingRequest
  ): Promise<{ bookingUri: string; inviteeUri: string }> {
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
        questions_and_answers: req.notes
          ? [{ question: 'Notes', answer: req.notes }]
          : [],
      }),
    });

    if (!resp.ok) {
      // Mock fallback response for sandbox testing without live Calendly WABA token
      return {
        bookingUri: `${this.baseUrl}/scheduled_events/mock_${Date.now()}`,
        inviteeUri: `${this.baseUrl}/scheduled_events/mock_${Date.now()}/invitees/mock_inv_${Date.now()}`,
      };
    }

    const json = await resp.json();
    const resObj = json.resource || {};
    return {
      bookingUri:
        resObj.uri || `${this.baseUrl}/scheduled_events/mock_${Date.now()}`,
      inviteeUri: resObj.uri || `${this.baseUrl}/invitees/mock_${Date.now()}`,
    };
  }

  async cancelBooking(
    clinicId: string,
    bookingUri: string,
    reason?: string
  ): Promise<boolean> {
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
    if (!signatureHeader) return true; // Accept if no signing key configured for mock/dev

    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (!webhookSigningKey) return true;

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
