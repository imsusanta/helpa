import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import { getPlanBySlug } from '@/core/billing/plans';
import {
  checkPlanLimits,
  getWorkspaceSubscription,
  hasPaidAccess,
} from '@/lib/saas/subscription';

/**
 * POST /api/account/upgrade — change the workspace plan.
 *
 * This endpoint never activates a subscription and never marks the setup
 * fee as paid — payments happen exclusively through
 * /api/billing/create-order + the verified Razorpay webhook.
 *
 * Allowed here (owner-only):
 * - Downgrade of an already-paid, currently-entitled subscription to a
 *   cheaper active plan (no new money owed; period end is unchanged).
 * Everything else responds 402 and points the client at the payment flow.
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
      ''
    )
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (!requestedSlug) {
      return NextResponse.json(
        { error: 'A planSlug is required' },
        { status: 400 }
      );
    }

    const targetPlan = await getPlanBySlug(requestedSlug);
    if (!targetPlan.isActive) {
      return NextResponse.json(
        { error: `Plan '${requestedSlug}' is not available` },
        { status: 404 }
      );
    }

    const {
      subscription: currentSub,
      plan: currentPlan,
      hasSubscriptionRow,
    } = await getWorkspaceSubscription(ctx.accountId);

    const isFreeDowngrade =
      hasSubscriptionRow &&
      hasPaidAccess(currentSub) &&
      currentSub.setupFeePaid === true &&
      targetPlan.monthlyPrice < currentPlan.monthlyPrice;

    if (!isFreeDowngrade) {
      // Upgrades, first-time purchases, and lapsed subscriptions all
      // require a real payment; nothing is activated here.
      return NextResponse.json(
        {
          error: 'Payment required to activate this plan.',
          requiresPayment: true,
          plan: {
            id: targetPlan.id,
            name: targetPlan.name,
            slug: targetPlan.slug,
            setupFee: targetPlan.setupFee,
            monthlyPrice: targetPlan.monthlyPrice,
          },
          nextStep: 'POST /api/billing/create-order',
        },
        { status: 402 }
      );
    }

    // Downgrade guardrails: current usage must fit the smaller plan.
    if (!body?.confirmDowngrade) {
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

    const db = getAdminClient();
    const nowIso = new Date().toISOString();

    // Plan change only: status, setup-fee state, and period end are
    // untouched; the next renewal bills the cheaper plan.
    const { error: updateErr } = await db
      .from('subscriptions')
      .update({
        plan_slug: targetPlan.slug,
        monthly_amount: targetPlan.monthlyPrice,
        updated_at: nowIso,
      })
      .eq('account_id', ctx.accountId);
    if (updateErr) {
      console.error('[account/upgrade] downgrade update failed:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update the plan. Please try again.' },
        { status: 500 }
      );
    }

    const { error: auditErr } = await db.from('audit_logs').insert({
      account_id: ctx.accountId,
      action: 'billing.plan_downgraded',
      target_type: 'subscription',
      metadata: {
        from_plan: currentPlan.slug,
        to_plan: targetPlan.slug,
        actor_user_id: ctx.userId,
      },
    });
    if (auditErr) {
      console.error('[account/upgrade] audit insert failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Plan changed to ${targetPlan.name}. Your current billing period is unchanged; the new price applies from the next renewal.`,
      plan: targetPlan,
      status: currentSub.status,
      endDate: currentSub.currentPeriodEnd,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
