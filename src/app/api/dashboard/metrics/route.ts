import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { getIndustryModule } from "@/modules/registry";

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("viewer"); // viewer is sufficient to view dashboard
    const body = await request.json();
    const { industry } = body || {};

    const activeModule = getIndustryModule(industry || (ctx.account as any)?.industry);
    const metricsResult: Record<string, number> = {};

    // Get today's local date string YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    // Execute each dynamic query
    for (const metric of activeModule.dashboardMetrics) {
      let query = ctx.supabase
        .from(metric.queryTable)
        .select("*", { count: "exact", head: true })
        .eq("account_id", ctx.accountId);

      // Apply filters if any
      if (metric.queryFilters) {
        for (const filter of metric.queryFilters) {
          let val = filter.value;
          if (val === 'TODAY') {
            val = todayStr;
          }
          
          if (filter.operator === 'eq') {
            query = query.eq(filter.field, val);
          } else if (filter.operator === 'neq') {
            query = query.neq(filter.field, val);
          } else if (filter.operator === 'gt') {
            query = query.gt(filter.field, val);
          } else if (filter.operator === 'lt') {
            query = query.lt(filter.field, val);
          }
        }
      }

      const { count, error } = await query;
      if (error) {
        console.error(`[dashboard metrics] failed query for ${metric.key}:`, error);
        metricsResult[metric.key] = 0;
      } else {
        metricsResult[metric.key] = count || 0;
      }
    }

    // Always fetch general AI/chat metrics as well for dynamic cards
    const { count: unreadCount } = await ctx.supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("account_id", ctx.accountId)
      .eq("status", "open");

    const { count: campaignsCount } = await ctx.supabase
      .from("broadcasts")
      .select("id", { count: "exact", head: true })
      .eq("account_id", ctx.accountId);

    metricsResult.unread_chats = unreadCount || 0;
    metricsResult.campaigns_total = campaignsCount || 0;

    return NextResponse.json({
      success: true,
      metrics: metricsResult,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
export async function GET(request: Request) {
  return POST(request);
}
