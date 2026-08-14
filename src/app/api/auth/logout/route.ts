import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getRuntimeConfig,
  RuntimeConfigurationError,
} from '@/lib/runtime-config';

export async function POST() {
  try {
    const runtime = getRuntimeConfig();
    if (runtime.authProvider !== 'supabase') {
      return NextResponse.json(
        { success: false, error: 'AUTH_PROVIDER_UNAVAILABLE' },
        { status: 503 }
      );
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      return NextResponse.json(
        { success: false, error: 'LOGOUT_FAILED' },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, redirect: '/login' });
  } catch (error) {
    const code =
      error instanceof RuntimeConfigurationError
        ? 'AUTH_PROVIDER_UNAVAILABLE'
        : 'LOGOUT_FAILED';
    return NextResponse.json({ success: false, error: code }, { status: 503 });
  }
}
