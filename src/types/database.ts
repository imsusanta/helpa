export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string;
          openrouter_api_key: string | null;
          openrouter_model: string | null;
          ai_system_prompt: string | null;
          welcome_message: string | null;
          industry: string | null;
          logo: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_user_id: string;
          openrouter_api_key?: string | null;
          openrouter_model?: string | null;
          ai_system_prompt?: string | null;
          welcome_message?: string | null;
          industry?: string | null;
          logo?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_user_id?: string;
          openrouter_api_key?: string | null;
          openrouter_model?: string | null;
          ai_system_prompt?: string | null;
          welcome_message?: string | null;
          industry?: string | null;
          logo?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          role: string;
          account_role: AccountRole;
          beta_features: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          full_name: string;
          email: string;
          avatar_url?: string | null;
          role?: string;
          account_role?: AccountRole;
          beta_features?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          full_name?: string;
          email?: string;
          avatar_url?: string | null;
          role?: string;
          account_role?: AccountRole;
          beta_features?: string[] | null;
          created_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          phone: string;
          name: string;
          email: string | null;
          tags: string[] | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          phone: string;
          name: string;
          email?: string | null;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          phone?: string;
          name?: string;
          email?: string | null;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          contact_id: string;
          last_message_text: string | null;
          last_message_at: string | null;
          unread_count: number;
          ai_chat_enabled: boolean;
          assigned_agent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          contact_id: string;
          last_message_text?: string | null;
          last_message_at?: string | null;
          unread_count?: number;
          ai_chat_enabled?: boolean;
          assigned_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          contact_id?: string;
          last_message_text?: string | null;
          last_message_at?: string | null;
          unread_count?: number;
          ai_chat_enabled?: boolean;
          assigned_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_type: 'agent' | 'customer' | 'bot';
          content_type:
            | 'text'
            | 'image'
            | 'document'
            | 'audio'
            | 'video'
            | 'location'
            | 'template'
            | 'interactive';
          content_text: string | null;
          media_url: string | null;
          template_name: string | null;
          message_id: string | null;
          status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
          reply_to_message_id: string | null;
          interactive_reply_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_type: 'agent' | 'customer' | 'bot';
          content_type:
            | 'text'
            | 'image'
            | 'document'
            | 'audio'
            | 'video'
            | 'location'
            | 'template'
            | 'interactive';
          content_text?: string | null;
          media_url?: string | null;
          template_name?: string | null;
          message_id?: string | null;
          status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
          reply_to_message_id?: string | null;
          interactive_reply_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_type?: 'agent' | 'customer' | 'bot';
          content_type?:
            | 'text'
            | 'image'
            | 'document'
            | 'audio'
            | 'video'
            | 'location'
            | 'template'
            | 'interactive';
          content_text?: string | null;
          media_url?: string | null;
          template_name?: string | null;
          message_id?: string | null;
          status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
          reply_to_message_id?: string | null;
          interactive_reply_id?: string | null;
          created_at?: string;
        };
      };
      whatsapp_config: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          phone_number_id: string;
          waba_id: string;
          access_token: string;
          verify_token: string;
          display_phone_number: string | null;
          verified_name: string | null;
          quality_rating: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          phone_number_id: string;
          waba_id: string;
          access_token: string;
          verify_token: string;
          display_phone_number?: string | null;
          verified_name?: string | null;
          quality_rating?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          phone_number_id?: string;
          waba_id?: string;
          access_token?: string;
          verify_token?: string;
          display_phone_number?: string | null;
          verified_name?: string | null;
          quality_rating?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      hospital_doctors: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          department: string;
          specialty: string | null;
          available_days: string[] | null;
          available_time_slots: string[] | null;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          department: string;
          specialty?: string | null;
          available_days?: string[] | null;
          available_time_slots?: string[] | null;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          department?: string;
          specialty?: string | null;
          available_days?: string[] | null;
          available_time_slots?: string[] | null;
          is_available?: boolean;
          created_at?: string;
        };
      };
      hospital_departments: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          description: string | null;
          head_doctor_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          description?: string | null;
          head_doctor_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          description?: string | null;
          head_doctor_name?: string | null;
          created_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          account_id: string;
          patient_id: string;
          doctor_id: string | null;
          appointment_date: string;
          appointment_time: string | null;
          status:
            | 'Scheduled'
            | 'Reminder Sent'
            | 'Confirmed'
            | 'Reschedule Requested'
            | 'Cancelled'
            | 'Visited'
            | 'Completed';
          patient_name: string | null;
          patient_phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          patient_id: string;
          doctor_id?: string | null;
          appointment_date: string;
          appointment_time?: string | null;
          status?:
            | 'Scheduled'
            | 'Reminder Sent'
            | 'Confirmed'
            | 'Reschedule Requested'
            | 'Cancelled'
            | 'Visited'
            | 'Completed';
          patient_name?: string | null;
          patient_phone?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          patient_id?: string;
          doctor_id?: string | null;
          appointment_date?: string;
          appointment_time?: string | null;
          status?:
            | 'Scheduled'
            | 'Reminder Sent'
            | 'Confirmed'
            | 'Reschedule Requested'
            | 'Cancelled'
            | 'Visited'
            | 'Completed';
          patient_name?: string | null;
          patient_phone?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      hospital_lab_reports: {
        Row: {
          id: string;
          account_id: string;
          patient_id: string;
          doctor_id: string | null;
          test_name: string;
          department: string | null;
          status: 'pending' | 'processing' | 'ready' | 'delivered';
          expected_delivery_date: string | null;
          report_pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          patient_id: string;
          doctor_id?: string | null;
          test_name: string;
          department?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'delivered';
          expected_delivery_date?: string | null;
          report_pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          patient_id?: string;
          doctor_id?: string | null;
          test_name?: string;
          department?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'delivered';
          expected_delivery_date?: string | null;
          report_pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contact_notes: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string;
          note_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id: string;
          note_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string;
          note_text?: string;
          created_at?: string;
        };
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          conversation_id: string;
          actor_type: 'customer' | 'agent' | 'bot';
          actor_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          conversation_id: string;
          actor_type: 'customer' | 'agent' | 'bot';
          actor_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          conversation_id?: string;
          actor_type?: 'customer' | 'agent' | 'bot';
          actor_id?: string;
          emoji?: string;
          created_at?: string;
        };
      };
      account_invitations: {
        Row: {
          id: string;
          account_id: string;
          role: 'admin' | 'agent' | 'viewer';
          token_hash: string;
          created_by_user_id: string | null;
          label: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          role: 'admin' | 'agent' | 'viewer';
          token_hash: string;
          created_by_user_id?: string | null;
          label?: string | null;
          created_at?: string;
          expires_at: string;
          accepted_at?: string | null;
          accepted_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          role?: 'admin' | 'agent' | 'viewer';
          token_hash?: string;
          created_by_user_id?: string | null;
          label?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by_user_id?: string | null;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          event_id: string;
          account_id: string | null;
          event_type: string;
          status:
            | 'received'
            | 'processing'
            | 'processed'
            | 'failed'
            | 'dead_letter';
          payload: Json;
          retry_count: number;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          account_id?: string | null;
          event_type: string;
          status?:
            | 'received'
            | 'processing'
            | 'processed'
            | 'failed'
            | 'dead_letter';
          payload: Json;
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          account_id?: string | null;
          event_type?: string;
          status?:
            | 'received'
            | 'processing'
            | 'processed'
            | 'failed'
            | 'dead_letter';
          payload?: Json;
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      webhook_dead_letter: {
        Row: {
          id: string;
          event_id: string;
          account_id: string | null;
          payload: Json;
          error_message: string;
          stack_trace: string | null;
          failed_at: string;
          resolved: boolean;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          account_id?: string | null;
          payload: Json;
          error_message: string;
          stack_trace?: string | null;
          failed_at?: string;
          resolved?: boolean;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          account_id?: string | null;
          payload?: Json;
          error_message?: string;
          stack_trace?: string | null;
          failed_at?: string;
          resolved?: boolean;
          resolved_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_role: AccountRole;
    };
  };
}
