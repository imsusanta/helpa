import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: supabaseUser },
      error: supabaseErr,
    } = await supabase.auth.getUser();

    if (!supabaseErr && supabaseUser) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name:
            supabaseUser.user_metadata?.full_name ||
            supabaseUser.user_metadata?.name ||
            supabaseUser.email?.split('@')[0] ||
            'User',
          created_at: supabaseUser.created_at,
        },
      });
    }

    // Fallback: Check account context
    try {
      const accountContext = await getCurrentAccount();
      if (accountContext?.userId) {
        return NextResponse.json({
          success: true,
          authenticated: true,
          user: {
            id: accountContext.userId,
            email: accountContext.email,
            name: accountContext.account?.name || 'User',
            created_at: new Date().toISOString(),
          },
        });
      }
    } catch {
      // Unauthenticated
    }

    return NextResponse.json(
      { success: false, authenticated: false, user: null, error: 'No active session' },
      { status: 401 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        user: null,
        error: (err as Error).message || 'Failed to verify session',
      },
      { status: 500 }
    );
  }
}
