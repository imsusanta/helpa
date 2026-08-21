import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      return NextResponse.json(
        { success: false, error: 'LOGOUT_FAILED' },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, redirect: '/login' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'LOGOUT_FAILED' },
      { status: 503 }
    );
  }
}
