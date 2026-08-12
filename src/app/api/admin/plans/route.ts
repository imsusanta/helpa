import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    let plans: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('plans')
        .select('*')
        .order('monthly_price', { ascending: true });
      plans = res.data || [];
    } catch (e) {
      console.warn('[plans] plans fetch error:', e);
    }

    if (plans.length === 0) {
      plans = [
        {
          id: 'plan_growth',
          name: 'Growth',
          monthly_price: 2900,
          yearly_price: 29000,
          max_users: 10,
          max_contacts: 2000,
          max_whatsapp_numbers: 3,
          max_ai_requests: 1000,
          features: ['ai_chat', 'pipelines', 'automations'],
        },
        {
          id: 'plan_enterprise',
          name: 'Enterprise',
          monthly_price: 9900,
          yearly_price: 99000,
          max_users: 50,
          max_contacts: 25000,
          max_whatsapp_numbers: 10,
          max_ai_requests: 10000,
          features: ['ai_chat', 'pipelines', 'automations', 'custom_models'],
        },
      ];
    }

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
    const monthly_price = body?.monthly_price ?? 0;
    const yearly_price = body?.yearly_price ?? 0;
    const max_users = body?.max_users ?? 5;
    const max_contacts = body?.max_contacts ?? 500;
    const max_whatsapp_numbers = body?.max_whatsapp_numbers ?? 1;
    const max_ai_requests = body?.max_ai_requests ?? 100;
    const features = body?.features ?? [];

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
        monthly_price,
        yearly_price,
        max_users,
        max_contacts,
        max_whatsapp_numbers,
        max_ai_requests,
        features: JSON.stringify(features),
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
    const id = body?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required to update' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.monthly_price !== undefined)
      updates.monthly_price = body.monthly_price;
    if (body.yearly_price !== undefined)
      updates.yearly_price = body.yearly_price;
    if (body.max_users !== undefined) updates.max_users = body.max_users;
    if (body.max_contacts !== undefined)
      updates.max_contacts = body.max_contacts;
    if (body.max_whatsapp_numbers !== undefined)
      updates.max_whatsapp_numbers = body.max_whatsapp_numbers;
    if (body.max_ai_requests !== undefined)
      updates.max_ai_requests = body.max_ai_requests;
    if (body.features !== undefined)
      updates.features = JSON.stringify(body.features);

    const { data, error } = await db
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
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

    const { error } = await db.from('plans').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          {
            error:
              'Cannot delete plan because active subscriptions are using it.',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/plans] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
