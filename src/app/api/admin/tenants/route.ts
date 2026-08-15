import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // 1. Fetch Accounts
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Fetch Profiles
    const { data: profilesData } = await supabase.from('profiles').select('*');

    // 3. Fetch Subscriptions
    const { data: subsData } = await supabase.from('subscriptions').select('*');

    // 4. Fetch Contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('id, account_id');

    const accounts = accountsData || [];
    const profiles = profilesData || [];
    const subs = subsData || [];
    const contacts = contactsData || [];

    const profilesByAccount: Record<string, typeof profiles> = {};
    profiles.forEach((p) => {
      const accId = String(p.account_id || 'default_account');
      if (!profilesByAccount[accId]) {
        profilesByAccount[accId] = [];
      }
      profilesByAccount[accId].push(p);
    });

    const contactsCountByAccount: Record<string, number> = {};
    contacts.forEach((c) => {
      const accId = String(c.account_id || 'default_account');
      contactsCountByAccount[accId] = (contactsCountByAccount[accId] || 0) + 1;
    });

    const subByAccount: Record<string, Record<string, unknown>> = {};
    subs.forEach((s) => {
      const accId = String(s.account_id || 'default_account');
      subByAccount[accId] = s;
    });

    // Ensure all account_ids from profiles exist in accounts array
    const accountMap = new Map<string, Record<string, unknown>>();
    accounts.forEach((acc) => {
      const id = String(acc.id);
      accountMap.set(id, acc);
    });

    // Synthesize missing accounts from profiles
    Object.keys(profilesByAccount).forEach((accId) => {
      if (!accountMap.has(accId)) {
        accountMap.set(accId, {
          id: accId,
          name:
            accId === 'default_account'
              ? 'Helpa Health Clinic'
              : 'Clinic Account',
          created_at: new Date().toISOString(),
        });
      }
    });

    // If still empty, add default account for primary clinic
    if (accountMap.size === 0) {
      accountMap.set('default_account', {
        id: 'default_account',
        name: 'Helpa Health Clinic',
        created_at: new Date().toISOString(),
      });
    }

    const tenantList = Array.from(accountMap.values()).map((acc) => {
      const accId = String(acc.id || 'default_account');
      const accProfiles = profilesByAccount[accId] || profiles;
      const ownerProfile =
        accProfiles.find((p) => p.user_id === acc.owner_user_id) ||
        accProfiles.find(
          (p) => p.account_role === 'owner' || p.role === 'owner'
        ) ||
        accProfiles[0] ||
        null;
      const subInfo = subByAccount[accId] || null;

      return {
        id: accId,
        name: String(acc.name || 'Helpa Health Clinic'),
        created_at: String(acc.created_at || new Date().toISOString()),
        owner: ownerProfile
          ? {
              full_name:
                (ownerProfile.full_name as string) ||
                (ownerProfile.name as string) ||
                'Account Owner',
              email: (ownerProfile.email as string) || '',
            }
          : null,
        membersCount: accProfiles.length || 1,
        contactsCount: contactsCountByAccount[accId] || 0,
        subscription: subInfo
          ? {
              status: (subInfo.status as string) || 'active',
              end_date: (subInfo.end_date as string) || null,
              plan: {
                id: 'plan_growth',
                name: 'Growth Plan',
              },
            }
          : {
              status: 'active',
              end_date: null,
              plan: {
                id: 'plan_growth',
                name: 'Growth Plan',
              },
            },
        usage: {
          aiRequests: 0,
          whatsappMessages: 0,
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

    const body = (await request.json().catch(() => null)) as {
      tenantId?: string;
      planId?: string;
      status?: 'trial' | 'active' | 'expired' | 'cancelled';
      endDate?: string;
    } | null;

    const tenantId = body?.tenantId || 'default_account';
    const supabase = getSupabaseAdminClient();

    // Update or create subscription record
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('account_id', tenantId)
      .limit(1)
      .maybeSingle();

    const endDate =
      body?.endDate || new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    if (existing) {
      await supabase
        .from('subscriptions')
        .update({
          status: body?.status || 'active',
          end_date: endDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('subscriptions').insert({
        account_id: tenantId,
        status: body?.status || 'active',
        end_date: endDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant subscription updated successfully',
    });
  } catch (err) {
    console.error('[PATCH /api/admin/tenants] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update tenant' },
      { status: 500 }
    );
  }
}
