/**
 * Helpa Core Platform — Contacts Engine
 *
 * Core tenant-isolated contact repository with phone normalization,
 * tag management, and custom metadata.
 */

import { getAdminClient } from '@/lib/db/server';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { coreEvents } from '@/core/events';

export interface CoreContact {
  id: string;
  account_id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  extra_attributes?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export async function findOrCreateContact(
  accountId: string,
  rawPhone: string,
  name?: string
): Promise<CoreContact> {
  const db = getAdminClient();
  const normalized = normalizePhone(rawPhone);

  const { data: existing } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('phone', normalized)
    .maybeSingle();

  if (existing) {
    if (name && existing.name !== name) {
      const { data: updated } = await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      return (updated || existing) as CoreContact;
    }
    return existing as CoreContact;
  }

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      phone: normalized,
      name: name || `Contact ${normalized.slice(-4)}`,
      tags: ['whatsapp_inbound'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create contact: ${error?.message}`);
  }

  await coreEvents.emit('contact.created', accountId, {
    contactId: created.id,
    phone: normalized,
    name: created.name,
  });

  return created as CoreContact;
}
