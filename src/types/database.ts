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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_role: AccountRole;
    };
  };
}
