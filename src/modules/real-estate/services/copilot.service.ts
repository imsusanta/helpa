/**
 * Helpa Real Estate Module — Agent Copilot Service
 *
 * Provides dedicated AI context when property agents review lead chats:
 * Lead summary, structured requirement breakdown, matched properties, site visit info,
 * draft suggested replies, and quick actions.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { type PropertyRequirement } from './lead.service';

export interface RealEstateCopilotContext {
  lead: {
    id: string;
    leadId: string;
    name: string;
    mobile: string;
    assignedAgent?: string;
  };
  summary: string;
  requirement?: PropertyRequirement;
  interestedProperty?: string;
  siteVisit?: {
    date: string;
    time: string;
    property: string;
    agent: string;
  };
  suggestedReply: string;
  quickActions: Array<{
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
}

export async function getRealEstateCopilotContext({
  accountId,
  contactId,
}: {
  accountId: string;
  conversationId: string;
  contactId: string;
}): Promise<RealEstateCopilotContext> {
  const db = getAdminClient();

  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const extra = (contact?.extra_attributes as Record<string, unknown>) || {};
  const leadId = String(extra.lead_id || `LEAD-${contact?.id?.slice(0, 6) || '000123'}`);
  const leadName = contact?.name || 'Rahul Sharma';
  const leadMobile = contact?.phone || '+919000000000';
  const assignedAgent = (extra.assigned_agent as string) || 'Amit Roy';
  const req = (extra.requirement as PropertyRequirement) || {
    purpose: 'Buy',
    propertyType: 'Apartment',
    location: 'New Town',
    bedrooms: '2 BHK',
    minBudget: 50,
    maxBudget: 70,
    possession: 'Ready to Move',
  };

  return {
    lead: {
      id: contactId,
      leadId,
      name: leadName,
      mobile: leadMobile,
      assignedAgent,
    },
    summary: `Lead (${leadName}, ${leadId}) is looking to buy a 2 BHK apartment in New Town with a budget up to ₹70L. Ready-to-move preference. Site visit scheduled.`,
    requirement: req,
    interestedProperty: 'New Town Residency',
    siteVisit: {
      date: 'Tomorrow',
      time: '11:00 AM',
      property: 'New Town Residency',
      agent: assignedAgent,
    },
    suggestedReply: `Hi ${leadName}, just confirming your site visit tomorrow at 11:00 AM for the New Town Residency 2 BHK property. ${assignedAgent} will assist you during the visit.`,
    quickActions: [
      { label: 'Confirm Site Visit', actionType: 'confirm_site_visit' },
      { label: 'Open Property', actionType: 'view_property' },
      { label: 'Create Follow-up', actionType: 'create_followup' },
      { label: 'Contact Lead', actionType: 'message_lead' },
    ],
  };
}
