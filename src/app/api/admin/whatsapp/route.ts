import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // 1. Fetch Accounts
    const { data: accountsData } = await db
      .from('accounts')
      .select('id, name, industry, created_at')
      .order('created_at', { ascending: false });

    // 2. Fetch WhatsApp configs from canonical and fallback tables
    let configsList: Array<Record<string, unknown>> = [];
    try {
      const { data: c1 } = await db.from('whatsapp_configs').select('*');
      if (c1) configsList = [...configsList, ...c1];
    } catch {
      // ignore
    }

    try {
      const { data: c2 } = await db.from('whatsapp_config').select('*');
      if (c2) configsList = [...configsList, ...c2];
    } catch {
      // ignore
    }

    // 3. Fetch recent messages for last activity
    const { data: messages } = await db
      .from('messages')
      .select('account_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const accounts = accountsData || [];
    const configByAccount: Record<string, Record<string, unknown>> = {};
    configsList.forEach((cfg) => {
      const accId = String(
        cfg.account_id || cfg.accountId || 'default_account'
      );
      configByAccount[accId] = cfg;
    });

    const lastActivityByAccount: Record<string, string> = {};
    messages?.forEach((m: { account_id?: string; created_at?: string }) => {
      const accId = String(m.account_id || 'default_account');
      if (!lastActivityByAccount[accId] && m.created_at) {
        lastActivityByAccount[accId] = m.created_at;
      }
    });

    // Ensure fallback account if none exists
    const accountList =
      accounts.length > 0
        ? accounts
        : [
            {
              id: 'default_account',
              name: 'Helpa Health Clinic',
              industry: 'hospital_clinic',
              created_at: new Date().toISOString(),
            },
          ];

    const result = accountList.map((acc) => {
      const accId = String(acc.id);
      const cfg = configByAccount[accId];
      const isConnected = Boolean(
        cfg &&
        (cfg.is_active === true ||
          cfg.status === 'connected' ||
          cfg.phone_number ||
          cfg.phoneNumber ||
          cfg.waba_id ||
          cfg.wabaId)
      );

      const rawPhone = String(
        cfg?.display_phone_number ||
          cfg?.phone_number ||
          cfg?.phoneNumber ||
          '+91 98765 43210'
      );

      return {
        id: accId,
        name: acc.name || 'Helpa Health Clinic',
        industry: acc.industry || 'hospital_clinic',
        created_at: acc.created_at || new Date().toISOString(),
        whatsapp: {
          connected: isConnected,
          status: isConnected ? 'connected' : 'disconnected',
          phoneNumber: rawPhone,
          wabaId: cfg?.waba_id || cfg?.wabaId ? '••••••••' : null,
          phoneNumberId:
            cfg?.phone_number_id || cfg?.phoneNumberId ? '••••••••' : null,
          lastActivity: lastActivityByAccount[accId] || null,
        },
      };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[GET /api/admin/whatsapp] error:', err);
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

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID required' },
        { status: 400 }
      );
    }

    const db = appwriteAdmin();

    try {
      await db.from('whatsapp_configs').delete().eq('accountId', accountId);
    } catch {
      // ignore
    }

    try {
      await db.from('whatsapp_config').delete().eq('account_id', accountId);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/whatsapp] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
