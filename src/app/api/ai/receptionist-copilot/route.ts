import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';
import {
  buildFallbackCopilotSnapshot,
  generateOpenRouterCopilotSnapshot,
  type CopilotAppointment,
  type CopilotContact,
  type CopilotConversationMemory,
  type CopilotDoctor,
  type CopilotKbEntry,
  type CopilotMessage,
  type CopilotReport,
  type CopilotSourceContext,
} from '@/lib/ai/receptionist-copilot';
import { decrypt } from '@/lib/whatsapp/encryption';
import { checkPlanLimits, incrementUsage } from '@/lib/saas/subscription';
import { resolveSystemPrompt } from '@/modules/registry';
import { resolveAccountAiConfig } from '@/core/ai/resolver';

type Related<T> = T | T[] | null | undefined;

interface ConversationRow {
  id: string;
  account_id: string;
  contact_id: string;
  status?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  ai_summary?: string | null;
  created_at?: string | null;
  contact?: Related<CopilotContact>;
}

interface AccountAiRow {
  name?: string | null;
  openrouter_api_key?: string | null;
  openrouter_model?: string | null;
  ai_system_prompt?: string | null;
  industry?: string | null;
}

function relatedOne<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isConversationRow(value: unknown): value is ConversationRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.account_id === 'string' &&
    typeof row.contact_id === 'string'
  );
}

async function loadCopilotContext(
  ctx: Awaited<ReturnType<typeof requireRole>>,
  conversationId: string
): Promise<CopilotSourceContext | NextResponse> {
  const { data: conversationData, error: conversationError } =
    await ctx.appwrite
      .from('conversations')
      .select(
        'id, account_id, contact_id, status, last_message_text, last_message_at, ai_summary, created_at, contact:contacts(id, name, phone, email, metadata)'
      )
      .eq('id', conversationId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

  if (conversationError) {
    console.error('[AI Copilot] conversation fetch error:', conversationError);
    return NextResponse.json(
      { error: 'Failed to load conversation' },
      { status: 500 }
    );
  }

  if (!isConversationRow(conversationData)) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  const conversation = conversationData;
  let contact = relatedOne(conversation.contact) as CopilotContact | null;

  if (!contact) {
    const { data: contactData, error: contactError } = await ctx.appwrite
      .from('contacts')
      .select('id, name, phone, email, metadata')
      .eq('id', conversation.contact_id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (contactError) {
      console.error('[AI Copilot] contact fetch error:', contactError);
      return NextResponse.json(
        { error: 'Failed to load patient contact' },
        { status: 500 }
      );
    }
    contact = contactData as CopilotContact | null;
  }

  if (!contact) {
    return NextResponse.json(
      { error: 'Patient contact not found' },
      { status: 404 }
    );
  }

  // Resilient queries that gracefully degrade if industry-specific tables/columns are not present
  const [
    messagesRes,
    memoryRes,
    appointmentsRes,
    reportsRes,
    kbRes,
    accountRes,
  ] = await Promise.all([
    ctx.appwrite
      .from('messages')
      .select('sender_type, content_type, content_text, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(120),
    ctx.appwrite
      .from('conversations')
      .select(
        'id, status, last_message_text, last_message_at, ai_summary, created_at'
      )
      .eq('account_id', ctx.accountId)
      .eq('contact_id', contact.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(8),
    Promise.resolve(
      ctx.appwrite
        .from('appointments')
        .select(
          'id, appointment_date, appointment_time, status, department, token_number, queue_position, booking_id, notes, created_at'
        )
        .eq('patient_id', contact.id)
        .eq('account_id', ctx.accountId)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(12)
    ).catch(() => ({ data: [], error: null })),
    Promise.resolve(
      ctx.appwrite
        .from('hospital_lab_reports')
        .select(
          'id, test_name, status, file_url, summary, report_date, created_at, updated_at'
        )
        .eq('patient_id', contact.id)
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })
        .limit(8)
    ).catch(() => ({ data: [], error: null })),
    Promise.resolve(
      ctx.appwrite
        .from('knowledge_base')
        .select('category, question_title, answer_content')
        .eq('account_id', ctx.accountId)
        .order('category', { ascending: true })
        .order('question_title', { ascending: true })
        .limit(30)
    ).catch(() => ({ data: [], error: null })),
    Promise.resolve(
      ctx.appwrite
        .from('accounts')
        .select('name, openrouter_api_key, openrouter_model, ai_system_prompt')
        .eq('id', ctx.accountId)
        .maybeSingle()
    ).catch(() => ({ data: null, error: null })),
  ]);

  const account = (accountRes?.data ?? {}) as AccountAiRow;
  const messages = ((messagesRes?.data ?? []) as CopilotMessage[]).reverse();

  return {
    accountName: account.name ?? ctx.account.name,
    contact,
    patient: null,
    messages,
    conversationMemory: (memoryRes?.data ?? []) as CopilotConversationMemory[],
    appointments: (appointmentsRes?.data ?? []) as Array<
      CopilotAppointment & { doctor?: Related<CopilotDoctor> }
    >,
    reports: (reportsRes?.data ?? []) as CopilotReport[],
    insuranceProviders: [],
    kbEntries: (kbRes?.data ?? []) as CopilotKbEntry[],
    contactNotes: [],
  };
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('viewer');

    const limit = await checkRateLimit(
      `ai-copilot:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const conversationId = body?.conversationId;

    if (typeof conversationId !== 'string' || conversationId.length === 0) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const contextOrResponse = await loadCopilotContext(ctx, conversationId);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const context = contextOrResponse;
    const account = await ctx.appwrite
      .from('accounts')
      .select(
        'openrouter_api_key, openrouter_model, ai_system_prompt, industry'
      )
      .eq('id', ctx.accountId)
      .maybeSingle();
    const accountData = (account.data ?? {}) as AccountAiRow;
    context.industry =
      (accountData.industry as string) ||
      (ctx.account.industry as string) ||
      null;

    let fallback = buildFallbackCopilotSnapshot(context);

    const aiConfig = await resolveAccountAiConfig(ctx.accountId, {
      feature: 'AI_COPILOT',
    });
    const apiKey =
      aiConfig.primary.apiKey ||
      aiConfig.fallback?.apiKey ||
      (accountData.openrouter_api_key
        ? decrypt(accountData.openrouter_api_key)
        : undefined);
    const model =
      aiConfig.primary.model ||
      accountData.openrouter_model ||
      'google/gemini-2.5-flash';

    if (!apiKey) {
      fallback = {
        ...fallback,
        warning:
          'AI provider is not configured. Showing a rules-based copilot snapshot.',
      };
      return NextResponse.json({ snapshot: fallback });
    }

    // Enforce the plan's AI request quota. checkPlanLimits reports via
    // its return value (it does not throw), so the result must be
    // honored explicitly.
    const limitCheck = await checkPlanLimits(ctx.accountId, 'max_ai_requests');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'AI_QUOTA_EXCEEDED',
          message:
            limitCheck.reason ||
            'Your monthly AI request limit has been reached. Please upgrade your plan.',
        },
        { status: 429 }
      );
    }

    try {
      const snapshot = await generateOpenRouterCopilotSnapshot({
        apiKey,
        model,
        systemPrompt: resolveSystemPrompt(
          accountData.industry,
          accountData.ai_system_prompt
        ),
        context,
        fallback,
      });
      await incrementUsage(ctx.accountId, 'ai_requests');
      return NextResponse.json({ snapshot });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'AI generation failed. Showing rules-based copilot snapshot.';
      console.error('[AI Copilot] OpenRouter generation failed:', err);
      return NextResponse.json({
        snapshot: buildFallbackCopilotSnapshot(context, message),
      });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
