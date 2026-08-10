import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const limit = checkRateLimit(
      `admin:ai-test:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    let api_key = body?.openrouter_api_key;
    let model = body?.openrouter_model;

    // If key is empty/not provided or is a password placeholder, fetch and decrypt from DB
    if (!api_key || api_key.trim() === '' || api_key.includes('••••')) {
      const { data: account, error } = await ctx.appwrite
        .from('accounts')
        .select('openrouter_api_key')
        .eq('id', ctx.accountId)
        .single();

      if (error) {
        console.error('[POST /api/account/ai/test] db fetch error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch saved API credentials' },
          { status: 500 }
        );
      }

      if (!account?.openrouter_api_key) {
        return NextResponse.json(
          { error: 'OpenRouter API Key is not configured' },
          { status: 400 }
        );
      }

      try {
        api_key = decrypt(account.openrouter_api_key);
      } catch (err) {
        console.error('[POST /api/account/ai/test] decryption error:', err);
        if (process.env.OPENROUTER_API_KEY) {
          api_key = process.env.OPENROUTER_API_KEY;
        } else {
          return NextResponse.json(
            {
              error:
                'Saved API Key cannot be decrypted with the current ENCRYPTION_KEY. Please enter your OpenRouter API Key in the field above and click "Save AI Configuration".',
            },
            { status: 400 }
          );
        }
      }
    }

    if (!model || model.trim() === '') {
      const { data: account } = await ctx.appwrite
        .from('accounts')
        .select('openrouter_model')
        .eq('id', ctx.accountId)
        .single();
      model = account?.openrouter_model || 'google/gemini-2.5-flash';
    }

    // Call OpenRouter completions endpoint with a simple confirmation prompt
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api_key.trim()}`,
          'HTTP-Referer': 'https://wacrm.tech',
          'X-Title': 'wacrm',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content:
                'Respond with a single word confirming this is a test: "Success"',
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      let errorDetail = errText;
      try {
        const errJson = JSON.parse(errText);
        errorDetail = errJson.error?.message || errJson.message || errText;
      } catch {
        // ignore json parse errors
      }
      return NextResponse.json(
        { error: `OpenRouter API Error: ${errorDetail}` },
        { status: response.status }
      );
    }

    const resJson = await response.json();
    const aiText = resJson.choices?.[0]?.message?.content?.trim();

    if (!aiText) {
      return NextResponse.json(
        { error: 'Received empty response from OpenRouter' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: aiText });
  } catch (err) {
    return toErrorResponse(err);
  }
}
