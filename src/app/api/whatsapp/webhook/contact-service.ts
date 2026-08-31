import { getAdminClient } from '@/lib/supabase/server';
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe';
import {
  isPlaceholderContactName,
  isWhatsAppGroupAddress,
  isValidIndividualPhone,
  resolvedWhatsAppContactName,
} from '@/core/whatsapp/group-identity';
import type { Contact } from '@/types';

function isSchemaCompatibilityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const code = String(candidate.code || '').toUpperCase();
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)) return true;
  return /does not exist|schema cache|could not find the table/i.test(
    `${candidate.message || ''} ${candidate.details || ''}`
  );
}

export type ContactRow = Contact;

export interface ContactOutcome {
  contact: ContactRow;
  /** True when this call created the row; drives new_contact_created automation dispatch */
  wasCreated: boolean;
}

/**
 * Finds or creates a contact row for an account and phone number.
 * Safely handles races with unique constraints and assigns a sequential patient_id.
 */
export async function findOrCreateContact(
  accountId: string,
  configOwnerUserId: string,
  phone: string,
  name: string
): Promise<ContactOutcome | null> {
  const db = getAdminClient();
  const existingContact = (await findExistingContact(
    db,
    accountId,
    phone
  )) as ContactRow | null;

  if (existingContact) {
    const incomingName = resolvedWhatsAppContactName(name, phone);
    const isPlaceholderName = isPlaceholderContactName(
      existingContact.name,
      phone
    );

    if (
      incomingName &&
      isPlaceholderName &&
      incomingName !== existingContact.name &&
      !isPlaceholderContactName(incomingName, phone)
    ) {
      await db
        .from('contacts')
        .update({ name: incomingName, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id);
    }
    return { contact: existingContact, wasCreated: false };
  }

  if (!isValidIndividualPhone(phone) || isWhatsAppGroupAddress(phone)) {
    return null;
  }

  // Create new contact
  const now = new Date().toISOString();
  let newContact: Record<string, unknown> | null = null;
  let createError: unknown = null;

  const storedName = resolvedWhatsAppContactName(name, phone) || phone;

  const res = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId || null,
      phone,
      name: storedName,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (res.data) {
    newContact = res.data;
  } else if (isUniqueViolation(res.error)) {
    // The pre-insert lookup and this write can race. Re-read immediately so
    // the winner is adopted rather than attempting a second legacy insert.
    const raced = (await findExistingContact(
      db,
      accountId,
      phone
    )) as ContactRow | null;
    if (raced) return { contact: raced, wasCreated: false };
    createError = res.error;
  } else if (isSchemaCompatibilityError(res.error)) {
    // Fallback to legacy fields only for a known schema mismatch. A canonical
    // unique violation is a race, not permission to create another row.
    const legacyRes = await db
      .from('contacts')
      .insert({
        accountId,
        phone,
        name: storedName,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();
    if (legacyRes.data) {
      newContact = legacyRes.data;
    } else if (isUniqueViolation(legacyRes.error)) {
      // Re-read after the compatibility path too: another worker may have
      // committed the contact between the two attempts.
      const raced = (await findExistingContact(
        db,
        accountId,
        phone
      )) as ContactRow | null;
      if (raced) return { contact: raced, wasCreated: false };
      createError = legacyRes.error;
    } else {
      createError = legacyRes.error || res.error;
    }
    // The legacy insert is a valid compatibility path. Only surface an
    // error when both canonical and legacy writes failed; otherwise a stale
    // canonical-schema error would discard a successfully-created contact.
  } else {
    createError = res.error;
  }

  if (createError) {
    if (isUniqueViolation(createError)) {
      const raced = (await findExistingContact(
        db,
        accountId,
        phone
      )) as ContactRow | null;
      if (raced) return { contact: raced, wasCreated: false };
    }
    console.error('Error creating contact:', createError);
    return null;
  }

  if (newContact) {
    const { data: maxPatient } = await db
      .from('patients')
      .select('patient_seq_id')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (maxPatient?.patient_seq_id) {
      const numMatch = maxPatient.patient_seq_id.match(/\d+/);
      if (numMatch) {
        nextNum = parseInt(numMatch[0], 10) + 1;
      }
    }

    const seqId = `PAT-${String(nextNum).padStart(6, '0')}`;

    try {
      await db.from('patients').insert({
        id: newContact.id,
        account_id: accountId,
        patient_seq_id: seqId,
        status: 'active',
      });
    } catch {
      // Ignore if concurrent insert occurred
    }

    try {
      await db
        .from('contacts')
        .update({
          metadata: {
            ...((newContact.metadata as Record<string, unknown>) || {}),
            patient_id: seqId,
          },
        })
        .eq('id', newContact.id);
    } catch {
      // Ignore update errors
    }
  }

  return { contact: newContact as unknown as ContactRow, wasCreated: true };
}
