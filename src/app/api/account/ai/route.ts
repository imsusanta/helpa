import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { encrypt } from '@/lib/whatsapp/encryption'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveSystemPrompt } from '@/modules/registry'

export async function GET() {
  try {
    const ctx = await requireRole('admin')

    const { data: account, error } = await ctx.supabase
      .from('accounts')
      .select('openrouter_model, openrouter_api_key, ai_system_prompt, industry')
      .eq('id', ctx.accountId)
      .single()

    if (error) {
      console.error('[GET /api/account/ai] fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch AI configuration' }, { status: 500 })
    }

    return NextResponse.json({
      openrouter_model: account?.openrouter_model || '',
      has_api_key: !!account?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        account?.industry,
        account?.ai_system_prompt,
      ),
    })
  } catch (err) {
    return toErrorResponse(err)
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select('openrouter_model, openrouter_api_key, ai_system_prompt, industry')
      .single()

    if (error) {
      console.error('[PATCH /api/account/ai] update error:', error)
      return NextResponse.json({ error: 'Failed to update AI configuration' }, { status: 500 })
    }

    return NextResponse.json({
      openrouter_model: data?.openrouter_model || '',
      has_api_key: !!data?.openrouter_api_key,
      ai_system_prompt: resolveSystemPrompt(
        data?.industry,
        data?.ai_system_prompt,
      ),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
