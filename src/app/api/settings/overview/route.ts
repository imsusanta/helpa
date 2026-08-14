import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const accountId = ctx.accountId;
    const userId = ctx.userId;

    let membersCount = 0;
    let pendingInvitesCount = 0;
    let templatesCount = 0;
    let templatesPendingCount = 0;
    let tagsCount = 0;
    let customFieldsCount = 0;

    // 1. Supabase PostgreSQL queries
    try {
      const supabase = getSupabaseAdminClient();

      const [
        membersRes,
        invitesRes,
        templatesRes,
        pendingTemplatesRes,
        tagsRes,
        fieldsRes,
      ] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId),
        supabase
          .from('account_invitations')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'pending'),
        supabase
          .from('message_templates')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId),
        supabase
          .from('message_templates')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'PENDING'),
        supabase
          .from('tags')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId),
        supabase
          .from('custom_fields')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId),
      ]);

      if (membersRes.status === 'fulfilled') {
        membersCount = membersRes.value.count ?? 0;
      }
      if (invitesRes.status === 'fulfilled') {
        pendingInvitesCount = invitesRes.value.count ?? 0;
      }
      if (templatesRes.status === 'fulfilled') {
        templatesCount = templatesRes.value.count ?? 0;
      }
      if (pendingTemplatesRes.status === 'fulfilled') {
        templatesPendingCount = pendingTemplatesRes.value.count ?? 0;
      }
      if (tagsRes.status === 'fulfilled') {
        tagsCount = tagsRes.value.count ?? 0;
      }
      if (fieldsRes.status === 'fulfilled') {
        customFieldsCount = fieldsRes.value.count ?? 0;
      }
    } catch {
      // Fallback to Appwrite counts
      const admin = appwriteAdmin();
      const [membersRes, templatesRes, tagsRes] = await Promise.allSettled([
        admin.from('profiles').select('id').eq('accountId', accountId),
        admin.from('message_templates').select('id').eq('userId', userId),
        admin.from('tags').select('id').eq('userId', userId),
      ]);

      if (
        membersRes.status === 'fulfilled' &&
        Array.isArray(membersRes.value.data)
      ) {
        membersCount = membersRes.value.data.length;
      }
      if (
        templatesRes.status === 'fulfilled' &&
        Array.isArray(templatesRes.value.data)
      ) {
        templatesCount = templatesRes.value.data.length;
      }
      if (tagsRes.status === 'fulfilled' && Array.isArray(tagsRes.value.data)) {
        tagsCount = tagsRes.value.data.length;
      }
    }

    return NextResponse.json({
      success: true,
      counts: {
        members: Math.max(membersCount, 1),
        pendingInvites: pendingInvitesCount,
        templates: templatesCount,
        templatesPending: templatesPendingCount,
        tags: tagsCount,
        customFields: customFieldsCount,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
