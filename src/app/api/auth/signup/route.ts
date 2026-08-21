import { NextResponse } from 'next/server';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import {
  isValidIndustry,
  resolveCanonicalIndustry,
  getIndustryModule,
} from '@/modules/registry';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`signup_${ip}`, RATE_LIMITS.auth);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const {
      email,
      password,
      fullName,
      name,
      industry,
      businessType,
      businessName,
    } = body;
    const userName = name || fullName || '';
    const rawIndustry = industry || businessType;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long.',
        },
        { status: 400 }
      );
    }

    if (!rawIndustry || !isValidIndustry(rawIndustry)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please select a valid business type.',
        },
        { status: 400 }
      );
    }

    const canonicalIndustry = resolveCanonicalIndustry(rawIndustry);
    const trimmedEmail = email.trim().toLowerCase();

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: userName,
          industry: canonicalIndustry,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to create account.',
        },
        { status: 400 }
      );
    }

    if (data?.user) {
      const admin = getSupabaseAdminClient();
      const userId = data.user.id;

      // Ensure the account created by trigger receives the selected canonical industry
      try {
        const { data: member } = await admin
          .from('account_members')
          .select('account_id')
          .eq('user_id', userId)
          .maybeSingle();

        let accountId = member?.account_id;

        if (!accountId) {
          const { data: profile } = await admin
            .from('profiles')
            .select('account_id')
            .eq('user_id', userId)
            .maybeSingle();
          accountId = profile?.account_id;
        }

        if (!accountId) {
          const { data: acc } = await admin
            .from('accounts')
            .select('id')
            .eq('owner_user_id', userId)
            .maybeSingle();
          accountId = acc?.id;
        }

        if (accountId) {
          const moduleConfig = getIndustryModule(canonicalIndustry);
          const updatePayload: Record<string, unknown> = {
            industry: canonicalIndustry,
            updated_at: new Date().toISOString(),
          };
          if (businessName) {
            updatePayload.name = businessName;
          }
          if (moduleConfig?.systemPrompt) {
            updatePayload.ai_system_prompt = moduleConfig.systemPrompt;
          }

          await admin
            .from('accounts')
            .update(updatePayload)
            .eq('id', accountId);

          // Setup tenant module enable states
          const allKnownModules = [
            'hospital_clinic',
            'real_estate',
            'travel',
            'coaching',
            'restaurant',
            'gym',
            'solo_teacher',
            'salon',
          ];
          const nowIso = new Date().toISOString();
          const modulesToUpsert = allKnownModules.map((mod) => ({
            account_id: accountId,
            module_key: mod,
            enabled: moduleConfig.id === mod,
            settings: {},
            updated_at: nowIso,
          }));

          await admin.from('tenant_modules').upsert(modulesToUpsert, {
            onConflict: 'account_id, module_key',
          });
        }
      } catch (postSyncErr) {
        console.warn('[signup] account industry sync warning:', postSyncErr);
      }

      return NextResponse.json({
        success: true,
        redirect: '/dashboard',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userName,
          industry: canonicalIndustry,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete signup. Please try again.',
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          (err as Error).message || 'Server error during account creation.',
      },
      { status: 500 }
    );
  }
}
