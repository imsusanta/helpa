/**
 * Helpa Core Platform — Campaigns Engine
 *
 * Industry-agnostic outbound WhatsApp broadcast and audience segmentation engine.
 */

import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

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
  created_at?: string;
}

export async function getCampaignMetrics(
  accountId: string,
  campaignId: string
): Promise<CampaignData | null> {
  const db = appwriteAdmin();

  const { data, error } = await db
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) return null;
  return data as CampaignData;
}

export async function createCampaign(
  accountId: string,
  data: {
    name: string;
    messageBody: string;
    targetTags?: string[];
  }
): Promise<CampaignData> {
  const db = appwriteAdmin();

  const { data: created, error } = await db
    .from('broadcast_campaigns')
    .insert({
      account_id: accountId,
      name: data.name,
      status: 'draft',
      message_body: data.messageBody,
      target_tags: data.targetTags || [],
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

  return created as CampaignData;
}
