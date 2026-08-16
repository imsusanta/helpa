/**
 * Helpa Core Platform — WhatsApp Tenant Resolver
 *
 * Provides strict multi-tenant resolution from incoming Meta WhatsApp
 * Webhook events (Phone Number ID) to Workspace/Tenant context.
 *
 * CRITICAL SECURITY INVARIANT:
 * Never fallback to an arbitrary tenant or workspace if the Phone Number ID
 * does not match an active configuration.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { decrypt } from '@/lib/whatsapp/encryption';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { ResolvedTenantContext } from './types';

/**
 * Resolves tenant context strictly by Phone Number ID.
 * Returns null if the phone number is not registered to any tenant.
 */
export async function resolveTenantByPhoneNumberId(
  phoneNumberId: string
): Promise<ResolvedTenantContext | null> {
  if (!phoneNumberId || typeof phoneNumberId !== 'string') {
    return null;
  }

  const cleanPhoneId = phoneNumberId.trim();
  const db = getAdminClient();

  try {
    // Primary query on canonical whatsapp_config table
    const { data: rows, error } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('phone_number_id', cleanPhoneId)
      .limit(1);

    if (error || !rows || rows.length === 0) {
      return null;
    }

    const config = rows[0];
    const tenantId = String(config.account_id || config.accountId || '');
    const userId = String(config.user_id || config.userId || '');
    const wabaId = String(config.waba_id || config.wabaId || '');
    const displayPhoneNumber = config.display_phone_number || config.phone_number || undefined;
    const businessName = config.verified_name || config.business_name || undefined;

    const encToken = String(
      config.access_token_encrypted ||
        config.encrypted_access_token ||
        config.encryptedAccessToken ||
        config.access_token ||
        config.accessToken ||
        ''
    );

    let accessToken = '';
    if (encToken) {
      try {
        accessToken = decrypt(encToken);
      } catch (decryptErr) {
        console.error(
          `[Tenant Resolver] Decryption failed for phone_number_id ${cleanPhoneId}:`,
          decryptErr
        );
      }
    }

    if (!tenantId) {
      return null;
    }

    return {
      tenantId,
      userId,
      phoneNumberId: cleanPhoneId,
      wabaId,
      accessToken,
      displayPhoneNumber,
      businessName,
    };
  } catch (err) {
    console.error('[Tenant Resolver] Resolution error:', err);
    return null;
  }
}

/**
 * Resolves or creates a contact strictly within the specified tenant/workspace.
 */
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

  // Search existing contact within this tenant only
  const { data: existing } = await db
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', tenantId)
    .or(`phone.eq.${normalized},phone.eq.${phone}`)
    .limit(1);

  if (existing && existing.length > 0) {
    const contact = existing[0];
    // Update name if we received a better verified profile name
    if (name && name.trim() && contact.name !== name.trim()) {
      await db
        .from('contacts')
        .update({ name: name.trim() })
        .eq('id', contact.id)
        .eq('account_id', tenantId);
    }
    return { contactId: contact.id, wasCreated: false };
  }

  // Create new contact scoped strictly to tenant
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
    // Fallback search in case of race condition
    const { data: retry } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', tenantId)
      .eq('phone', normalized)
      .single();

    if (retry) {
      return { contactId: retry.id, wasCreated: false };
    }
    throw new Error(`Failed to create contact for tenant ${tenantId}: ${error?.message}`);
  }

  return { contactId: created.id, wasCreated: true };
}

/**
 * Resolves or creates a conversation strictly within the specified tenant/workspace.
 */
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

  if (existing && existing.length > 0) {
    const conv = existing[0];
    return { conversationId: conv.id, isNew: false };
  }

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

    if (retry) {
      return { conversationId: retry.id, isNew: false };
    }
    throw new Error(
      `Failed to create conversation for tenant ${tenantId}: ${error?.message}`
    );
  }

  return { conversationId: created.id, isNew: true };
}
