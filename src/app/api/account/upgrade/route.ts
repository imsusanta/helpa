import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import { getPlanBySlug, resolvePlanRowId } from '@/core/billing/plans';
import {
  checkPlanLimits,
  getWorkspaceSubscription,
} from '@/lib/saas/subscription';

/**
 * Plan change endpoint for changes that do NOT expand paid entitlement:
 * downgrades and free-plan switches. It never activates a paid plan,
 * never extends end_date, and never marks anything as paid — paid
 * upgrades and renewals must go through Razorpay checkout
 * (/api/billing/create-order) and are applied by the verified webhook.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner');

    const body = (await request.json().catch(() => null)) as {
      planId?: string;
      planSlug?: string;
      planName?: string;
      confirmDowngrade?: boolean;
    } | null;

    const requestedSlug = (
      body?.planSlug ||
      body?.planName ||
      body?.planId ||
      'growth'
    )
      .toLowerCase()
      .replace(/[^a-z]/g, '');

    const targetPlan = await getPlanBySlug(requestedSlug);
    const { subscription: currentSub, plan: currentPlan } =
      await getWorkspaceSubscription(ctx.accountId);

    const isPaidPlan = targetPlan.monthlyPrice > 0 || targetPlan.setupFee > 0;
    const isDowngrade = targetPlan.monthlyPrice < currentPlan.monthlyPrice;

    // Fail closed on anything that would grant new paid entitlement
    // without a verified payment.
    if (isPaidPlan && !isDowngrade) {
      return NextResponse.json(
        {
          error: 'PAYMENT_REQUIRED',
          message:
            'Paid plan changes require checkout. Start a payment via /api/billing/create-order.',
        },
        { status: 402 }
      );
    }

    // Check usage limits if downgrading
    if (isDowngrade && !body?.confirmDowngrade) {
      const contactsCheck = await checkPlanLimits(
        ctx.accountId,
        'max_contacts'
      );
      const usersCheck = await checkPlanLimits(ctx.accountId, 'max_users');

      const warnings: string[] = [];
      if (contactsCheck.currentUsage > targetPlan.usageLimits.contacts) {
        warnings.push(
          `Your current contacts (${contactsCheck.currentUsage}) exceed the ${targetPlan.name} limit (${targetPlan.usageLimits.contacts}).`
        );
      }
      if (usersCheck.currentUsage > targetPlan.usageLimits.teamMembers) {
        warnings.push(
          `Your current team members (${usersCheck.currentUsage}) exceed the ${targetPlan.name} limit (${targetPlan.usageLimits.teamMembers}).`
        );
      }

      if (warnings.length > 0) {
        return NextResponse.json(
          {
            warning:
              'Your current usage exceeds the limits of the selected plan.',
            details: warnings,
            requiresConfirmation: true,
          },
          { status: 400 }
        );
      }
    }

    const planRowId = await resolvePlanRowId(targetPlan);
    if (!planRowId) {
      return NextResponse.json(
        { error: `Plan '${targetPlan.slug}' is not provisioned` },
        { status: 409 }
      );
    }

    const db = getAdminClient();
    const { data: existing } = await db
      .from('subscriptions')
      .select('id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: 'No subscription found for this workspace' },
        { status: 404 }
      );
    }

    // Change the plan only. Status and the prepaid end_date are left
    // untouched: a downgrade re-scopes features, it does not buy time.
    const { error: updateErr } = await db
      .from('subscriptions')
      .update({
        plan_id: planRowId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('[account/upgrade] plan change failed:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update subscription plan' },
        { status: 500 }
      );
    }

    await db.from('audit_logs').insert({
      account_id: ctx.accountId,
      action: 'subscription.plan_changed',
      target_type: 'subscription',
      metadata: {
        from_plan: currentPlan.slug,
        to_plan: targetPlan.slug,
        changed_by: ctx.userId,
        end_date: currentSub.currentPeriodEnd,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subscription plan changed to ${targetPlan.name}.`,
      plan: targetPlan,
      status: currentSub.status,
      endDate: currentSub.currentPeriodEnd,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
