import { getAdminClient } from '@/lib/appwrite-compat';
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe';
import type { Contact } from '@/types';

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
    // Update name if it changed, but ONLY if current contact name is placeholder
    const isPlaceholderName =
      !existingContact.name ||
      existingContact.name === phone ||
      existingContact.name.startsWith('+') ||
      /^\d+$/.test(existingContact.name.replace(/[\s\-\+]/g, ''));

    if (name && isPlaceholderName && name !== existingContact.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id);
    }
    return { contact: existingContact, wasCreated: false };
  }

  // Create new contact
  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone,
      name: name || phone,
    })
    .select()
    .single();

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

  return { contact: newContact as ContactRow, wasCreated: true };
}
