import { getSupabaseClient, formatMcpResponse } from '../utils'

export const appointmentTools = {
  appointments_list: async (args: { patient_id?: string; status?: string; date?: string; limit?: number }) => {
    try {
      const supabase = getSupabaseClient()
      const limit = args.limit || 20

      let query = supabase
        .from('appointments')
        .select(`
          *,
          contacts ( id, name, phone, email ),
          hospital_doctors ( id, name, department, specialization )
        `)
        .limit(limit)
        .order('appointment_date', { ascending: true })

      if (args.patient_id) query = query.eq('patient_id', args.patient_id)
      if (args.status) query = query.eq('status', args.status)
      if (args.date) query = query.eq('appointment_date', args.date)

      const { data, error } = await query
      if (error) throw error

      return formatMcpResponse({ appointments: data || [] })
    } catch (err: any) {
      return formatMcpResponse(`Error listing appointments: ${err.message}`, true)
    }
  },

  appointments_create: async (args: {
    patient_id: string
    appointment_date: string
    appointment_time: string
    doctor_id?: string
    department?: string
    notes?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.patient_id || !args.appointment_date || !args.appointment_time) {
        return formatMcpResponse('Error: patient_id, appointment_date, and appointment_time are required', true)
      }

      // Check account_id if required or optional
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', args.patient_id)
        .single()

      if (!contact) {
        return formatMcpResponse(`Contact with patient_id ${args.patient_id} not found`, true)
      }

      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: args.patient_id,
          appointment_date: args.appointment_date,
          appointment_time: args.appointment_time,
          doctor_id: args.doctor_id || null,
          department: args.department || null,
          notes: args.notes || null,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({ message: 'Appointment created successfully', appointment: appt })
    } catch (err: any) {
      return formatMcpResponse(`Error creating appointment: ${err.message}`, true)
    }
  },

  appointments_update_status: async (args: {
    id: string
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
    notes?: string
  }) => {
    try {
      const supabase = getSupabaseClient()
      if (!args.id || !args.status) {
        return formatMcpResponse('Error: id and status are required', true)
      }

      const updates: Record<string, any> = {
        status: args.status,
        updated_at: new Date().toISOString(),
      }
      if (args.notes) updates.notes = args.notes

      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', args.id)
        .select()
        .single()

      if (error) throw error

      return formatMcpResponse({ message: 'Appointment status updated', appointment: data })
    } catch (err: any) {
      return formatMcpResponse(`Error updating appointment status: ${err.message}`, true)
    }
  },
}
