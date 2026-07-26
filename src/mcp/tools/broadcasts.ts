import { getSupabaseClient, formatMcpResponse } from '../utils'

export const broadcastTools = {
  broadcasts_list: async (args: { limit?: number; status?: string }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 20

      let query = supabase
        .from('broadcasts')
        .select('*')
        .limit(limit)
        .order('created_at', { ascending: false })

      if (args.status) query = query.eq('status', args.status)

      const { data, error } = await query
      if (error) throw error

      return formatMcpResponse({ broadcasts: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing broadcasts: ${err.message}`, true)
    }
  },

  broadcasts_create: async (args: {
    name: string
    template_id: string
    tag_id?: string
    scheduled_at?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.name || !args.template_id) {
        return formatMcpResponse('Error: name and template_id are required', true)
      }

      const { data: broadcast, error } = await supabase
        .from('broadcasts')
        .insert({
          name: args.name,
          template_id: args.template_id,
          tag_id: args.tag_id || null,
          scheduled_at: args.scheduled_at || null,
          status: args.scheduled_at ? 'scheduled' : 'draft',
        })
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({ message: 'Broadcast created successfully', broadcast })
    } catch (err: any) {
      return formatMcpResponse(`Error creating broadcast: ${err.message}`, true)
    }
  },
}
