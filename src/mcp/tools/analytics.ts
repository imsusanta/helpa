import { getSupabaseClient, formatMcpResponse } from '../utils'

export const analyticsTools = {
  workspace_get_stats: async () => {
    try {
      const supabase = getSupabaseClient()

      const [
        { count: contactsCount },
        { count: conversationsCount },
        { count: openConversationsCount },
        { count: broadcastsCount },
        { count: automationsCount },
        { data: deals },
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('broadcasts').select('*', { count: 'exact', head: true }),
        supabase.from('automations').select('*', { count: 'exact', head: true }),
        supabase.from('deals').select('value, status'),
      ])

      const dealsCount = deals?.length || 0
      const totalPipelineValue = deals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0
      const openDealsValue = deals?.filter(d => d.status === 'open').reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0

      return formatMcpResponse({
        contacts: { total: contactsCount || 0 },
        conversations: {
          total: conversationsCount || 0,
          open: openConversationsCount || 0,
        },
        deals: {
          total_count: dealsCount,
          total_pipeline_value: totalPipelineValue,
          open_pipeline_value: openDealsValue,
        },
        broadcasts: { total: broadcastsCount || 0 },
        automations: { total: automationsCount || 0 },
      })
    } catch (err: any) {
      return formatMcpResponse(`Error fetching workspace stats: ${err.message}`, true)
    }
  },
}
