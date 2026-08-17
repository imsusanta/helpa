import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { applyAiSafety } from '@/lib/ai/safety';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { executeAiCompletionWithFallback } from '@/core/ai/resolver';

export async function POST(request: Request) {
  try {
    // 1. Authenticate user as admin/owner
    const ctx = await requireRole('admin');

    const limit = checkRateLimit(
      `admin:campaign-ai:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const { category, prompt, doctorName, department } = body || {};

    if (!category || !prompt) {
      return NextResponse.json(
        { error: 'category and prompt are required' },
        { status: 400 }
      );
    }

    // 🛡️ AI Safety & Healthcare Guardrail Evaluation
    const safety = applyAiSafety(prompt);
    if (safety.isEmergency) {
      return NextResponse.json(
        {
          error:
            'Campaign generation halted: prompt contains emergency medical references.',
        },
        { status: 400 }
      );
    }
    if (safety.isDiagnostic) {
      return NextResponse.json(
        {
          error:
            'Campaign generation halted: diagnostic or prescription advice requests are restricted.',
        },
        { status: 400 }
      );
    }
    const safePrompt = safety.safeText;

    // 2. Formulate Prompt
    const systemPrompt = `You are a professional, warm, and friendly Indian healthcare copywriter. 
Your goal is to write a patient-focused, action-oriented WhatsApp campaign message.

Guidelines:
- Tone: Extremely professional, polite, reassuring, and clear.
- Scope: Keep it concise (WhatsApp message limit).
- Visuals: Use formatting like bold, bullet points, and appropriate emojis to make it highly scannable.
- Call to Action: Provide a very clear action step. E.g. "Reply BOOK to confirm your appointment", or "Click the link to write a review".
- Dynamic Parameters: Use placeholder tags like {{PatientName}} for name substitution if needed, but do not write other manual bracketed placeholders like [Doctor Name] — use the specific doctor's name provided in context.

Write a WhatsApp message for this campaign:`;

    const userMessage = `Campaign Category: ${category}
User Custom Request: ${safePrompt}
${doctorName ? `Doctor Name: Dr. ${doctorName}` : ''}
${department ? `Department: ${department}` : ''}`;

    // 3. Call Helpa AI Provider Engine with Primary + Fallback
    const res = await executeAiCompletionWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: {
        temperature: 0.7,
      },
      resolutionParams: {
        accountId: ctx.accountId,
        feature: 'CAMPAIGN',
      },
    });

    return NextResponse.json({ message: res.content.trim() });
  } catch (err: unknown) {
    console.error('Error generating campaign message:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
