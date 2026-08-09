import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getIndustryModule } from '@/modules/registry';
import { insertSteps } from '@/lib/automations/steps-tree';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json();
    const {
      industry,
      reset,
      name: workspaceName,
      logo,
      timezone: _timezone,
      country: _country,
    } = body || {};

    if (reset) {
      const { error: accErr } = await ctx.supabase
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

    const industryKey = industry || 'general';
    const config = getIndustryModule(industryKey);

    // 1. Update Accounts table columns (industry, name, logo, ai_system_prompt)
    const updates: Record<string, unknown> = {
      industry: industryKey,
      ai_system_prompt: config.systemPrompt,
      updated_at: new Date().toISOString(),
    };
    if (workspaceName) updates.name = workspaceName;
    if (logo) updates.logo = logo;

    const { error: accErr } = await ctx.supabase
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
    ];

    for (const mod of allKnownModules) {
      const isEnabled = config.id === mod;
      const { error: modErr } = await ctx.supabase
        .from('tenant_modules')
        .upsert(
          {
            account_id: ctx.accountId,
            module_key: mod,
            enabled: isEnabled,
            settings: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id, module_key' }
        );

      if (modErr) {
        console.error(
          `[onboard route] failed to upsert module ${mod}:`,
          modErr
        );
      }
    }

    // 3. Set up primary pipeline stages
    let pipelineId: string;
    const { data: extPipes, error: getPipeErr } = await ctx.supabase
      .from('pipelines')
      .select('id')
      .eq('account_id', ctx.accountId)
      .limit(1);

    if (getPipeErr) throw getPipeErr;

    if (extPipes && extPipes.length > 0) {
      pipelineId = extPipes[0].id;
    } else {
      // Find account owner
      const { data: ownerProf } = await ctx.supabase
        .from('profiles')
        .select('user_id')
        .eq('account_id', ctx.accountId)
        .eq('account_role', 'owner')
        .maybeSingle();

      const defaultUserId = ownerProf?.user_id || ctx.userId;

      const { data: newPipe, error: pipeErr } = await ctx.supabase
        .from('pipelines')
        .insert({
          account_id: ctx.accountId,
          name: 'Sales Pipeline',
          user_id: defaultUserId,
        })
        .select('id')
        .single();

      if (pipeErr) {
        console.error('[onboard route] failed to create pipeline:', pipeErr);
        throw pipeErr;
      }
      pipelineId = newPipe.id;
    }

    // Clear old stages to keep it fresh
    await ctx.supabase
      .from('pipeline_stages')
      .delete()
      .eq('pipeline_id', pipelineId);

    // Insert new seeded stages
    if (config.pipelineStages && config.pipelineStages.length > 0) {
      const stagesToInsert = config.pipelineStages.map((st) => ({
        pipeline_id: pipelineId,
        name: st.name,
        position: st.position,
        color: st.color,
      }));

      const { error: stageErr } = await ctx.supabase
        .from('pipeline_stages')
        .insert(stagesToInsert);

      if (stageErr) {
        console.error('[onboard route] failed to seed stages:', stageErr);
      }
    }

    // 4. Pre-seed Knowledge Base entries
    await ctx.supabase
      .from('knowledge_base')
      .delete()
      .eq('account_id', ctx.accountId);

    if (config.kbTemplates && config.kbTemplates.length > 0) {
      const kbToInsert = config.kbTemplates.map((kb) => ({
        account_id: ctx.accountId,
        category: kb.category,
        question_title: kb.questionTitle,
        answer_content: kb.answerContent,
      }));

      const { error: kbErr } = await ctx.supabase
        .from('knowledge_base')
        .insert(kbToInsert);

      if (kbErr) {
        console.error('[onboard route] failed to seed KB:', kbErr);
      }
    }

    // 5. Pre-seed Campaign templates as Drafts
    await ctx.supabase
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

      const { error: campErr } = await ctx.supabase
        .from('broadcasts')
        .insert(campaignsToInsert);

      if (campErr) {
        console.error(
          '[onboard route] failed to seed campaign drafts:',
          campErr
        );
      }
    }

    // 6. Pre-seed Workflow Automations
    await ctx.supabase
      .from('automations')
      .delete()
      .eq('account_id', ctx.accountId);

    if (config.workflows && config.workflows.length > 0) {
      for (const w of config.workflows) {
        const { data: autoRecord, error: autoErr } = await ctx.supabase
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
          console.error('[onboard route] failed to seed automation:', autoErr);
          continue;
        }

        if (w.steps && w.steps.length > 0) {
          await insertSteps(
            autoRecord.id,
            w.steps as unknown as Parameters<typeof insertSteps>[1]
          );
        }
      }
    }

    return NextResponse.json({ success: true, industry: industryKey });
  } catch (err) {
    return toErrorResponse(err);
  }
}
