import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { getPlanBySlug } from '@/core/billing/plans';
import {
  checkPlanLimits,
  getWorkspaceSubscription,
} from '@/lib/saas/subscription';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const isDowngrade = targetPlan.monthlyPrice < currentPlan.monthlyPrice;

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

    const db = getAdminClient();
    const nextEndDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    const isFirstTimePayment = !currentSub.setupFeePaid;
    const initialPaymentAmount = isFirstTimePayment
      ? targetPlan.setupFee + targetPlan.monthlyPrice
      : targetPlan.monthlyPrice;

    // Fetch existing sub
    const { data: existing } = await db
      .from('subscriptions')
      .select('id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (existing) {
      await db
        .from('subscriptions')
        .update({
          plan_slug: targetPlan.slug,
          status: 'ACTIVE',
          setup_fee_paid: true,
          setup_fee_amount: targetPlan.setupFee,
          monthly_amount: targetPlan.monthlyPrice,
          currency: targetPlan.currency,
          end_date: nextEndDate,
          was_upgraded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await db.from('subscriptions').insert({
        account_id: ctx.accountId,
        plan_slug: targetPlan.slug,
        status: 'ACTIVE',
        setup_fee_paid: true,
        setup_fee_amount: targetPlan.setupFee,
        monthly_amount: targetPlan.monthlyPrice,
        currency: targetPlan.currency,
        end_date: nextEndDate,
        was_upgraded: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Insert Invoice / Payment Record
    const billNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    await db.from('payments').insert({
      account_id: ctx.accountId,
      invoice_number: billNumber,
      description: `Subscription to ${targetPlan.name} Plan (${isFirstTimePayment ? 'Setup Fee + First Month' : 'Monthly Renewal'})`,
      setup_fee: isFirstTimePayment ? targetPlan.setupFee : 0,
      monthly_subscription: targetPlan.monthlyPrice,
      amount: initialPaymentAmount,
      currency: targetPlan.currency,
      status: 'Paid',
      provider: 'helpa_billing',
      provider_payment_id: `pay_${Date.now()}`,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Subscription successfully updated to ${targetPlan.name} Plan!`,
      plan: targetPlan,
      initialPaymentAmount,
      status: 'ACTIVE',
      endDate: nextEndDate,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
