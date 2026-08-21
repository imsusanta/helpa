import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  getIndustryModule,
  isValidIndustry,
  resolveCanonicalIndustry,
} from '@/modules/registry';
import { insertSteps } from '@/lib/automations/steps-tree';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const admin = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const {
      industry,
      reset,
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
      return NextResponse.json({ success: true, reset: true });
    }

    if (
      !industry ||
      typeof industry !== 'string' ||
      !isValidIndustry(industry)
    ) {
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

    // 1. Update Accounts table columns (industry, name, logo, ai_system_prompt, welcome_message, status)
    const updates: Record<string, unknown> = {
      industry: validIndustryId,
      ai_system_prompt: tailoredPrompt,
      status: 'active',
      updated_at: new Date().toISOString(),
    };
    if (workspaceName) updates.name = workspaceName;
    if (logo) updates.logo = logo;
    if (welcomeMessage) updates.welcome_message = welcomeMessage;

    const { error: accErr } = await admin
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId);

    if (accErr) {
      console.error('[onboard route] failed to update account:', accErr);
      throw accErr;
    }

    // 2. Set up dynamic modules (enable active industry module, disable others)
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
      account_id: ctx.accountId,
      module_key: mod,
      enabled: config.id === mod,
      settings: {},
      updated_at: nowIso,
    }));

    const { error: modErr } = await admin
      .from('tenant_modules')
      .upsert(modulesToUpsert, { onConflict: 'account_id, module_key' });

    if (modErr) {
      console.error('[onboard route] failed to batch upsert modules:', modErr);
    }

    // 3. Set up primary pipeline stages safely
    let pipelineId: string | null = null;
    const { data: extPipes, error: getPipeErr } = await admin
      .from('pipelines')
      .select('id')
      .eq('account_id', ctx.accountId)
      .limit(1);

    if (getPipeErr) {
      console.error('[onboard route] error fetching pipelines:', getPipeErr);
    }

    if (extPipes && extPipes.length > 0) {
      pipelineId = extPipes[0].id;
    } else {
      const { data: ownerProf } = await admin
        .from('profiles')
        .select('user_id')
        .eq('account_id', ctx.accountId)
        .eq('account_role', 'owner')
        .maybeSingle();

      const defaultUserId = ownerProf?.user_id || ctx.userId;

      const { data: newPipe, error: pipeErr } = await admin
        .from('pipelines')
        .insert({
          account_id: ctx.accountId,
          name: 'Sales Pipeline',
          user_id: defaultUserId,
        })
        .select('id')
        .maybeSingle();

      if (pipeErr) {
        console.error('[onboard route] failed to create pipeline:', pipeErr);
      } else if (newPipe) {
        pipelineId = newPipe.id;
      }
    }

    if (pipelineId) {
      try {
        const { data: existingStages } = await admin
          .from('pipeline_stages')
          .select('id, position')
          .eq('pipeline_id', pipelineId)
          .order('position', { ascending: true });

        const stagesList = existingStages || [];
        const newStages = config.pipelineStages || [];

        for (
          let i = 0;
          i < Math.min(stagesList.length, newStages.length);
          i++
        ) {
          await admin
            .from('pipeline_stages')
            .update({
              name: newStages[i].name,
              position: newStages[i].position,
              color: newStages[i].color,
            })
            .eq('id', stagesList[i].id);
        }

        if (newStages.length > stagesList.length) {
          const extraStages = newStages.slice(stagesList.length).map((st) => ({
            pipeline_id: pipelineId,
            name: st.name,
            position: st.position,
            color: st.color,
          }));
          await admin.from('pipeline_stages').insert(extraStages);
        } else if (
          stagesList.length > newStages.length &&
          stagesList.length > 0
        ) {
          const firstStageId = stagesList[0].id;
          const extraStageIds = stagesList
            .slice(newStages.length)
            .map((s) => s.id);

          await admin
            .from('deals')
            .update({ stage_id: firstStageId })
            .in('stage_id', extraStageIds);

          await admin.from('pipeline_stages').delete().in('id', extraStageIds);
        }
      } catch (stageErr) {
        console.warn('[onboard route] soft error updating stages:', stageErr);
      }
    }

    // 4. Pre-seed Knowledge Base entries (Custom services + Industry templates)
    try {
      await admin
        .from('knowledge_base')
        .delete()
        .eq('account_id', ctx.accountId);

      const kbToInsert: Array<{
        account_id: string;
        category: 'faq' | 'service' | 'pricing' | 'policy' | 'company';
        question_title: string;
        answer_content: string;
      }> = [];

      // Add Company Hours & Location FAQ if provided
      if (effectiveLocation || (openingTime && closingTime)) {
        kbToInsert.push({
          account_id: ctx.accountId,
          category: 'company',
          question_title: `Where are you located and what are your business hours?`,
          answer_content: `We are located at ${effectiveLocation || 'our main location'}. Our working hours are ${workingDays || 'Monday to Saturday'} from ${openingTime || '9:00 AM'} to ${closingTime || '8:00 PM'}.`,
        });
      }

      // Add custom services provided by the user
      if (Array.isArray(services) && services.length > 0) {
        for (const s of services) {
          if (s?.name && s?.price !== undefined) {
            const priceFormatted = `₹${Number(s.price).toLocaleString()}`;
            const desc = s.description ? ` Details: ${s.description}` : '';
            kbToInsert.push({
              account_id: ctx.accountId,
              category: 'pricing',
              question_title: `How much does ${s.name} cost?`,
              answer_content: `The price for ${s.name} is ${priceFormatted}.${desc}`,
            });
            kbToInsert.push({
              account_id: ctx.accountId,
              category: 'service',
              question_title: `Do you provide ${s.name}?`,
              answer_content: `Yes! We offer ${s.name} at ${priceFormatted}.${desc}`,
            });
          }
        }
      }

      // Add standard industry template FAQs
      if (config.kbTemplates && config.kbTemplates.length > 0) {
        config.kbTemplates.forEach((kb) => {
          kbToInsert.push({
            account_id: ctx.accountId,
            category: kb.category as
              'faq' | 'service' | 'pricing' | 'policy' | 'company',
            question_title: kb.questionTitle,
            answer_content: kb.answerContent,
          });
        });
      }

      if (kbToInsert.length > 0) {
        await admin.from('knowledge_base').insert(kbToInsert);
      }
    } catch (kbErr) {
      console.warn('[onboard route] soft error seeding knowledge base:', kbErr);
    }

    // 5. Pre-seed Campaign templates as Drafts
    try {
      await admin
        .from('broadcasts')
        .delete()
        .eq('account_id', ctx.accountId)
        .eq('status', 'draft');

      if (config.campaignTemplates && config.campaignTemplates.length > 0) {
        const campaignsToInsert = config.campaignTemplates.map((camp) => ({
          account_id: ctx.accountId,
          user_id: ctx.userId,
          name: camp.name,
          template_name: 'custom_campaign',
          template_language: 'en_US',
          status: 'draft' as const,
          category: camp.category,
          message_body: camp.messageBody,
          cta_type: camp.ctaType,
          cta_text: camp.ctaText || null,
          cta_url: camp.ctaUrl || null,
          attachment_url: camp.attachmentUrl || null,
          attachment_type: camp.attachmentType || null,
          total_recipients: 0,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
        }));

        await admin.from('broadcasts').insert(campaignsToInsert);
      }
    } catch (campErr) {
      console.warn('[onboard route] soft error seeding campaigns:', campErr);
    }

    // 6. Pre-seed Workflow Automations
    try {
      const { data: existingAutos } = await admin
        .from('automations')
        .select('id')
        .eq('account_id', ctx.accountId);

      if (existingAutos && existingAutos.length > 0) {
        const autoIds = existingAutos.map((a) => a.id);
        await admin
          .from('automation_steps')
          .delete()
          .in('automation_id', autoIds);
        await admin
          .from('automations')
          .delete()
          .eq('account_id', ctx.accountId);
      }

      if (config.workflows && config.workflows.length > 0) {
        await Promise.all(
          config.workflows.map(async (w) => {
            const { data: autoRecord, error: autoErr } = await admin
              .from('automations')
              .insert({
                account_id: ctx.accountId,
                user_id: ctx.userId,
                name: w.name,
                description: w.description,
                trigger_type: w.trigger_type,
                trigger_config: w.trigger_config || {},
                is_active: w.is_active,
              })
              .select('id')
              .single();

            if (autoErr || !autoRecord) {
              console.error(
                '[onboard route] failed to seed automation:',
                autoErr
              );
              return;
            }

            if (w.steps && w.steps.length > 0) {
              await insertSteps(
                autoRecord.id,
                w.steps as unknown as Parameters<typeof insertSteps>[1]
              );
            }
          })
        );
      }
    } catch (autoErr) {
      console.warn('[onboard route] soft error seeding automations:', autoErr);
    }

    return NextResponse.json({ success: true, industry: validIndustryId });
  } catch (err) {
    return toErrorResponse(err);
  }
}
