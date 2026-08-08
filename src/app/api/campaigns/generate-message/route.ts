import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import { applyAiSafety } from '@/lib/ai/safety';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

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
        { error: 'Campaign generation halted: prompt contains emergency medical references.' },
        { status: 400 }
      );
    }
    if (safety.isDiagnostic) {
      return NextResponse.json(
        { error: 'Campaign generation halted: diagnostic or prescription advice requests are restricted.' },
        { status: 400 }
      );
    }
    const safePrompt = safety.safeText;

    // 2. Fetch API Key and Model Config
    const { data: account, error } = await ctx.supabase
      .from('accounts')
      .select('openrouter_api_key, openrouter_model')
      .eq('id', ctx.accountId)
      .single();

    if (error || !account?.openrouter_api_key) {
      return NextResponse.json(
        {
          error:
            'OpenRouter API Key is not configured. Please configure it in Settings → Advanced AI Settings first.',
        },
        { status: 400 }
      );
    }

    let api_key = '';
    try {
      api_key = decrypt(account.openrouter_api_key);
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to decrypt OpenRouter API Key.' },
        { status: 500 }
      );
    }

    const model = account.openrouter_model || 'google/gemini-2.5-flash';

    // 3. Formulate Prompt
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

    // 4. Call OpenRouter API
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api_key.trim()}`,
          'HTTP-Referer': 'https://wacrmsusanta.vercel.app',
          'X-Title': 'Helpa',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      let errorDetail = errText;
      try {
        const errJson = JSON.parse(errText);
        errorDetail = errJson.error?.message || errJson.message || errText;
      } catch {}
      return NextResponse.json(
        { error: `AI Writer Error: ${errorDetail}` },
        { status: response.status }
      );
    }

    const resJson = await response.json();
    const generatedMessage = resJson.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({ message: generatedMessage });
  } catch (err: any) {
    console.error('Error generating campaign message:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
