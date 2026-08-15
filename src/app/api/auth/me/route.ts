import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: supabaseUser },
      error: supabaseErr,
    } = await supabase.auth.getUser();

    if (supabaseErr || !supabaseUser) {
      return NextResponse.json(
        { success: false, user: null, error: 'No active session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
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
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        user: null,
        error: (err as Error).message || 'Failed to verify session',
      },
      { status: 500 }
    );
  }
}
