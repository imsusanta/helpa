import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { ID, Query } from 'node-appwrite';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      planId?: string;
      planName?: string;
    } | null;

    const planName = body?.planName || body?.planId || 'Growth';
    const db = getAppwriteAdminClient().databases;

    // Check existing subscription
    const existing = await db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      'subscriptions',
      [Query.equal('account_id', ctx.accountId), Query.limit(1)]
    ).catch(() => ({ documents: [] }));

    const nextEndDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    if (existing.documents[0]) {
      await db.updateDocument(
        APPWRITE_CONFIG.databaseId,
        'subscriptions',
        existing.documents[0].$id,
        {
          status: 'active',
          end_date: nextEndDate,
          updated_at: new Date().toISOString(),
        }
      ).catch(() => null);
    } else {
      await db.createDocument(
        APPWRITE_CONFIG.databaseId,
        'subscriptions',
        ID.unique(),
        {
          account_id: ctx.accountId,
          status: 'active',
          end_date: nextEndDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      message: `Subscription upgraded to ${planName} Plan successfully!`,
      planName,
      status: 'active',
      endDate: nextEndDate,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
