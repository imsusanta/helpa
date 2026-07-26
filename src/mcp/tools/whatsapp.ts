import { getSupabaseClient, formatMcpResponse } from '../utils'

export const whatsappTools = {
  whatsapp_list_chats: async (args: { status?: 'open' | 'pending' | 'closed'; limit?: number; offset?: number }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 20
      const offset = args.offset || 0

      let query = supabase
        .from('conversations')
        .select(`
          id, status, last_message_text, last_message_at, unread_count, updated_at,
          contacts ( id, name, phone, email, avatar_url )
        `, { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (args.status) {
        query = query.eq('status', args.status)
      }

      const { data, count, error } = await query
      if (error) throw error

      return formatMcpResponse({
        total: count || (data ? data.length : 0),
        limit,
        offset,
        chats: data || [],
      })
    } catch (err: any) {
      return formatMcpResponse(`Error listing chats: ${err.message}`, true)
    }
  },

  whatsapp_get_chat_history: async (args: {
    conversation_id?: string
    phone?: string
    limit?: number
    offset?: number
  }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 50
      const offset = args.offset || 0

      let convId = args.conversation_id

      if (!convId && args.phone) {
        // Look up contact by phone
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone', args.phone)
          .single()

        if (!contact) {
          return formatMcpResponse(`No contact found for phone ${args.phone}`, true)
        }

        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .single()

        if (!conv) {
          return formatMcpResponse(`No conversation found for phone ${args.phone}`, true)
        }

        convId = conv.id
      }

      if (!convId) {
        return formatMcpResponse('Error: Either conversation_id or phone is required', true)
      }

      const { data: messages, count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return formatMcpResponse({
        conversation_id: convId,
        total: count || (messages ? messages.length : 0),
        limit,
        offset,
        messages: (messages || []).reverse(),
      })
    } catch (err: any) {
      return formatMcpResponse(`Error fetching chat history: ${err.message}`, true)
    }
  },

  whatsapp_send_message: async (args: {
    phone?: string
    conversation_id?: string
    message: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.message) {
        return formatMcpResponse('Error: message content is required', true)
      }

      let convId = args.conversation_id
      let contactId: string | null = null

      if (!convId && args.phone) {
        // Find or create contact
        let { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone', args.phone)
          .single()

        if (!contact) {
          const { data: newContact, error: createContactErr } = await supabase
            .from('contacts')
            .insert({ phone: args.phone })
            .select('id')
            .single()
          if (createContactErr) throw createContactErr
          contact = newContact
        }

        contactId = contact.id

        // Find or create conversation
        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .single()

        if (!conv) {
          const { data: newConv, error: createConvErr } = await supabase
            .from('conversations')
            .insert({ contact_id: contact.id, status: 'open' })
            .select('id')
            .single()
          if (createConvErr) throw createConvErr
          conv = newConv
        }

        convId = conv.id
      }

      if (!convId) {
        return formatMcpResponse('Error: Must provide either conversation_id or phone number', true)
      }

      // Record message in database
      const { data: insertedMsg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_type: 'agent',
          content_type: 'text',
          content_text: args.message,
          status: 'sent',
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Update conversation last_message
      await supabase
        .from('conversations')
        .update({
          last_message_text: args.message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', convId)

      return formatMcpResponse({
        success: true,
        message: 'Message queued and recorded successfully',
        data: insertedMsg,
      })
    } catch (err: any) {
      return formatMcpResponse(`Error sending message: ${err.message}`, true)
    }
  },

  whatsapp_send_template: async (args: {
    phone?: string
    conversation_id?: string
    template_name: string
    language?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      let convId = args.conversation_id

      if (!convId && args.phone) {
        let { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone', args.phone)
          .single()

        if (!contact) {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({ phone: args.phone })
            .select('id')
            .single()
          contact = newContact
        }

        if (contact) {
          let { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .single()

          if (!conv) {
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({ contact_id: contact.id, status: 'open' })
              .select('id')
              .single()
            conv = newConv
          }
          if (conv) convId = conv.id
        }
      }

      if (!convId) {
        return formatMcpResponse('Error: Must provide either conversation_id or phone', true)
      }

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_type: 'agent',
          content_type: 'template',
          template_name: args.template_name,
          content_text: `Template: ${args.template_name}`,
          status: 'sent',
        })
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({
        success: true,
        message: `Template "${args.template_name}" queued successfully`,
        data: msg,
      })
    } catch (err: any) {
      return formatMcpResponse(`Error sending template: ${err.message}`, true)
    }
  },

  whatsapp_list_templates: async (args: { category?: string; status?: string }) => {
    try {
      const supabase = getSupabaseClient()
      let query = supabase.from('message_templates').select('*').order('name')

      if (args.category) query = query.eq('category', args.category)
      if (args.status) query = query.eq('status', args.status)

      const { data, error } = await query
      if (error) throw error

      return formatMcpResponse({ templates: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing templates: ${err.message}`, true)
    }
  },
}
