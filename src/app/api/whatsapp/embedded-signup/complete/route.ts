import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/whatsapp/encryption';
import { subscribeWabaToApp, verifyPhoneNumber } from '@/lib/whatsapp/meta-api';

const GRAPH_VERSION = 'v21.0';

function verifyState(state: string, accountId: string, userId: string) {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, 'base64url').toString('utf8');
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const [stateAccountId, stateUserId, expiresAt] = payload.split(':');
  return stateAccountId === accountId && stateUserId === userId && Number(expiresAt) > Date.now();
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as {
      code?: string;
      state?: string;
      waba_id?: string;
      phone_number_id?: string;
    } | null;

    if (!body?.code || !body.state || !verifyState(body.state, ctx.accountId, ctx.userId)) {
      return NextResponse.json({ error: 'Invalid or expired WhatsApp connection session' }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      return NextResponse.json({ error: 'WhatsApp integration is not configured' }, { status: 503 });
    }

    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', body.code);

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenData?.access_token) {
      console.error('[WhatsApp signup token exchange]', tokenData?.error?.message || tokenResponse.status);
      return NextResponse.json({ error: 'Meta could not complete the WhatsApp connection' }, { status: 400 });
    }

    const accessToken = String(tokenData.access_token);
    let wabaId = body.waba_id?.trim() || '';
    let phoneNumberId = body.phone_number_id?.trim() || '';

    const debugUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json().catch(() => null);
    const scopes = Array.isArray(debugData?.data?.granular_scopes) ? debugData.data.granular_scopes : [];
    const whatsappScope = scopes.find((scope: { scope?: string }) => scope.scope === 'whatsapp_business_management');
    if (!wabaId && Array.isArray(whatsappScope?.target_ids)) wabaId = String(whatsappScope.target_ids[0] || '');

    if (!phoneNumberId && wabaId) {
      const phones = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`);
      const phoneData = await phones.json().catch(() => null);
      phoneNumberId = String(phoneData?.data?.[0]?.id || '');
    }

    if (!wabaId || !phoneNumberId) {
      return NextResponse.json({ error: 'Meta did not return a WhatsApp Business Account and phone number' }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: conflict } = await db
      .from('whatsapp_configs')
      .select('id, account_id')
      .eq('phone_number_id', phoneNumberId)
      .neq('account_id', ctx.accountId)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: 'This WhatsApp number is already connected to another workspace', code: 'DUPLICATE_PHONE_NUMBER' }, { status: 409 });
    }

    await subscribeWabaToApp({ wabaId, accessToken });
    const phoneInfo = await verifyPhoneNumber({ phoneNumberId, accessToken });
    const now = new Date().toISOString();
    const payload = {
      account_id: ctx.accountId,
      user_id: ctx.userId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      encrypted_access_token: encrypt(accessToken),
      status: 'connected',
      connection_type: 'standard',
      registered_at: now,
      connected_at: now,
      subscribed_apps_at: now,
      last_health_check_at: now,
      webhook_healthy: true,
      messaging_active: true,
      display_phone_number: phoneInfo.display_phone_number || null,
      phone_number: phoneInfo.display_phone_number || null,
      verified_name: phoneInfo.verified_name || null,
      updated_at: now,
    };

    const { data: existing } = await db.from('whatsapp_configs').select('id').eq('account_id', ctx.accountId).maybeSingle();
    const result = existing?.id
      ? await db.from('whatsapp_configs').update(payload).eq('id', existing.id)
      : await db.from('whatsapp_configs').insert({ ...payload, created_at: now });

    if (result.error) {
      console.error('[WhatsApp signup persistence]', result.error.message);
      return NextResponse.json({ error: 'WhatsApp connected with Meta but could not be saved to Helpa' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: phoneInfo.display_phone_number || null,
      verified_name: phoneInfo.verified_name || null,
    });
  } catch (error) {
    console.error('[WhatsApp Embedded Signup]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Unable to complete WhatsApp connection' }, { status: 500 });
  }
}
