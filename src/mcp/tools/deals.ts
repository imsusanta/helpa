import { getSupabaseClient, formatMcpResponse } from '../utils'

export const dealTools = {
  pipelines_list: async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: pipelines, error: pErr } = await supabase
        .from('pipelines')
        .select(`
          id, name, created_at,
          pipeline_stages ( id, name, position, color )
        `)
        .order('name')

      if (pErr) throw pErr

      return formatMcpResponse({ pipelines: pipelines || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing pipelines: ${err.message}`, true)
    }
  },

  deals_list: async (args: { pipeline_id?: string; stage_id?: string; contact_id?: string; limit?: number }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 50

      let query = supabase
        .from('deals')
        .select(`
          *,
          contacts ( id, name, phone, company ),
          pipeline_stages ( id, name, position )
        `)
        .limit(limit)
        .order('created_at', { ascending: false })

      if (args.pipeline_id) query = query.eq('pipeline_id', args.pipeline_id)
      if (args.stage_id) query = query.eq('stage_id', args.stage_id)
      if (args.contact_id) query = query.eq('contact_id', args.contact_id)

      const { data, error } = await query
      if (error) throw error

      return formatMcpResponse({ deals: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing deals: ${err.message}`, true)
    }
  },

  deals_create: async (args: {
    title: string
    contact_id: string
    stage_id: string
    pipeline_id?: string
    value?: number
    currency?: string
    notes?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.title || !args.contact_id || !args.stage_id) {
        return formatMcpResponse('Error: title, contact_id, and stage_id are required', true)
      }

      // Resolve pipeline_id if not provided
      let pipelineId = args.pipeline_id
      if (!pipelineId) {
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('pipeline_id')
          .eq('id', args.stage_id)
          .single()
        if (stage) pipelineId = stage.pipeline_id
      }

      const { data: deal, error } = await supabase
        .from('deals')
        .insert({
          title: args.title,
          contact_id: args.contact_id,
          stage_id: args.stage_id,
          pipeline_id: pipelineId || null,
          value: args.value || 0,
          currency: args.currency || 'USD',
          notes: args.notes || null,
          status: 'open',
        })
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({ message: 'Deal created successfully', deal })
    } catch (err: any) {
      return formatMcpResponse(`Error creating deal: ${err.message}`, true)
    }
  },

  deals_update_stage: async (args: {
    id: string
    stage_id?: string
    status?: 'open' | 'won' | 'lost'
    value?: number
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id) return formatMcpResponse('Error: id is required', true)

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.stage_id) updates.stage_id = args.stage_id
      if (args.status) updates.status = args.status
      if (args.value !== undefined) updates.value = args.value

      const { data: deal, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', args.id)
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({ message: 'Deal updated successfully', deal })
    } catch (err: any) {
      return formatMcpResponse(`Error updating deal: ${err.message}`, true)
    }
  },
}
