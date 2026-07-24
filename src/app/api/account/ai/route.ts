import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { encrypt } from '@/lib/whatsapp/encryption'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveSystemPrompt } from '@/modules/registry'

export async function GET() {
  try {
    const ctx = await requireRole('admin')
    const db = supabaseAdmin()

    const { data: account, error } = await db
      .from('accounts')
      .select('openrouter_model, openrouter_api_key, ai_system_prompt, welcome_message, industry')
      .eq('id', ctx.accountId)
      .single()

    if (error) {
      console.error('[GET /api/account/ai] fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch AI configuration: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      openrouter_model: account?.openrouter_model || '',
      has_api_key: !!account?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        account?.industry,
        account?.ai_system_prompt,
      ),
      welcome_message: account?.welcome_message || '',
    })
  } catch (err: any) {
    console.error('[GET /api/account/ai] exception:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch AI configuration' },
      { status: err?.status || 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin')

    const limit = checkRateLimit(`admin:ai-config:${ctx.userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const openrouter_api_key = body?.openrouter_api_key
    const openrouter_model = body?.openrouter_model
    const ai_system_prompt = body?.ai_system_prompt
    const welcome_message = body?.welcome_message

    const updates: Record<string, unknown> = {}

    if (typeof openrouter_model === 'string') {
      updates.openrouter_model = openrouter_model.trim()
    }

    if (typeof openrouter_api_key === 'string') {
      const keyTrimmed = openrouter_api_key.trim()
      if (keyTrimmed.length > 0) {
        updates.openrouter_api_key = encrypt(keyTrimmed)
      } else if (openrouter_api_key === '') {
        updates.openrouter_api_key = null
      }
    }

    if (typeof ai_system_prompt === 'string') {
      updates.ai_system_prompt = ai_system_prompt.trim()
    }

    if (typeof welcome_message === 'string') {
      updates.welcome_message = welcome_message.trim()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const { data, error } = await db
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select('openrouter_model, openrouter_api_key, ai_system_prompt, welcome_message, industry')
      .single()

    if (error) {
      console.error('[PATCH /api/account/ai] update error:', error)
      return NextResponse.json({ error: 'Failed to update AI configuration: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      openrouter_model: data?.openrouter_model || '',
      has_api_key: !!data?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        data?.industry,
        data?.ai_system_prompt,
      ),
      welcome_message: data?.welcome_message || '',
    })
  } catch (err: any) {
    console.error('[PATCH /api/account/ai] exception:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to update AI configuration' },
      { status: err?.status || 500 }
    )
  }
}
