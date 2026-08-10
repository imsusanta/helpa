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

    // 1. Fetch all accounts
    const { data: accounts, error: accError } = await db
      .from('accounts')
      .select('id, name, created_at, owner_user_id')
      .order('created_at', { ascending: false });

    if (accError) throw accError;

    // 2. Fetch all profiles to find owners and member counts
    const { data: profiles, error: profError } = await db
      .from('profiles')
      .select('account_id, email, full_name, user_id');

    if (profError) throw profError;

    // 3. Fetch all subscriptions and plans
    const { data: subs, error: subError } = await db
      .from('subscriptions')
      .select('account_id, status, end_date, plan:plans(*)');

    if (subError) throw subError;

    // 4. Fetch usage tracking for current month
    const { data: usage, error: usageError } = await db
      .from('usage_tracking')
      .select('account_id, ai_requests, whatsapp_messages')
      .eq('month', currentMonth);

    if (usageError) throw usageError;

    // 5. Fetch contacts counts grouped by account_id
    const { data: contacts, error: conError } = await db
      .from('contacts')
      .select('account_id');

    if (conError) throw conError;

    // Aggregate statistics in memory
    const profilesByAccount: Record<string, typeof profiles> = {};
    profiles.forEach((p) => {
      if (!profilesByAccount[p.account_id!]) {
        profilesByAccount[p.account_id!] = [];
      }
      profilesByAccount[p.account_id!].push(p);
    });

    const contactsCountByAccount: Record<string, number> = {};
    contacts?.forEach((c) => {
      contactsCountByAccount[c.account_id!] =
        (contactsCountByAccount[c.account_id!] || 0) + 1;
    });

    const subByAccount: Record<string, (typeof subs)[0]> = {};
    subs?.forEach((s) => {
      subByAccount[s.account_id] = s;
    });

    const usageByAccount: Record<string, (typeof usage)[0]> = {};
    usage?.forEach((u) => {
      usageByAccount[u.account_id] = u;
    });

    const tenantList = accounts.map((acc) => {
      const accProfiles = profilesByAccount[acc.id] || [];
      const ownerProfile =
        accProfiles.find((p) => p.user_id === acc.owner_user_id) ||
        accProfiles[0] ||
        null;
      const subInfo = subByAccount[acc.id] || null;
      const usageInfo = usageByAccount[acc.id] || null;

      return {
        id: acc.id,
        name: acc.name,
        created_at: acc.created_at,
        owner: ownerProfile
          ? {
              full_name: ownerProfile.full_name,
              email: ownerProfile.email,
            }
          : null,
        membersCount: accProfiles.length,
        contactsCount: contactsCountByAccount[acc.id] || 0,
        subscription: subInfo
          ? {
              status: subInfo.status,
              end_date: subInfo.end_date,
              plan: subInfo.plan,
            }
          : null,
        usage: {
          aiRequests: usageInfo?.ai_requests || 0,
          whatsappMessages: usageInfo?.whatsapp_messages || 0,
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
