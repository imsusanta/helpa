import { getSupabaseClient, formatMcpResponse } from '../utils'

export const contactTools = {
  contacts_list: async (args: { query?: string; tag?: string; limit?: number; offset?: number }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 20
      const offset = args.offset || 0

      let queryBuilder = supabase
        .from('contacts')
        .select(`
          id, phone, name, email, company, created_at, updated_at,
          contact_tags ( tag_id, tags ( id, name, color ) )
        `, { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      if (args.query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${args.query}%,phone.ilike.%${args.query}%,email.ilike.%${args.query}%`)
      }

      const { data, count, error } = await queryBuilder

      if (error) throw error

      // Filter by tag if specified
      let results = data || []
      if (args.tag) {
        const lowerTag = args.tag.toLowerCase()
        results = results.filter((c: any) =>
          c.contact_tags?.some((ct: any) => ct.tags?.name?.toLowerCase() === lowerTag)
        )
      }

      return formatMcpResponse({
        total: count || results.length,
        limit,
        offset,
        contacts: results,
      })
    } catch (err: any) {
      return formatMcpResponse(`Error listing contacts: ${err.message}`, true)
    }
  },

  contacts_get: async (args: { id?: string; phone?: string }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id && !args.phone) {
        return formatMcpResponse('Error: Must provide either id or phone number', true)
      }

      let query = supabase
        .from('contacts')
        .select(`
          *,
          contact_tags ( tag_id, tags ( id, name, color ) ),
          contact_notes ( id, note_text, created_at ),
          contact_custom_values ( id, value, custom_fields ( field_name, field_type ) )
        `)

      if (args.id) {
        query = query.eq('id', args.id)
      } else if (args.phone) {
        query = query.eq('phone', args.phone)
      }

      const { data, error } = await query.single()
      if (error) throw error

      return formatMcpResponse(data)
    } catch (err: any) {
      return formatMcpResponse(`Error getting contact details: ${err.message}`, true)
    }
  },

  contacts_create: async (args: {
    phone: string
    name?: string
    email?: string
    company?: string
    tags?: string[]
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.phone) {
        return formatMcpResponse('Error: phone is required', true)
      }

      // Check if contact already exists
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, phone')
        .eq('phone', args.phone)
        .single()

      if (existing) {
        return formatMcpResponse(`Contact with phone ${args.phone} already exists (ID: ${existing.id}). Use contacts_update instead.`, true)
      }

      // Create contact
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          phone: args.phone,
          name: args.name || null,
          email: args.email || null,
          company: args.company || null,
        })
        .select()
        .single()

      if (error) throw error

      // Attach tags if provided
      if (args.tags && args.tags.length > 0 && contact) {
        for (const tagName of args.tags) {
          // Find or create tag
          let { data: tag } = await supabase.from('tags').select('id').eq('name', tagName).single()
          if (!tag) {
            const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select('id').single()
            tag = newTag
          }
          if (tag) {
            await supabase.from('contact_tags').insert({ contact_id: contact.id, tag_id: tag.id })
          }
        }
      }

      return formatMcpResponse({ message: 'Contact created successfully', contact })
    } catch (err: any) {
      return formatMcpResponse(`Error creating contact: ${err.message}`, true)
    }
  },

  contacts_update: async (args: {
    id: string
    name?: string
    email?: string
    company?: string
    phone?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id) return formatMcpResponse('Error: id is required', true)

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.name !== undefined) updates.name = args.name
      if (args.email !== undefined) updates.email = args.email
      if (args.company !== undefined) updates.company = args.company
      if (args.phone !== undefined) updates.phone = args.phone

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', args.id)
        .select()
        .single()

      if (error) throw error
      return formatMcpResponse({ message: 'Contact updated successfully', contact: data })
    } catch (err: any) {
      return formatMcpResponse(`Error updating contact: ${err.message}`, true)
    }
  },

  contacts_delete: async (args: { id: string }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id) return formatMcpResponse('Error: id is required', true)

      const { error } = await supabase.from('contacts').delete().eq('id', args.id)
      if (error) throw error

      return formatMcpResponse({ message: `Contact ${args.id} deleted successfully` })
    } catch (err: any) {
      return formatMcpResponse(`Error deleting contact: ${err.message}`, true)
    }
  },

  tags_list: async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.from('tags').select('*').order('name')
      if (error) throw error
      return formatMcpResponse({ tags: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing tags: ${err.message}`, true)
    }
  },
}
