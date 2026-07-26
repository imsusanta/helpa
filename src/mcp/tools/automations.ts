import { getSupabaseClient, formatMcpResponse } from '../utils'

export const automationTools = {
  automations_list: async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return formatMcpResponse({ automations: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing automations: ${err.message}`, true)
    }
  },

  automations_toggle: async (args: { id: string; active: boolean }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id || args.active === undefined) {
        return formatMcpResponse('Error: id and active state are required', true)
      }

      const { data, error } = await supabase
        .from('automations')
        .update({ active: args.active, updated_at: new Date().toISOString() })
        .eq('id', args.id)
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({
        message: `Automation ${args.id} ${args.active ? 'activated' : 'deactivated'}`,
        automation: data,
      })
    } catch (err: any) {
      return formatMcpResponse(`Error toggling automation: ${err.message}`, true)
    }
  },
}
