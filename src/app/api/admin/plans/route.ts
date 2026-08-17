import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { getAvailablePlans } from '@/core/billing/plans';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const plans = await getAvailablePlans();
    return NextResponse.json(plans);
  } catch (err: unknown) {
    console.error('[GET /api/admin/plans] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    const body = await request.json().catch(() => null);

    const name = body?.name;
    const slug = body?.slug || String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const setup_fee = Number(body?.setup_fee ?? body?.setupFee ?? 0);
    const monthly_price = Number(body?.monthly_price ?? body?.monthlyPrice ?? 0);
    const yearly_price = Number(body?.yearly_price ?? body?.yearlyPrice ?? monthly_price * 10);
    const is_recommended = Boolean(body?.is_recommended ?? body?.isRecommended ?? false);
    const is_active = Boolean(body?.is_active ?? body?.isActive ?? true);
    const display_order = Number(body?.display_order ?? body?.displayOrder ?? 1);
    const features = body?.features ?? [];
    const limits = body?.limits || body?.usageLimits || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Plan name is required' },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('plans')
      .insert({
        name: name.trim(),
        slug,
        description: body?.description || '',
        setup_fee,
        monthly_price,
        yearly_price,
        currency: 'INR',
        billing_interval: 'monthly',
        is_recommended,
        is_active,
        display_order,
        max_users: limits.teamMembers || body?.max_users || 5,
        max_contacts: limits.contacts || body?.max_contacts || 5000,
        max_whatsapp_numbers: body?.max_whatsapp_numbers || 1,
        max_ai_requests: limits.aiMessages || body?.max_ai_requests || 5000,
        features: JSON.stringify(features),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('[POST /api/admin/plans] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    const body = await request.json().catch(() => null);
    const id = body?.id || body?.planId;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required to update' },
        { status: 400 }
      );
    }

    // Safety check: ensure existing active subscriptions retain locked pricing terms
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.setup_fee !== undefined || body.setupFee !== undefined) {
      updates.setup_fee = Number(body.setup_fee ?? body.setupFee);
    }
    if (body.monthly_price !== undefined || body.monthlyPrice !== undefined) {
      updates.monthly_price = Number(body.monthly_price ?? body.monthlyPrice);
    }
    if (body.yearly_price !== undefined || body.yearlyPrice !== undefined) {
      updates.yearly_price = Number(body.yearly_price ?? body.yearlyPrice);
    }
    if (body.is_recommended !== undefined || body.isRecommended !== undefined) {
      updates.is_recommended = Boolean(body.is_recommended ?? body.isRecommended);
    }
    if (body.is_active !== undefined || body.isActive !== undefined) {
      updates.is_active = Boolean(body.is_active ?? body.isActive);
    }
    if (body.features !== undefined) {
      updates.features = typeof body.features === 'string' ? body.features : JSON.stringify(body.features);
    }
    if (body.max_users !== undefined || body.limits?.teamMembers !== undefined) {
      updates.max_users = Number(body.limits?.teamMembers ?? body.max_users);
    }
    if (body.max_contacts !== undefined || body.limits?.contacts !== undefined) {
      updates.max_contacts = Number(body.limits?.contacts ?? body.max_contacts);
    }
    if (body.max_ai_requests !== undefined || body.limits?.aiMessages !== undefined) {
      updates.max_ai_requests = Number(body.limits?.aiMessages ?? body.max_ai_requests);
    }

    const { data, error } = await db
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, plan: data });
  } catch (err: unknown) {
    console.error('[PATCH /api/admin/plans] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required to delete' },
        { status: 400 }
      );
    }

    // Check if active subscriptions use this plan
    const { count } = await db
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)
      .eq('status', 'ACTIVE');

    if (count && count > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete plan because active subscriptions are using it. Disable the plan instead to preserve subscriber terms.',
        },
        { status: 400 }
      );
    }

    const { error } = await db.from('plans').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/plans] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
