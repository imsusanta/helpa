import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import type { SendTimeParams } from '@/lib/whatsapp/template-send-builder'
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

/**
 * Two input shapes are accepted:
 *
 *   NEW (preferred — supports per-recipient variable substitution):
 *     {
 *       recipients: Array<{ phone: string; params: string[] }>,
 *       template_name, template_language
 *     }
 *
 *   LEGACY (all phones receive the same params — kept so existing
 *   callers don't break):
 *     {
 *       phone_numbers: string[],
 *       template_params: string[],
 *       template_name, template_language
 *     }
 *
 * Previous implementation only supported the legacy shape, and the
 * sending hook was forced to ship every batch with `templateParams[0]`
 * — meaning every recipient got contact-0's personalization. The new
 * shape is what actually fixes that.
 */
interface NewRecipient {
  phone: string
  /** Body variable values, one per {{N}}. Legacy field. */
  params?: string[]
  /**
   * Structured per-send values (header text variable, media URL
   * override, URL/COPY_CODE button values). When set, takes
   * precedence over `params` for the body too — see
   * sendTemplateMessage for the merge rules.
   */
  messageParams?: SendTimeParams
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Per-user broadcast budget. Note: this limits how often a user
    // can *start* a campaign, not how many messages go out inside
    // one — the fan-out loop below runs without additional gating.
    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Resolve the caller's account_id. whatsapp_config + templates
    // + broadcasts are all account-scoped post-multi-user, so the
    // old `.eq('user_id', user.id)` filters miss every row created
    // by a teammate.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'lab_ready') {
      const { reportId } = body
      if (!reportId) return NextResponse.json({ error: 'reportId is required' }, { status: 400 })

      const { data: report, error: repErr } = await supabase
        .from('lab_reports')
        .select('*, patient:contacts(*)')
        .eq('id', reportId)
        .eq('account_id', accountId)
        .single()

      if (repErr || !report || !report.patient) {
        return NextResponse.json({ error: 'Lab report or patient not found' }, { status: 404 })
      }

      let conversationId = ""
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', report.patient_id)
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conv) {
        conversationId = conv.id
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            account_id: accountId,
            contact_id: report.patient_id,
            status: 'open',
          })
          .select()
          .single()
        conversationId = newConv.id
      }

      const text = `📋 *LAB REPORT READY:* Hello ${report.patient.name},\nYour laboratory report for the test *${report.test_name}* is now ready.\n\n*Findings Summary:*\n${report.result_summary || 'N/A'}\n\n*Report Link:*\n${report.file_url || 'Available at front desk'}\n\nThank you for choosing WACRM Healthcare.`

      const { engineSendText } = await import('@/lib/automations/meta-send')
      await engineSendText({
        accountId,
        userId: user.id,
        conversationId,
        contactId: report.patient_id,
        text,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'billing_reminder') {
      const { invoiceId } = body
      if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })

      const { data: invoice, error: invErr } = await supabase
        .from('billing_invoices')
        .select('*, patient:contacts(*)')
        .eq('id', invoiceId)
        .eq('account_id', accountId)
        .single()

      if (invErr || !invoice || !invoice.patient) {
        return NextResponse.json({ error: 'Invoice or patient not found' }, { status: 404 })
      }

      let conversationId = ""
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', invoice.patient_id)
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conv) {
        conversationId = conv.id
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            account_id: accountId,
            contact_id: invoice.patient_id,
            status: 'open',
          })
          .select()
          .single()
        conversationId = newConv.id
      }

      const text = `💵 *OUTSTANDING PAYMENT REMINDER:* Hello ${invoice.patient.name},\nThis is a friendly reminder that invoice *${invoice.invoice_number}* is currently unpaid.\n\n*Amount Due:* $${invoice.amount / 100}\n*Due Date:* ${invoice.due_date || 'Immediate'}\n\nPlease settle this bill online or at our billing desk. If you have already paid, please ignore this notice.`

      const { engineSendText } = await import('@/lib/automations/meta-send')
      await engineSendText({
        accountId,
        userId: user.id,
        conversationId,
        contactId: invoice.patient_id,
        text,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'feedback') {
      const { appointmentId } = body
      if (!appointmentId) return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })

      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .select('*, patient:contacts(*), doctor:hospital_doctors(*)')
        .eq('id', appointmentId)
        .eq('account_id', accountId)
        .single()

      if (apptErr || !appt || !appt.patient) {
        return NextResponse.json({ error: 'Appointment or patient not found' }, { status: 404 })
      }

      let conversationId = ""
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', appt.patient_id)
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conv) {
        conversationId = conv.id
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            account_id: accountId,
            contact_id: appt.patient_id,
            status: 'open',
          })
          .select()
          .single()
        conversationId = newConv.id
      }

      const text = `⭐ *FEEDBACK REQUEST:* Hello ${appt.patient.name},\nWe hope you had a good consultation with ${appt.doctor?.name || 'our doctor'} today.\n\nCould you please rate your experience from 1 to 5? You can reply directly to this chat with your rating and any comments.\n\nThank you for helping us serve you better!`

      const { engineSendText } = await import('@/lib/automations/meta-send')
      await engineSendText({
        accountId,
        userId: user.id,
        conversationId,
        contactId: appt.patient_id,
        text,
      })

      return NextResponse.json({ success: true })
    }

    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
    } = body

    // Normalize to a list of {phone, params} regardless of shape.
    let recipients: NewRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params)
        ? template_params
        : []
      recipients = phone_numbers.map((phone: string) => ({
        phone,
        params: shared,
      }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array',
        },
        { status: 400 }
      )
    }

    if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 }
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Load the template row once so sendTemplateMessage can build
    // header + button components on each iteration. Loading inside
    // the loop would N+1 against Supabase for every recipient.
    // Guard against a malformed local row crashing every send in
    // the loop with the same opaque TypeError — fail loudly once.
    const { data: rawTemplateRow } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', template_name)
      .eq('language', template_language || 'en_US')
      .maybeSingle()
    if (rawTemplateRow && !isMessageTemplate(rawTemplateRow)) {
      return NextResponse.json(
        {
          error:
            'Template row is malformed locally — run "Sync from Meta" in Settings to repair it before broadcasting.',
        },
        { status: 500 },
      )
    }
    const templateRow = rawTemplateRow ?? null

    const results: BroadcastResult[] = []
    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      const sanitized = sanitizePhoneForMeta(recipient.phone)

      if (!isValidE164(sanitized)) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: 'Invalid phone number format',
        })
        failedCount++
        continue
      }

      // Retry with phone variants on "not in allowed list" so numbers
      // that differ only in a trunk-prefix 0 still reach recipients.
      const variants = phoneVariants(sanitized)
      let sentMessageId: string | null = null
      let lastError: string | null = null

      for (const variant of variants) {
        try {
          const result = await sendTemplateMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: variant,
            templateName: template_name,
            language: template_language || 'en_US',
            template: templateRow ?? undefined,
            messageParams: recipient.messageParams,
            params: recipient.params ?? [],
          })
          sentMessageId = result.messageId
          lastError = null
          break
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          if (!isRecipientNotAllowedError(errorMessage)) {
            lastError = errorMessage
            break
          }
          lastError = errorMessage
          // retry with next variant
        }
      }

      if (sentMessageId) {
        results.push({
          phone: recipient.phone,
          status: 'sent',
          whatsapp_message_id: sentMessageId,
        })
        sentCount++
      } else {
        console.error(
          `Failed to send broadcast to ${recipient.phone}:`,
          lastError
        )
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: lastError || 'Unknown error',
        })
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Error in WhatsApp broadcast POST:', error)
    return NextResponse.json(
      { error: 'Failed to process broadcast' },
      { status: 500 }
    )
  }
}
