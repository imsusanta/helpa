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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'profiles_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
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
          patient_seq_id: string | null;
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
          patient_seq_id?: string | null;
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
          patient_seq_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          contact_id: string;
          status: string | null;
          replied_at: string | null;
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
          status?: string | null;
          replied_at?: string | null;
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
          status?: string | null;
          replied_at?: string | null;
          last_message_text?: string | null;
          last_message_at?: string | null;
          unread_count?: number;
          ai_chat_enabled?: boolean;
          assigned_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      whatsapp_configs: {
        Row: {
          id: string;
          account_id: string;
          phone_number_id: string;
          waba_id: string | null;
          encrypted_access_token: string;
          access_token?: string;
          provider: string;
          phone_number: string | null;
          display_phone_number: string | null;
          verified_name: string | null;
          business_name: string | null;
          connection_error: string | null;
          last_health_check_at: string | null;
          last_webhook_at: string | null;
          registered_at: string | null;
          subscribed_apps_at: string | null;
          connected_at: string | null;
          disconnected_at: string | null;
          connection_type: string | null;
          coexistence_status: string | null;
          status: string;
          provider_instance_id: string | null;
          provider_instance_name: string | null;
          provider_token_encrypted: string | null;
          connection_status: string | null;
          webhook_secret_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          phone_number_id: string;
          waba_id?: string | null;
          encrypted_access_token?: string;
          access_token?: string;
          provider?: string;
          phone_number?: string | null;
          display_phone_number?: string | null;
          verified_name?: string | null;
          business_name?: string | null;
          connection_error?: string | null;
          last_health_check_at?: string | null;
          last_webhook_at?: string | null;
          registered_at?: string | null;
          subscribed_apps_at?: string | null;
          connected_at?: string | null;
          disconnected_at?: string | null;
          connection_type?: string | null;
          coexistence_status?: string | null;
          status?: string;
          provider_instance_id?: string | null;
          provider_instance_name?: string | null;
          provider_token_encrypted?: string | null;
          connection_status?: string | null;
          webhook_secret_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          phone_number_id?: string;
          waba_id?: string | null;
          encrypted_access_token?: string;
          access_token?: string;
          provider?: string;
          phone_number?: string | null;
          display_phone_number?: string | null;
          verified_name?: string | null;
          business_name?: string | null;
          connection_error?: string | null;
          last_health_check_at?: string | null;
          last_webhook_at?: string | null;
          registered_at?: string | null;
          subscribed_apps_at?: string | null;
          connected_at?: string | null;
          disconnected_at?: string | null;
          connection_type?: string | null;
          coexistence_status?: string | null;
          status?: string;
          provider_instance_id?: string | null;
          provider_instance_name?: string | null;
          provider_token_encrypted?: string | null;
          connection_status?: string | null;
          webhook_secret_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_configs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_states: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          provider: string;
          state: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          provider?: string;
          state: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          provider?: string;
          state?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'oauth_states_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'whatsapp_config_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      hospital_doctors: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          department: string;
          specialty: string | null;
          specialization: string | null;
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
          specialization?: string | null;
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
          specialization?: string | null;
          available_days?: string[] | null;
          available_time_slots?: string[] | null;
          is_available?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hospital_doctors_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'hospital_departments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          account_id: string;
          patient_id: string;
          doctor_id: string | null;
          appointment_date: string;
          appointment_time: string | null;
          token_number: string | null;
          queue_position: number | null;
          booking_id: string | null;
          department: string | null;
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
          token_number?: string | null;
          queue_position?: number | null;
          booking_id?: string | null;
          department?: string | null;
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
          token_number?: string | null;
          queue_position?: number | null;
          booking_id?: string | null;
          department?: string | null;
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
        Relationships: [
          {
            foreignKeyName: 'appointments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_doctor_id_fkey';
            columns: ['doctor_id'];
            isOneToOne: false;
            referencedRelation: 'hospital_doctors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'hospital_lab_reports_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospital_lab_reports_doctor_id_fkey';
            columns: ['doctor_id'];
            isOneToOne: false;
            referencedRelation: 'hospital_doctors';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'contact_notes_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_notes_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'message_reactions_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'account_invitations_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_events: {
        Row: {
          id: string;
          event_id: string;
          account_id: string | null;
          event_type: string;
          status:
            'received' | 'processing' | 'processed' | 'failed' | 'dead_letter';
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
            'received' | 'processing' | 'processed' | 'failed' | 'dead_letter';
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
            'received' | 'processing' | 'processed' | 'failed' | 'dead_letter';
          payload?: Json;
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      inbound_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          account_id: string | null;
          entry_id: string | null;
          field: string;
          payload: Json;
          status:
            'received' | 'processing' | 'completed' | 'failed' | 'dead_letter';
          retry_count: number;
          error_log: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          account_id?: string | null;
          entry_id?: string | null;
          field?: string;
          payload: Json;
          status?:
            'received' | 'processing' | 'completed' | 'failed' | 'dead_letter';
          retry_count?: number;
          error_log?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          account_id?: string | null;
          entry_id?: string | null;
          field?: string;
          payload?: Json;
          status?:
            'received' | 'processing' | 'completed' | 'failed' | 'dead_letter';
          retry_count?: number;
          error_log?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outbound_outbox: {
        Row: {
          id: string;
          account_id: string;
          idempotency_key: string;
          conversation_id: string | null;
          contact_id: string | null;
          message_type: string;
          payload: Json;
          meta_message_id: string | null;
          status: 'pending' | 'processing' | 'sent' | 'failed';
          error_code: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          idempotency_key: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          message_type?: string;
          payload?: Json;
          meta_message_id?: string | null;
          status?: 'pending' | 'processing' | 'sent' | 'failed';
          error_code?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          idempotency_key?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          message_type?: string;
          payload?: Json;
          meta_message_id?: string | null;
          status?: 'pending' | 'processing' | 'sent' | 'failed';
          error_code?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'outbound_outbox_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          account_id: string;
          patient_seq_id: string | null;
          status: string;
          phone: string | null;
          name: string | null;
          email: string | null;
          gender: string | null;
          date_of_birth: string | null;
          blood_group: string | null;
          address: string | null;
          consent_status: string;
          consent_source: string | null;
          consent_updated_at: string;
          policy_version: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          account_id: string;
          patient_seq_id?: string | null;
          status?: string;
          phone?: string | null;
          name?: string | null;
          email?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          blood_group?: string | null;
          address?: string | null;
          consent_status?: string;
          consent_source?: string | null;
          consent_updated_at?: string;
          policy_version?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          patient_seq_id?: string | null;
          status?: string;
          phone?: string | null;
          name?: string | null;
          email?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          blood_group?: string | null;
          address?: string | null;
          consent_status?: string;
          consent_source?: string | null;
          consent_updated_at?: string;
          policy_version?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patients_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          account_id: string;
          actor_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          actor_id?: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          actor_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      broadcast_recipients: {
        Row: {
          id: string;
          broadcast_id: string;
          account_id: string;
          contact_id: string;
          whatsapp_message_id: string | null;
          status: string;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          replied_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          broadcast_id: string;
          account_id: string;
          contact_id: string;
          whatsapp_message_id?: string | null;
          status?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          replied_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          broadcast_id?: string;
          account_id?: string;
          contact_id?: string;
          whatsapp_message_id?: string | null;
          status?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          replied_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'broadcast_recipients_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'broadcast_recipients_broadcast_id_fkey';
            columns: ['broadcast_id'];
            isOneToOne: false;
            referencedRelation: 'broadcasts';
            referencedColumns: ['id'];
          },
        ];
      };
      broadcasts: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          status: string;
          template_name: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          total_recipients: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          status?: string;
          template_name?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          total_recipients?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          status?: string;
          template_name?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          total_recipients?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'broadcasts_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      contact_tags: {
        Row: {
          account_id: string;
          contact_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          account_id: string;
          contact_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          account_id?: string;
          contact_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      custom_fields: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          key: string;
          field_type:
            | 'text'
            | 'number'
            | 'email'
            | 'phone'
            | 'date'
            | 'dropdown'
            | 'multiselect'
            | 'boolean';
          options: Json;
          required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          key: string;
          field_type:
            | 'text'
            | 'number'
            | 'email'
            | 'phone'
            | 'date'
            | 'dropdown'
            | 'multiselect'
            | 'boolean';
          options?: Json;
          required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          key?: string;
          field_type?:
            | 'text'
            | 'number'
            | 'email'
            | 'phone'
            | 'date'
            | 'dropdown'
            | 'multiselect'
            | 'boolean';
          options?: Json;
          required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      custom_field_values: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string;
          custom_field_id: string;
          value_text: string | null;
          value_number: number | null;
          value_date: string | null;
          value_json: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id: string;
          custom_field_id: string;
          value_text?: string | null;
          value_number?: number | null;
          value_date?: string | null;
          value_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string;
          custom_field_id?: string;
          value_text?: string | null;
          value_number?: number | null;
          value_date?: string | null;
          value_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipelines: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          account_id: string;
          pipeline_id: string;
          name: string;
          order_index: number;
          color: string;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          pipeline_id: string;
          name: string;
          order_index?: number;
          color?: string;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          pipeline_id?: string;
          name?: string;
          order_index?: number;
          color?: string;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          account_id: string;
          pipeline_id: string;
          stage_id: string;
          contact_id: string | null;
          assigned_user_id: string | null;
          name: string;
          value: number;
          currency: string;
          probability: number;
          expected_close_date: string | null;
          source: string | null;
          notes: string | null;
          status: 'open' | 'won' | 'lost' | 'abandoned';
          lost_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          pipeline_id: string;
          stage_id: string;
          contact_id?: string | null;
          assigned_user_id?: string | null;
          name: string;
          value?: number;
          currency?: string;
          probability?: number;
          expected_close_date?: string | null;
          source?: string | null;
          notes?: string | null;
          status?: 'open' | 'won' | 'lost' | 'abandoned';
          lost_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          pipeline_id?: string;
          stage_id?: string;
          contact_id?: string | null;
          assigned_user_id?: string | null;
          name?: string;
          value?: number;
          currency?: string;
          probability?: number;
          expected_close_date?: string | null;
          source?: string | null;
          notes?: string | null;
          status?: 'open' | 'won' | 'lost' | 'abandoned';
          lost_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deal_activities: {
        Row: {
          id: string;
          account_id: string;
          deal_id: string;
          actor_user_id: string | null;
          activity_type: string;
          title: string;
          description: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          deal_id: string;
          actor_user_id?: string | null;
          activity_type?: string;
          title: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          deal_id?: string;
          actor_user_id?: string | null;
          activity_type?: string;
          title?: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      automations: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          description: string | null;
          trigger_type: string;
          trigger_config: Json;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          description?: string | null;
          trigger_type: string;
          trigger_config?: Json;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          description?: string | null;
          trigger_type?: string;
          trigger_config?: Json;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_nodes: {
        Row: {
          id: string;
          account_id: string;
          automation_id: string;
          node_id: string;
          node_type: string;
          label: string;
          config: Json;
          position_x: number;
          position_y: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          automation_id: string;
          node_id: string;
          node_type: string;
          label?: string;
          config?: Json;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          automation_id?: string;
          node_id?: string;
          node_type?: string;
          label?: string;
          config?: Json;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_edges: {
        Row: {
          id: string;
          account_id: string;
          automation_id: string;
          edge_id: string;
          source_node_id: string;
          target_node_id: string;
          source_handle: string | null;
          target_handle: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          automation_id: string;
          edge_id: string;
          source_node_id: string;
          target_node_id: string;
          source_handle?: string | null;
          target_handle?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          automation_id?: string;
          edge_id?: string;
          source_node_id?: string;
          target_node_id?: string;
          source_handle?: string | null;
          target_handle?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      automation_executions: {
        Row: {
          id: string;
          account_id: string;
          automation_id: string;
          trigger_data: Json;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          current_node_id: string | null;
          started_at: string;
          completed_at: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          automation_id: string;
          trigger_data?: Json;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          current_node_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          automation_id?: string;
          trigger_data?: Json;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          current_node_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      automation_execution_logs: {
        Row: {
          id: string;
          account_id: string;
          execution_id: string;
          node_id: string;
          node_type: string;
          status: 'success' | 'failed' | 'skipped';
          input_data: Json | null;
          output_data: Json | null;
          error_message: string | null;
          executed_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          execution_id: string;
          node_id: string;
          node_type: string;
          status?: 'success' | 'failed' | 'skipped';
          input_data?: Json | null;
          output_data?: Json | null;
          error_message?: string | null;
          executed_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          execution_id?: string;
          node_id?: string;
          node_type?: string;
          status?: 'success' | 'failed' | 'skipped';
          input_data?: Json | null;
          output_data?: Json | null;
          error_message?: string | null;
          executed_at?: string;
        };
        Relationships: [];
      };
      conversation_flows: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          trigger_keywords: string[] | null;
          is_default: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          trigger_keywords?: string[] | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          trigger_keywords?: string[] | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      flow_nodes: {
        Row: {
          id: string;
          account_id: string;
          flow_id: string;
          node_id: string;
          node_type: string;
          label: string;
          content: Json;
          position_x: number;
          position_y: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          flow_id: string;
          node_id: string;
          node_type: string;
          label?: string;
          content?: Json;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          flow_id?: string;
          node_id?: string;
          node_type?: string;
          label?: string;
          content?: Json;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      flow_edges: {
        Row: {
          id: string;
          account_id: string;
          flow_id: string;
          edge_id: string;
          source_node_id: string;
          target_node_id: string;
          source_handle: string | null;
          target_handle: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          flow_id: string;
          edge_id: string;
          source_node_id: string;
          target_node_id: string;
          source_handle?: string | null;
          target_handle?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          flow_id?: string;
          edge_id?: string;
          source_node_id?: string;
          target_node_id?: string;
          source_handle?: string | null;
          target_handle?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      flow_executions: {
        Row: {
          id: string;
          account_id: string;
          flow_id: string;
          conversation_id: string;
          contact_id: string | null;
          current_node_id: string | null;
          status: 'active' | 'paused' | 'completed' | 'cancelled';
          variables: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          flow_id: string;
          conversation_id: string;
          contact_id?: string | null;
          current_node_id?: string | null;
          status?: 'active' | 'paused' | 'completed' | 'cancelled';
          variables?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          flow_id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          current_node_id?: string | null;
          status?: 'active' | 'paused' | 'completed' | 'cancelled';
          variables?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_payments: {
        Row: {
          id: string;
          account_id: string;
          subscription_id: string | null;
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string | null;
          amount: number;
          currency: string;
          plan_slug: string;
          payment_type:
            | 'setup_and_first_month'
            | 'monthly_renewal'
            | 'upgrade'
            | 'downgrade'
            | 'manual_adjustment';
          status: 'captured' | 'failed' | 'refunded' | 'pending';
          is_setup_fee_included: boolean;
          setup_fee_amount: number;
          monthly_recurring_amount: number;
          period_start: string;
          period_end: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          subscription_id?: string | null;
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature?: string | null;
          amount: number;
          currency?: string;
          plan_slug: string;
          payment_type:
            | 'setup_and_first_month'
            | 'monthly_renewal'
            | 'upgrade'
            | 'downgrade'
            | 'manual_adjustment';
          status: 'captured' | 'failed' | 'refunded' | 'pending';
          is_setup_fee_included?: boolean;
          setup_fee_amount?: number;
          monthly_recurring_amount?: number;
          period_start?: string;
          period_end: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          subscription_id?: string | null;
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string | null;
          amount?: number;
          currency?: string;
          plan_slug?: string;
          payment_type?:
            | 'setup_and_first_month'
            | 'monthly_renewal'
            | 'upgrade'
            | 'downgrade'
            | 'manual_adjustment';
          status?: 'captured' | 'failed' | 'refunded' | 'pending';
          is_setup_fee_included?: boolean;
          setup_fee_amount?: number;
          monthly_recurring_amount?: number;
          period_start?: string;
          period_end?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          service: string | null;
          stage: string;
          source: string | null;
          channel: string | null;
          lead_score: string | null;
          score: string | null;
          value: number;
          currency: string;
          assigned_user_id: string | null;
          lost_reason: string | null;
          next_follow_up_at: string | null;
          attention_required: boolean;
          notes: string | null;
          metadata: Json | null;
          converted_at: string | null;
          converted_contact_id: string | null;
          converted_deal_id: string | null;
          conversation_id: string | null;
          ai_buying_intent: string | null;
          ai_lead_score: string | null;
          ai_score_numeric: number | null;
          ai_summary: string | null;
          ai_next_action: string | null;
          ai_product_service: string | null;
          ai_budget: string | null;
          ai_timeline: string | null;
          followup_status: string;
          last_customer_reply_at: string | null;
          last_automated_message_at: string | null;
          reminder_count: number;
          followup_stopped_reason: string | null;
          source_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          service?: string | null;
          stage?: string;
          source?: string | null;
          channel?: string | null;
          lead_score?: string | null;
          score?: string | null;
          value?: number;
          currency?: string;
          assigned_user_id?: string | null;
          lost_reason?: string | null;
          next_follow_up_at?: string | null;
          attention_required?: boolean;
          notes?: string | null;
          metadata?: Json | null;
          converted_at?: string | null;
          converted_contact_id?: string | null;
          converted_deal_id?: string | null;
          conversation_id?: string | null;
          ai_buying_intent?: string | null;
          ai_lead_score?: string | null;
          ai_score_numeric?: number | null;
          ai_summary?: string | null;
          ai_next_action?: string | null;
          ai_product_service?: string | null;
          ai_budget?: string | null;
          ai_timeline?: string | null;
          followup_status?: string;
          last_customer_reply_at?: string | null;
          last_automated_message_at?: string | null;
          reminder_count?: number;
          followup_stopped_reason?: string | null;
          source_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string | null;
          name?: string;
          phone?: string | null;
          email?: string | null;
          service?: string | null;
          stage?: string;
          source?: string | null;
          channel?: string | null;
          lead_score?: string | null;
          score?: string | null;
          value?: number;
          currency?: string;
          assigned_user_id?: string | null;
          lost_reason?: string | null;
          next_follow_up_at?: string | null;
          attention_required?: boolean;
          notes?: string | null;
          metadata?: Json | null;
          converted_at?: string | null;
          converted_contact_id?: string | null;
          converted_deal_id?: string | null;
          conversation_id?: string | null;
          ai_buying_intent?: string | null;
          ai_lead_score?: string | null;
          ai_score_numeric?: number | null;
          ai_summary?: string | null;
          ai_next_action?: string | null;
          ai_product_service?: string | null;
          ai_budget?: string | null;
          ai_timeline?: string | null;
          followup_status?: string;
          last_customer_reply_at?: string | null;
          last_automated_message_at?: string | null;
          reminder_count?: number;
          followup_stopped_reason?: string | null;
          source_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      followup_policies: {
        Row: {
          id: string;
          account_id: string;
          enabled: boolean;
          max_reminders: number;
          reminder_delay_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          enabled?: boolean;
          max_reminders?: number;
          reminder_delay_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          enabled?: boolean;
          max_reminders?: number;
          reminder_delay_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_followups: {
        Row: {
          id: string;
          account_id: string;
          lead_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          followup_type: string;
          scheduled_at: string;
          sent_at: string | null;
          status: string;
          attempt_number: number;
          cancelled_reason: string | null;
          idempotency_key: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          lead_id: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          followup_type?: string;
          scheduled_at: string;
          sent_at?: string | null;
          status?: string;
          attempt_number?: number;
          cancelled_reason?: string | null;
          idempotency_key: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          lead_id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          followup_type?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: string;
          attempt_number?: number;
          cancelled_reason?: string | null;
          idempotency_key?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          account_id: string;
          lead_id: string;
          actor_user_id: string | null;
          activity_type: string;
          previous_stage: string | null;
          next_stage: string | null;
          reason: string | null;
          notes: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          lead_id: string;
          actor_user_id?: string | null;
          activity_type: string;
          previous_stage?: string | null;
          next_stage?: string | null;
          reason?: string | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          lead_id?: string;
          actor_user_id?: string | null;
          activity_type?: string;
          previous_stage?: string | null;
          next_stage?: string | null;
          reason?: string | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          account_id: string;
          lead_id: string;
          author_id: string | null;
          note_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          lead_id: string;
          author_id?: string | null;
          note_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          lead_id?: string;
          author_id?: string | null;
          note_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          title: string;
          description: string | null;
          due_at: string;
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          assigned_user_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          title: string;
          description?: string | null;
          due_at?: string;
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_user_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          title?: string;
          description?: string | null;
          due_at?: string;
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          assigned_user_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string | null;
          deal_id: string | null;
          quotation_number: string;
          status:
            | 'draft'
            | 'sent'
            | 'accepted'
            | 'rejected'
            | 'expired'
            | 'converted';
          issue_date: string;
          valid_until: string | null;
          currency: string;
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          notes: string | null;
          terms: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          travel_details: Json | null;
          public_token: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id?: string | null;
          deal_id?: string | null;
          quotation_number: string;
          status?:
            | 'draft'
            | 'sent'
            | 'accepted'
            | 'rejected'
            | 'expired'
            | 'converted';
          issue_date?: string;
          valid_until?: string | null;
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          notes?: string | null;
          terms?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          travel_details?: Json | null;
          public_token?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string | null;
          deal_id?: string | null;
          quotation_number?: string;
          status?:
            | 'draft'
            | 'sent'
            | 'accepted'
            | 'rejected'
            | 'expired'
            | 'converted';
          issue_date?: string;
          valid_until?: string | null;
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          notes?: string | null;
          terms?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          travel_details?: Json | null;
          public_token?: string | null;
        };
        Relationships: [];
      };
      quotation_items: {
        Row: {
          id: string;
          account_id: string;
          quotation_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount: number;
          tax_rate: number;
          line_total: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          quotation_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          tax_rate?: number;
          line_total?: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          quotation_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          tax_rate?: number;
          line_total?: number;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          account_id: string;
          contact_id: string | null;
          quotation_id: string | null;
          deal_id: string | null;
          invoice_number: string;
          status:
            'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
          issue_date: string;
          due_date: string | null;
          currency: string;
          subtotal: number;
          discount_total: number;
          tax_total: number;
          total: number;
          amount_paid: number;
          balance_due: number;
          notes: string | null;
          terms: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          contact_id?: string | null;
          quotation_id?: string | null;
          deal_id?: string | null;
          invoice_number: string;
          status?:
            'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
          issue_date?: string;
          due_date?: string | null;
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          amount_paid?: number;
          balance_due?: number;
          notes?: string | null;
          terms?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          contact_id?: string | null;
          quotation_id?: string | null;
          deal_id?: string | null;
          invoice_number?: string;
          status?:
            'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
          issue_date?: string;
          due_date?: string | null;
          currency?: string;
          subtotal?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          amount_paid?: number;
          balance_due?: number;
          notes?: string | null;
          terms?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          account_id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount: number;
          tax_rate: number;
          line_total: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          tax_rate?: number;
          line_total?: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          tax_rate?: number;
          line_total?: number;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      invoice_payments: {
        Row: {
          id: string;
          account_id: string;
          invoice_id: string;
          amount: number;
          payment_date: string;
          payment_method: string;
          reference_note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          invoice_id: string;
          amount: number;
          payment_date?: string;
          payment_method?: string;
          reference_note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          invoice_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: string;
          reference_note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_role: AccountRole;
    };
  };
}
