import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  flattenStepsTree,
  type BuilderStepInput,
} from '@/lib/automations/steps-tree';
import {
  getIndustryModule,
  isValidIndustry,
  resolveCanonicalIndustry,
} from '@/modules/registry';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner');
    const admin = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const {
      industry,
      reset,
      reconfigure,
      name: workspaceName,
      logo,
      location,
      city,
      workingDays,
      openingTime,
      closingTime,
      welcomeMessage,
      services,
      timezone: _timezone,
      country: _country,
    } = body || {};

    if (reset) {
      // Template reset resets industry to general and removes seeded workflows
      // but PRESERVES truthful onboarding_completed_at and onboarding_exempted_at markers.
      const { error: accErr } = await admin
        .from('accounts')
        .update({
          industry: 'general',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ctx.accountId);

      if (accErr) {
        console.error('[onboard route] failed to reset industry:', accErr);
        throw accErr;
      }
      const { data: seededAutos } = await admin
        .from('automations')
        .select('id, metadata')
        .eq('account_id', ctx.accountId);
      const seededIds = (seededAutos ?? [])
        .filter(
          (automation) =>
            (automation.metadata as Record<string, unknown> | null)
              ?.helpa_seeded_workflow === true
        )
        .map((automation) => automation.id);
      if (seededIds.length > 0) {
        await admin
          .from('automation_steps')
          .delete()
          .in('automation_id', seededIds);
        await admin
          .from('automations')
          .delete()
          .eq('account_id', ctx.accountId)
          .in('id', seededIds);
      }
      return NextResponse.json({ success: true, reset: true });
    }

    if (!industry || typeof industry !== 'string') {
      return NextResponse.json(
        { error: 'Industry selection is required.' },
        { status: 400 }
      );
    }

    if (!isValidIndustry(industry)) {
      return NextResponse.json(
        { error: 'Please select a valid business type.' },
        { status: 400 }
      );
    }

    const validIndustryId = resolveCanonicalIndustry(industry);
    const config = getIndustryModule(validIndustryId);

    // Construct tailored system prompt with location & business hours
    const effectiveLocation = location || city || '';
    let tailoredPrompt = config.systemPrompt;
    if (effectiveLocation || (openingTime && closingTime)) {
      const hoursText =
        openingTime && closingTime
          ? `${workingDays || 'Monday - Saturday'}: ${openingTime} to ${closingTime}`
          : 'Standard operating hours';
      const locText = effectiveLocation
        ? `Location / City: ${effectiveLocation}`
        : '';
      tailoredPrompt = `${tailoredPrompt}\n\nBUSINESS PROFILE & OPERATING HOURS:\nBusiness Name: ${workspaceName || 'Our Business'}\n${locText}\nOperating Hours: ${hoursText}\nAlways quote official prices accurately and direct customers politely.`;
    }

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

    // Prepare Knowledge Base items
    const kbItems: Array<{
      category: 'faq' | 'service' | 'pricing' | 'policy' | 'company';
      question_title: string;
      answer_content: string;
    }> = [];

    if (effectiveLocation || (openingTime && closingTime)) {
      kbItems.push({
        category: 'company',
        question_title:
          'Where are you located and what are your business hours?',
        answer_content: `We are located at ${effectiveLocation || 'our main location'}. Our working hours are ${workingDays || 'Monday to Saturday'} from ${openingTime || '9:00 AM'} to ${closingTime || '8:00 PM'}.`,
      });
    }

    if (Array.isArray(services) && services.length > 0) {
      for (const s of services) {
        if (s?.name && s?.price !== undefined) {
          const priceFormatted = `₹${Number(s.price).toLocaleString()}`;
          const desc = s.description ? ` Details: ${s.description}` : '';
          kbItems.push({
            category: 'pricing',
            question_title: `How much does ${s.name} cost?`,
            answer_content: `The price for ${s.name} is ${priceFormatted}.${desc}`,
          });
          kbItems.push({
            category: 'service',
            question_title: `Do you provide ${s.name}?`,
            answer_content: `Yes! We offer ${s.name} at ${priceFormatted}.${desc}`,
          });
        }
      }
    }

    if (config.kbTemplates && config.kbTemplates.length > 0) {
      config.kbTemplates.forEach((kb) => {
        kbItems.push({
          category: kb.category as
            'faq' | 'service' | 'pricing' | 'policy' | 'company',
          question_title: kb.questionTitle,
          answer_content: kb.answerContent,
        });
      });
    }

    // Prepare campaign templates
    const campaigns = (config.campaignTemplates || []).map((camp) => ({
      name: camp.name,
      category: camp.category,
      message_body: camp.messageBody,
      cta_type: camp.ctaType || 'none',
      cta_text: camp.ctaText || null,
      cta_url: camp.ctaUrl || null,
      attachment_url: camp.attachmentUrl || null,
      attachment_type: camp.attachmentType || null,
    }));

    // Prepare workflows with preserved parent/child and yes/no branching
    const workflows = (config.workflows || []).map((w) => ({
      name: w.name,
      description: w.description || '',
      trigger_type: w.trigger_type,
      trigger_config: w.trigger_config || {},
      is_active: Boolean(w.is_active),
      seed_key: w.seedKey || '',
      steps: flattenStepsTree(
        (w.steps || []) as unknown as BuilderStepInput[]
      ).map((st) => ({
        id: st.id,
        parent_step_id: st.parent_step_id,
        branch: st.branch,
        step_type: st.step_type,
        step_config: st.step_config || {},
        position: st.position,
      })),
    }));

    // Call atomic transactional RPC (single transaction with account lock,
    // pre-write eligibility recheck, all writes, and completion marker)
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      'complete_workspace_onboarding',
      {
        p_account_id: ctx.accountId,
        p_user_id: ctx.userId,
        p_industry: validIndustryId,
        p_workspace_name: workspaceName || null,
        p_logo: logo || null,
        p_ai_system_prompt: tailoredPrompt,
        p_welcome_message: welcomeMessage || null,
        p_all_known_modules: allKnownModules,
        p_pipeline_stages: config.pipelineStages || [],
        p_kb_items: kbItems,
        p_campaigns: campaigns,
        p_workflows: workflows,
        p_reconfigure: Boolean(reconfigure),
      }
    );

    if (rpcError) {
      console.error('[onboard route] atomic RPC failed:', rpcError);
      return NextResponse.json(
        {
          error: rpcError.message || 'Failed to complete workspace onboarding',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...rpcResult,
      industry: validIndustryId,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
