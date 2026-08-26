import { getAdminClient } from '@/lib/supabase/server';
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe';
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
  const rawDigits = phone.replace(/\D/g, '');
  const searchPhone = rawDigits || phone;

  const existingContact = (await findExistingContact(
    db,
    accountId,
    searchPhone
  )) as ContactRow | null;

  if (existingContact) {
    // Update name if it changed, but ONLY if current contact name is placeholder
    const isPlaceholderName =
      !existingContact.name ||
      existingContact.name === phone ||
      existingContact.name === searchPhone ||
      existingContact.name.startsWith('+') ||
      /^\d+$/.test(existingContact.name.replace(/[\s\-\+]/g, ''));

    if (
      name &&
      isPlaceholderName &&
      name !== existingContact.name &&
      !/^\d+$/.test(name.replace(/[\s\-\+]/g, ''))
    ) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id);
      existingContact.name = name;
    }
    return { contact: existingContact, wasCreated: false };
  }

  // Create new contact
  const now = new Date().toISOString();
  let newContact: Record<string, unknown> | null = null;
  let createError: unknown = null;

  const contactPhone = rawDigits
    ? rawDigits.startsWith('+')
      ? rawDigits
      : `+${rawDigits}`
    : phone;
  const contactName =
    name && name.trim() ? name.trim() : contactPhone || 'Unknown Contact';

  const res = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId || null,
      phone: contactPhone,
      name: contactName,
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
      searchPhone
    )) as ContactRow | null;
    if (raced) return { contact: raced, wasCreated: false };
    createError = res.error;
  } else if (isSchemaCompatibilityError(res.error)) {
    // Fallback to legacy fields only for a known schema mismatch.
    const legacyRes = await db
      .from('contacts')
      .insert({
        accountId,
        phone: contactPhone,
        name: contactName,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();
    if (legacyRes.data) {
      newContact = legacyRes.data;
    } else if (isUniqueViolation(legacyRes.error)) {
      const raced = (await findExistingContact(
        db,
        accountId,
        searchPhone
      )) as ContactRow | null;
      if (raced) return { contact: raced, wasCreated: false };
      createError = legacyRes.error;
    } else {
      createError = legacyRes.error || res.error;
    }
  } else {
    createError = res.error;
  }

  if (createError) {
    const raced = (await findExistingContact(
      db,
      accountId,
      searchPhone
    )) as ContactRow | null;
    if (raced) return { contact: raced, wasCreated: false };
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
