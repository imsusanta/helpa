/**
 * Helpa Core Platform — WhatsApp Tenant Resolver
 *
 * Strictly resolves an incoming Meta Phone Number ID to one workspace.
 */

import { getAdminClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/whatsapp/encryption';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { ResolvedTenantContext } from './types';

export async function resolveTenantByPhoneNumberId(
  phoneNumberId: string
): Promise<ResolvedTenantContext | null> {
  if (!phoneNumberId || typeof phoneNumberId !== 'string') return null;
  const cleanPhoneId = phoneNumberId.trim();
  const db = getAdminClient();
  try {
    const { data: rows, error } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('phone_number_id', cleanPhoneId)
      .limit(1);
    if (error || !rows || rows.length === 0) return null;
    const config = rows[0];
    const tenantId = String(config.account_id || '');
    const userId = String(config.user_id || '');
    const wabaId = String(config.waba_id || '');
    const displayPhoneNumber =
      config.display_phone_number || config.phone_number || undefined;
    const businessName =
      config.verified_name || config.business_name || undefined;
    const encToken = String(config.encrypted_access_token || '');
    let accessToken = '';
    if (encToken) {
      try {
        accessToken = decrypt(encToken);
      } catch (error) {
        console.error('[Tenant Resolver] Decryption failed:', error);
      }
    }
    if (!tenantId) return null;
    return {
      tenantId,
      userId,
      phoneNumberId: cleanPhoneId,
      wabaId,
      accessToken,
      displayPhoneNumber,
      businessName,
    };
  } catch (error) {
    console.error('[Tenant Resolver] Resolution error:', error);
    return null;
  }
}

export async function resolveContactForTenant({
  tenantId,
  phone,
  name,
}: {
  tenantId: string;
  phone: string;
  name?: string;
}): Promise<{ contactId: string; wasCreated: boolean }> {
  const db = getAdminClient();
  const normalized = normalizePhone(phone);
  const displayName = (name || '').trim() || normalized;
  const { data: existing } = await db
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', tenantId)
    .or(`phone.eq.${normalized},phone.eq.${phone}`)
    .limit(1);
  if (existing && existing.length > 0) {
    const contact = existing[0];
    if (name && name.trim() && contact.name !== name.trim())
      await db
        .from('contacts')
        .update({ name: name.trim() })
        .eq('id', contact.id)
        .eq('account_id', tenantId);
    return { contactId: contact.id, wasCreated: false };
  }
  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: tenantId,
      phone: normalized,
      name: displayName,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !created) {
    const { data: retry } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', tenantId)
      .eq('phone', normalized)
      .single();
    if (retry) return { contactId: retry.id, wasCreated: false };
    throw new Error(
      `Failed to create contact for tenant ${tenantId}: ${error?.message}`
    );
  }
  return { contactId: created.id, wasCreated: true };
}

export async function resolveConversationForTenant({
  tenantId,
  contactId,
}: {
  tenantId: string;
  contactId: string;
}): Promise<{ conversationId: string; isNew: boolean }> {
  const db = getAdminClient();
  const { data: existing } = await db
    .from('conversations')
    .select('id, status, is_archived')
    .eq('account_id', tenantId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existing && existing.length > 0)
    return { conversationId: existing[0].id, isNew: false };
  const { data: created, error } = await db
    .from('conversations')
    .insert({
      account_id: tenantId,
      contact_id: contactId,
      status: 'active',
      unread_count: 0,
      is_archived: false,
      ai_chat_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !created) {
    const { data: retry } = await db
      .from('conversations')
      .select('id')
      .eq('account_id', tenantId)
      .eq('contact_id', contactId)
      .single();
    if (retry) return { conversationId: retry.id, isNew: false };
    throw new Error(
      `Failed to create conversation for tenant ${tenantId}: ${error?.message}`
    );
  }
  return { conversationId: created.id, isNew: true };
}
