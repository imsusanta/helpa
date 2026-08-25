/**
 * Helpa Core Platform — Campaigns Engine
 *
 * Industry-agnostic outbound WhatsApp broadcast, audience segmentation,
 * multi-tenant audience resolution, and analytics engine.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';
import { sendWhatsAppMessage } from '@/core/whatsapp';

export type AudienceType =
  | 'all'
  | 'tags'
  | 'last_interaction'
  | 'doctor'
  | 'service'
  | 'lead_stage'
  | 'custom_field'
  | 'csv';

export interface AudienceFilter {
  type: AudienceType;
  tagIds?: string[];
  doctorId?: string;
  serviceName?: string;
  leadStage?: string;
  lastInteractionDays?: number;
  customField?: { fieldId: string; value: string };
  csvContacts?: Array<{ phone: string; name?: string }>;
  excludeTagIds?: string[];
}

export interface CampaignData {
  id: string;
  account_id: string;
  name: string;
  template_name?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  replies_count: number;
  conversion_count?: number;
  message_body?: string;
  created_at?: string;
}

export interface CampaignTemplatePreset {
  id: string;
  industry:
    'health' | 'coaching' | 'tutor' | 'salon' | 'real_estate' | 'general';
  title: string;
  description: string;
  suggestedMessage: string;
  defaultAudience: AudienceType;
}

/**
 * Pre-set Industry Campaign Templates
 */
export const INDUSTRY_CAMPAIGN_TEMPLATES: CampaignTemplatePreset[] = [
  // Health Templates
  {
    id: 'health-doctor-leave',
    industry: 'health',
    title: 'Doctor On Leave Notice',
    description:
      'Notify patients about a doctor unavailability and reschedule options.',
    suggestedMessage:
      '📢 Notice: {{DoctorName}} will be on leave from {{StartDate}} to {{EndDate}}. For urgent appointments, please reply or call reception.',
    defaultAudience: 'doctor',
  },
  {
    id: 'health-camp-announcement',
    industry: 'health',
    title: 'Health Camp Announcement',
    description:
      'Invite community members to a free diagnostic or health checkup camp.',
    suggestedMessage:
      '🏥 Free Health Checkup Camp! Join us on {{Date}} at {{Location}} for complimentary ECG & Blood Sugar screening.',
    defaultAudience: 'all',
  },
  {
    id: 'health-new-doctor',
    industry: 'health',
    title: 'New Specialist Joining',
    description: 'Introduce a new doctor joining your clinic roster.',
    suggestedMessage:
      '👨‍⚕️ Welcome {{DoctorName}} ({{Specialty}})! Booking open for morning and evening OPD slots.',
    defaultAudience: 'all',
  },
  {
    id: 'health-followup-recall',
    industry: 'health',
    title: 'Follow-up Recall',
    description: 'Remind past OPD patients to schedule their periodic checkup.',
    suggestedMessage:
      '🩺 Hi {{PatientName}}, your periodic health review with {{DoctorName}} is due. Reply to book your slot.',
    defaultAudience: 'last_interaction',
  },
  {
    id: 'health-vaccination-drive',
    industry: 'health',
    title: 'Vaccination Drive',
    description: 'Seasonal flu or child vaccination alerts.',
    suggestedMessage:
      '💉 Protect your family! Seasonal flu vaccines are now available at our clinic. Reply "Book Vaccine" to reserve.',
    defaultAudience: 'all',
  },

  // Future Industries (Architecture Ready)
  {
    id: 'coaching-admission',
    industry: 'coaching',
    title: 'Admission Campaign',
    description: 'Announce upcoming batch admissions and entrance tests.',
    suggestedMessage:
      '🎓 Admissions Open for {{BatchName}}! Limited seats available. Apply today: {{Link}}',
    defaultAudience: 'lead_stage',
  },
  {
    id: 'tutor-class-announcement',
    industry: 'tutor',
    title: 'Class Announcement',
    description:
      'Notify students about extra revision classes or test schedules.',
    suggestedMessage:
      '📚 Important Notice: Special Mathematics revision class scheduled for {{Date}} at {{Time}}.',
    defaultAudience: 'service',
  },
  {
    id: 'salon-special-offer',
    industry: 'salon',
    title: 'Special Spa & Hair Offer',
    description: 'Promote seasonal discounts or festive packages.',
    suggestedMessage:
      '✨ Weekend Special! Get 25% off on Hair Spa & Facial treatments. Reply "Reserve" to book.',
    defaultAudience: 'all',
  },
  {
    id: 'real-estate-property-launch',
    industry: 'real_estate',
    title: 'New Property Launch',
    description:
      'Share exclusive pre-launch pricing for new residential projects.',
    suggestedMessage:
      '🏙️ Exclusive Pre-Launch: Luxury 2 & 3 BHK Apartments in {{Location}}. Schedule a site visit today!',
    defaultAudience: 'lead_stage',
  },
];

/**
 * Resolves deduplicated target contacts strictly within tenant boundary.
 */
export async function resolveCampaignAudience({
  accountId,
  filter,
}: {
  accountId: string;
  filter: AudienceFilter;
}): Promise<Array<{ id?: string; name: string; phone: string }>> {
  const db = getAdminClient();

  let contacts: Array<{ id?: string; name: string; phone: string }> = [];

  if (
    filter.type === 'csv' &&
    filter.csvContacts &&
    filter.csvContacts.length > 0
  ) {
    contacts = filter.csvContacts.map((c) => ({
      name: c.name || 'Contact',
      phone: c.phone.replace(/[^\d+]/g, ''),
    }));
  } else {
    let query = db
      .from('contacts')
      .select('id, name, phone, created_at, extra_attributes')
      .eq('account_id', accountId);

    if (filter.type === 'doctor' && filter.doctorId) {
      // Filter contacts assigned or linked to specific doctor
      query = query.eq('assigned_to', filter.doctorId);
    } else if (filter.type === 'lead_stage' && filter.leadStage) {
      query = query.eq('status', filter.leadStage);
    }

    const { data: fetched } = await query;
    if (fetched && fetched.length > 0) {
      contacts = fetched.map((c) => ({
        id: c.id,
        name: c.name || 'Contact',
        phone: c.phone || '',
      }));
    }
  }

  // Duplicate Send Prevention: Deduplicate by E.164 normalized telephone number
  const uniqueMap = new Map<
    string,
    { id?: string; name: string; phone: string }
  >();
  for (const c of contacts) {
    const cleanPhone = c.phone.replace(/[^\d+]/g, '');
    if (cleanPhone && !uniqueMap.has(cleanPhone)) {
      uniqueMap.set(cleanPhone, { ...c, phone: cleanPhone });
    }
  }

  return Array.from(uniqueMap.values());
}

export async function getCampaignMetrics(
  accountId: string,
  campaignId: string
): Promise<CampaignData | null> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    account_id: data.account_id,
    name: data.name,
    template_name: data.template_name,
    status: data.status || 'draft',
    total_recipients: data.total_recipients || 0,
    sent_count: data.sent_count || 0,
    delivered_count: data.delivered_count || 0,
    read_count: data.read_count || 0,
    failed_count: data.failed_count || 0,
    replies_count: data.replies_count || 0,
    conversion_count: data.conversion_count || 0,
    message_body: data.message_body,
    created_at: data.created_at,
  };
}

export async function createCampaign(
  accountId: string,
  data: {
    name: string;
    messageBody: string;
    targetTags?: string[];
    filter?: AudienceFilter;
  }
): Promise<CampaignData> {
  const db = getAdminClient();

  const { data: created, error } = await db
    .from('broadcast_campaigns')
    .insert({
      account_id: accountId,
      name: data.name,
      status: 'draft',
      message_body: data.messageBody,
      target_tags: data.targetTags || [],
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
      replies_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create campaign: ${error?.message}`);
  }

  await coreEvents.emit('campaign.created', accountId, {
    campaignId: created.id,
    name: data.name,
  });

  return {
    id: created.id,
    account_id: created.account_id,
    name: created.name,
    status: created.status || 'draft',
    total_recipients: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    replies_count: 0,
    message_body: created.message_body,
    created_at: created.created_at,
  };
}

/**
 * Executes a broadcast campaign run with duplicate send prevention and tenant isolation.
 */
export async function executeCampaignSending({
  accountId,
  campaignId,
  filter,
  messageBody,
}: {
  accountId: string;
  campaignId: string;
  filter: AudienceFilter;
  messageBody: string;
}): Promise<{
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
}> {
  const db = getAdminClient();

  // 1. Resolve deduplicated audience strictly scoped to accountId
  const audience = await resolveCampaignAudience({ accountId, filter });

  // 2. Mark campaign as sending
  await db
    .from('broadcast_campaigns')
    .update({
      status: 'sending',
      total_recipients: audience.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('account_id', accountId);

  let sentCount = 0;
  let failedCount = 0;

  // 3. Dispatch messages with duplicate send prevention
  for (const recipient of audience) {
    try {
      const personalizedMsg = messageBody
        .replace(/{{Name}}/g, recipient.name)
        .replace(/{{PatientName}}/g, recipient.name);

      await sendWhatsAppMessage({
        tenantId: accountId,
        to: recipient.phone,
        type: 'text',
        text: personalizedMsg,
      });

      sentCount++;
    } catch {
      failedCount++;
    }
  }

  // 4. Mark campaign completed & update analytics
  await db
    .from('broadcast_campaigns')
    .update({
      status: 'completed',
      sent_count: sentCount,
      delivered_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('account_id', accountId);

  await coreEvents.emit('campaign.completed', accountId, {
    campaignId,
    totalRecipients: audience.length,
    sentCount,
    failedCount,
  });

  return {
    totalRecipients: audience.length,
    sentCount,
    failedCount,
  };
}
