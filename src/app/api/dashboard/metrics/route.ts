import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getIndustryModule } from '@/modules/registry';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const { industry, range = '30d' } = body || {};

    const activeModule = getIndustryModule(
      industry || (ctx.account as { industry?: string })?.industry
    );
    const metricsResult: Record<string, number> = {};

    const now = new Date();
    let startDate: string | null = null;
    if (range === 'today') {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      startDate = startOfDay.toISOString();
    } else if (range === '7d') {
      startDate = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (range === '30d') {
      startDate = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (range === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (range === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
    }

    const todayStr = now.toISOString().split('T')[0];
    const industryMetricResults = await Promise.all(
      activeModule.dashboardMetrics.map(async (metric) => {
        let query = supabase
          .from(metric.queryTable)
          .select('*', { count: 'exact', head: true })
          .eq('account_id', ctx.accountId);

        for (const filter of metric.queryFilters ?? []) {
          let value = filter.value;
          if (
            typeof value === 'string' &&
            value.toUpperCase() === 'TODAY'
          ) {
            value = todayStr;
          }

          if (filter.operator === 'eq') {
            query = query.eq(filter.field, value);
          } else if (filter.operator === 'neq') {
            query = query.neq(filter.field, value);
          } else if (filter.operator === 'gt') {
            query = query.gt(filter.field, value);
          } else if (filter.operator === 'lt') {
            query = query.lt(filter.field, value);
          } else if (filter.operator === 'gte') {
            query = query.gte(filter.field, value);
          } else if (filter.operator === 'lte') {
            query = query.lte(filter.field, value);
          }
        }

        const { count } = await query;
        return [metric.key, count || 0] as const;
      })
    );

    for (const [key, value] of industryMetricResults) {
      metricsResult[key] = value;
    }

    let leadsQuery = supabase
      .from('leads')
      .select('id, stage, value, created_at')
      .eq('account_id', ctx.accountId);

    let dealsQuery = supabase
      .from('deals')
      .select('id, status, value, created_at')
      .eq('account_id', ctx.accountId);

    let invoicesQuery = supabase
      .from('invoices')
      .select('id, status, total, amount_paid, created_at')
      .eq('account_id', ctx.accountId);

    const contactsQuery = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId);

    if (startDate) {
      leadsQuery = leadsQuery.gte('created_at', startDate);
      dealsQuery = dealsQuery.gte('created_at', startDate);
      invoicesQuery = invoicesQuery.gte('created_at', startDate);
    }

    const [
      { data: leadsList },
      { data: dealsList },
      { data: invoicesList },
      { count: contactsCount },
      { count: unreadCount },
      { count: campaignsCount },
    ] = await Promise.all([
      leadsQuery,
      dealsQuery,
      invoicesQuery,
      contactsQuery,
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', ctx.accountId)
        .eq('status', 'open'),
      supabase
        .from('broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', ctx.accountId),
    ]);

    const totalLeads = leadsList?.length || 0;
    const newLeads = leadsList?.filter((lead) => lead.stage === 'NEW').length || 0;
    const convertedLeads =
      leadsList?.filter((lead) => lead.stage === 'CONVERTED').length || 0;

    const pipelineDealsValue = (dealsList || [])
      .filter((deal) => deal.status === 'open')
      .reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);

    const wonDealsValue = (dealsList || [])
      .filter((deal) => deal.status === 'won')
      .reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);

    const invoicedTotal = (invoicesList || []).reduce(
      (sum, invoice) => sum + (Number(invoice.total) || 0),
      0
    );
    const collectedRevenue = (invoicesList || []).reduce(
      (sum, invoice) => sum + (Number(invoice.amount_paid) || 0),
      0
    );

    metricsResult.leads_total = totalLeads;
    metricsResult.leads_new = newLeads;
    metricsResult.leads_converted = convertedLeads;
    metricsResult.contacts_total = contactsCount || 0;
    metricsResult.customers_total = contactsCount || 0;
    metricsResult.pipeline_value = pipelineDealsValue;
    metricsResult.deals_won_value = wonDealsValue;
    metricsResult.invoiced_revenue = invoicedTotal;
    metricsResult.collected_revenue = collectedRevenue;
    metricsResult.unread_chats = unreadCount || 0;
    metricsResult.campaigns_total = campaignsCount || 0;

    return NextResponse.json(
      { success: true, metrics: metricsResult, range },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
