/**
 * Helpa Real Estate Module — Lead Service
 *
 * Real Estate Lead CRM, unique Lead ID generation (LEAD-XXXXXX),
 * structured property requirements, and sales pipeline management.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Property Shortlisted'
  | 'Site Visit Scheduled'
  | 'Site Visit Completed'
  | 'Negotiation'
  | 'Converted'
  | 'Lost';

export interface PropertyRequirement {
  purpose: 'Buy' | 'Rent' | 'Lease' | 'Investment';
  propertyType:
    | 'Apartment'
    | 'Villa'
    | 'Independent House'
    | 'Plot'
    | 'Commercial'
    | 'Office'
    | 'Shop';
  location: string;
  minBudget?: number; // In INR Lakhs e.g. 50
  maxBudget?: number; // In INR Lakhs e.g. 70
  bedrooms?: string; // e.g. "2 BHK", "3 BHK"
  possession?: 'Ready to Move' | 'Under Construction';
  furnishing?: 'Furnished' | 'Semi-Furnished' | 'Unfurnished';
  parkingRequired?: boolean;
}

export interface RealEstateLeadRecord {
  id: string;
  accountId: string;
  leadId: string; // e.g. LEAD-000123
  name: string;
  phone: string;
  email?: string;
  requirement?: PropertyRequirement;
  assignedAgent?: string;
  stage: LeadStage;
  aiSummary?: string;
  shortlistedPropertyIds?: string[];
  notes?: string;
  createdAt: string;
}

/**
 * Generates the next sequential unique Lead ID (e.g. LEAD-000123) for a real estate workspace.
 */
export async function generateNextLeadId(accountId: string): Promise<string> {
  const db = getAdminClient();
  const { data: contacts } = await db
    .from('contacts')
    .select('extra_attributes')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);

  let maxSeq = 0;
  if (contacts && contacts.length > 0) {
    for (const c of contacts) {
      const extra = (c.extra_attributes as Record<string, unknown>) || {};
      const leadId = String(extra.lead_id || extra.lead_seq_id || '');
      const match = leadId.match(/LEAD-(\d+)/i);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `LEAD-${nextSeq.toString().padStart(6, '0')}`;
}

/**
 * Retrieves a real estate lead or creates one with unique Lead ID.
 */
export async function getOrCreateRealEstateLead({
  accountId,
  name,
  phone,
  email,
  requirement,
  assignedAgent,
  stage = 'New',
  notes,
}: {
  accountId: string;
  name: string;
  phone: string;
  email?: string;
  requirement?: PropertyRequirement;
  assignedAgent?: string;
  stage?: LeadStage;
  notes?: string;
}): Promise<RealEstateLeadRecord> {
  const db = getAdminClient();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // 1. Check existing lead
  const { data: existing } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace('+', '')}`)
    .maybeSingle();

  if (existing) {
    const extra = (existing.extra_attributes as Record<string, unknown>) || {};
    return {
      id: existing.id,
      accountId: existing.account_id,
      leadId: String(extra.lead_id || `LEAD-${existing.id.slice(0, 6)}`),
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
      requirement: (extra.requirement as PropertyRequirement) || requirement,
      assignedAgent: (extra.assigned_agent as string) || assignedAgent,
      stage: (extra.lead_stage as LeadStage) || stage,
      aiSummary: extra.ai_summary as string,
      shortlistedPropertyIds: (extra.shortlisted_properties as string[]) || [],
      notes: existing.notes,
      createdAt: existing.created_at,
    };
  }

  // 2. Create new real estate lead
  const leadId = await generateNextLeadId(accountId);
  const extraAttributes = {
    lead_id: leadId,
    requirement,
    assigned_agent: assignedAgent,
    lead_stage: stage,
    shortlisted_properties: [],
    created_via: 'real_estate_lead_service',
  };

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      name: name.trim(),
      phone: cleanPhone,
      email,
      notes,
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(
      `Failed to create real estate lead: ${error?.message || 'DB error'}`
    );
  }

  return {
    id: created.id,
    accountId: created.account_id,
    leadId,
    name: created.name,
    phone: created.phone,
    email: created.email,
    requirement,
    assignedAgent,
    stage,
    notes,
    createdAt: created.created_at,
  };
}

/**
 * Updates a lead's property requirement and stage.
 */
export async function updateLeadRequirement(
  accountId: string,
  contactId: string,
  requirement: Partial<PropertyRequirement>,
  newStage?: LeadStage
): Promise<boolean> {
  const db = getAdminClient();

  const { data: contact } = await db
    .from('contacts')
    .select('extra_attributes')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const currentExtra =
    (contact?.extra_attributes as Record<string, unknown>) || {};
  const currentReq =
    (currentExtra.requirement as Record<string, unknown>) || {};

  const updatedExtra = {
    ...currentExtra,
    requirement: { ...currentReq, ...requirement },
    lead_stage: newStage || currentExtra.lead_stage || 'Qualified',
  };

  const { error } = await db
    .from('contacts')
    .update({
      extra_attributes: updatedExtra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('account_id', accountId);

  return !error;
}
