import { NextResponse } from 'next/server';
import { getAvailablePlans } from '@/core/billing/plans';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = await getAvailablePlans();

    const formattedPlans = plans
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        setup_fee: p.setupFee,
        monthly_price: p.monthlyPrice,
        yearly_price: p.yearlyPrice,
        currency: p.currency,
        currency_symbol: '₹',
        billing_interval: p.billingInterval,
        is_recommended: p.isRecommended,
        is_active: p.isActive,
        display_order: p.displayOrder,
        features: p.features,
        max_users: p.usageLimits.teamMembers,
        max_contacts: p.usageLimits.contacts,
        max_whatsapp_numbers: p.slug === 'pro' ? 5 : p.slug === 'growth' ? 2 : 1,
        max_ai_requests: p.usageLimits.aiMessages,
        max_whatsapp_messages: p.usageLimits.whatsappMessages,
        limits: p.usageLimits,
      }))
      .sort((a, b) => a.display_order - b.display_order);

    return NextResponse.json(formattedPlans, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[GET /api/plans] error:', error);
    return NextResponse.json([], {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
}
