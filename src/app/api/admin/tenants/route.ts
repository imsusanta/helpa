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
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    let accounts: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('accounts')
        .select('id, name, created_at, owner_user_id')
        .order('created_at', { ascending: false });
      accounts = res.data || [];
    } catch (e) {
      console.warn('[tenants] accounts fetch error:', e);
    }

    if (accounts.length === 0) {
      accounts = [
        {
          id: 'default_account',
          name: 'Clinic Account',
          created_at: new Date().toISOString(),
          owner_user_id: null,
        },
      ];
    }

    let profiles: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('profiles')
        .select('account_id, email, full_name, user_id');
      profiles = res.data || [];
    } catch (e) {
      console.warn('[tenants] profiles fetch error:', e);
    }

    let subs: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('subscriptions')
        .select('account_id, status, end_date, plan:plans(*)');
      subs = res.data || [];
    } catch (e) {
      console.warn('[tenants] subscriptions fetch error:', e);
    }

    let usage: Array<Record<string, unknown>> = [];
    try {
      const res = await db
        .from('usage_tracking')
        .select('account_id, ai_requests, whatsapp_messages')
        .eq('month', currentMonth);
      usage = res.data || [];
    } catch (e) {
      console.warn('[tenants] usage_tracking fetch error:', e);
    }

    let contacts: Array<Record<string, unknown>> = [];
    try {
      const res = await db.from('contacts').select('account_id');
      contacts = res.data || [];
    } catch (e) {
      console.warn('[tenants] contacts fetch error:', e);
    }

    // Aggregate statistics in memory
    const profilesByAccount: Record<string, typeof profiles> = {};
    profiles.forEach((p) => {
      const accId = String(p.account_id || '');
      if (accId) {
        if (!profilesByAccount[accId]) {
          profilesByAccount[accId] = [];
        }
        profilesByAccount[accId].push(p);
      }
    });

    const contactsCountByAccount: Record<string, number> = {};
    contacts.forEach((c) => {
      const accId = String(c.account_id || '');
      if (accId) {
        contactsCountByAccount[accId] =
          (contactsCountByAccount[accId] || 0) + 1;
      }
    });

    const subByAccount: Record<string, (typeof subs)[0]> = {};
    subs.forEach((s) => {
      const accId = String(s.account_id || '');
      if (accId) {
        subByAccount[accId] = s;
      }
    });

    const usageByAccount: Record<string, (typeof usage)[0]> = {};
    usage.forEach((u) => {
      const accId = String(u.account_id || '');
      if (accId) {
        usageByAccount[accId] = u;
      }
    });

    const tenantList = accounts.map((acc) => {
      const accId = String(acc.id || 'default_account');
      const accProfiles = profilesByAccount[accId] || [];
      const ownerProfile =
        accProfiles.find((p) => p.user_id === acc.owner_user_id) ||
        accProfiles[0] ||
        null;
      const subInfo = subByAccount[accId] || null;
      const usageInfo = usageByAccount[accId] || null;

      return {
        id: accId,
        name: String(acc.name || 'Clinic Account'),
        created_at: String(acc.created_at || new Date().toISOString()),
        owner: ownerProfile
          ? {
              full_name: (ownerProfile.full_name as string) || 'Admin User',
              email: (ownerProfile.email as string) || 'admin@clinic.local',
            }
          : null,
        membersCount: accProfiles.length,
        contactsCount: contactsCountByAccount[accId] || 0,
        subscription: subInfo
          ? {
              status:
                (subInfo.status as
                  | 'trial'
                  | 'active'
                  | 'expired'
                  | 'cancelled') || 'trial',
              end_date: (subInfo.end_date as string) || '',
              plan: (subInfo.plan as { id: string; name: string }) || {
                id: 'plan_growth',
                name: 'Growth',
              },
            }
          : null,
        usage: {
          aiRequests: Number(usageInfo?.ai_requests || 0),
          whatsappMessages: Number(usageInfo?.whatsapp_messages || 0),
        },
      };
    });

    return NextResponse.json(tenantList);
  } catch (err: unknown) {
    console.error('[GET /api/admin/tenants] error:', err);
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
    const accountId = body?.accountId;
    const planId = body?.planId;
    const status = body?.status; // 'trial', 'active', 'expired', 'cancelled'
    const endDate = body?.endDate;

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (planId) updates.plan_id = planId;
    if (status) updates.status = status;
    if (endDate) updates.end_date = endDate;

    // Check if subscription exists for the tenant, if not insert one
    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    let result;
    if (existingSub) {
      const { data, error } = await db
        .from('subscriptions')
        .update(updates)
        .eq('account_id', accountId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Must supply planId and endDate to provision new subscription
      if (!planId || !endDate) {
        return NextResponse.json(
          { error: 'New subscriptions require planId and endDate' },
          { status: 400 }
        );
      }
      const { data, error } = await db
        .from('subscriptions')
        .insert({
          account_id: accountId,
          plan_id: planId,
          status: status || 'trial',
          end_date: endDate,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[PATCH /api/admin/tenants] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
