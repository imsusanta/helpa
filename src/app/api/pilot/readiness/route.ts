import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

type CountResult = { count: number | null; error: { message?: string } | null };

async function countEq(
  admin: ReturnType<typeof getAdminClient>,
  table: string,
  accountId: string,
  extra?: Record<string, string>
): Promise<number | null> {
  let query = admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId);
  if (extra) {
    for (const [column, value] of Object.entries(extra)) {
      query = query.eq(column, value);
    }
  }
  const { count, error } = (await query) as CountResult;
  if (error) return null;
  return count ?? 0;
}

function publicEnvironment(): 'production' | 'preview' | 'development' {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === 'production' || vercel === 'preview') return vercel;
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await requireRole('admin');
    const admin = getAdminClient();

    const { data: account } = await admin
      .from('accounts')
      .select('id, name, industry, status')
      .eq('id', ctx.accountId)
      .maybeSingle();

    const { data: whatsapp } = await admin
      .from('whatsapp_configs')
      .select(
        'provider, status, last_health_check_at, last_webhook_at, phone_number_id, connection_status'
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const [
      members,
      pendingInvites,
      doctors,
      appointments,
      automations,
      knowledge,
      deadLetters,
      outboxFailed,
    ] = await Promise.all([
      countEq(admin, 'account_members', ctx.accountId),
      countEq(admin, 'account_invitations', ctx.accountId, {
        status: 'pending',
      }),
      countEq(admin, 'hospital_doctors', ctx.accountId),
      countEq(admin, 'appointments', ctx.accountId),
      countEq(admin, 'automations', ctx.accountId),
      countEq(admin, 'knowledge_base', ctx.accountId),
      countEq(admin, 'webhook_dead_letter', ctx.accountId),
      countEq(admin, 'outbound_outbox', ctx.accountId, { status: 'failed' }),
    ]);

    const status = String(
      whatsapp?.connection_status || whatsapp?.status || ''
    ).toLowerCase();
    const connected =
      Boolean(whatsapp?.phone_number_id) &&
      status !== 'disconnected' &&
      status !== 'error';

    const blockers: string[] = [];
    if (!connected) blockers.push('whatsapp_not_connected');
    if ((doctors ?? 0) === 0) blockers.push('no_doctors');
    if ((knowledge ?? 0) === 0) blockers.push('no_knowledge_base');
    if ((members ?? 0) < 1) blockers.push('no_members');

    return NextResponse.json(
      {
        clinic: {
          accountId: ctx.accountId,
          name: account?.name || ctx.account.name,
          industry: account?.industry || null,
          status: account?.status || null,
        },
        environment: publicEnvironment(),
        integration: {
          whatsapp: {
            connected,
            provider: whatsapp?.provider || null,
            status:
              whatsapp?.status || whatsapp?.connection_status || 'unknown',
            lastWebhookAt: whatsapp?.last_webhook_at || null,
            lastHealthCheckAt: whatsapp?.last_health_check_at || null,
          },
        },
        config: {
          members,
          pendingInvites,
          doctors,
          appointments,
          automations,
          knowledgeBaseArticles: knowledge,
        },
        errors: {
          webhookDeadLetters: deadLetters,
          outboundFailed: outboxFailed,
        },
        blockers,
        supportNeeds: blockers,
      },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
