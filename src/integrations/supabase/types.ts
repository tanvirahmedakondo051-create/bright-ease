export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_providers: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          custom_headers: Json
          id: string
          is_active: boolean
          is_default: boolean
          max_tokens: number
          model: string
          name: string
          sort_order: number
          temperature: number
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          custom_headers?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_tokens?: number
          model: string
          name: string
          sort_order?: number
          temperature?: number
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          custom_headers?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_tokens?: number
          model?: string
          name?: string
          sort_order?: number
          temperature?: number
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          tags: string[]
          type: string
          url_or_code: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          tags?: string[]
          type: string
          url_or_code: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          tags?: string[]
          type?: string
          url_or_code?: string
        }
        Relationships: []
      }
      aura_payments: {
        Row: {
          amount: number
          coins_granted: boolean
          created_at: string
          id: string
          invoice_id: string | null
          plan_id: string
          raw: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          coins_granted?: boolean
          created_at?: string
          id?: string
          invoice_id?: string | null
          plan_id: string
          raw?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          coins_granted?: boolean
          created_at?: string
          id?: string
          invoice_id?: string | null
          plan_id?: string
          raw?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aura_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      backend_rows: {
        Row: {
          created_at: string
          data: Json
          id: string
          owner_id: string | null
          project_id: string
          table_name: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string | null
          project_id: string
          table_name: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string | null
          project_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "backend_rows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      backend_tables: {
        Row: {
          created_at: string
          id: string
          project_id: string
          schema_json: Json
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          schema_json?: Json
          table_name: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          schema_json?: Json
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "backend_tables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_brain: {
        Row: {
          bot_type: string | null
          code_snippet: string | null
          created_at: string
          error_signature: string | null
          fix_summary: string | null
          id: string
          kind: string
          pattern: Json | null
          quality: number | null
          root_cause: string | null
          source: string
          symptom: string | null
          use_count: number
        }
        Insert: {
          bot_type?: string | null
          code_snippet?: string | null
          created_at?: string
          error_signature?: string | null
          fix_summary?: string | null
          id?: string
          kind?: string
          pattern?: Json | null
          quality?: number | null
          root_cause?: string | null
          source?: string
          symptom?: string | null
          use_count?: number
        }
        Update: {
          bot_type?: string | null
          code_snippet?: string | null
          created_at?: string
          error_signature?: string | null
          fix_summary?: string | null
          id?: string
          kind?: string
          pattern?: Json | null
          quality?: number | null
          root_cause?: string | null
          source?: string
          symptom?: string | null
          use_count?: number
        }
        Relationships: []
      }
      bot_jobs: {
        Row: {
          attempts: number
          bot_id: string
          created_at: string
          error: string | null
          events: Json
          heartbeat_at: string
          id: string
          input: Json
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          bot_id: string
          created_at?: string
          error?: string | null
          events?: Json
          heartbeat_at?: string
          id?: string
          input?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          bot_id?: string
          created_at?: string
          error?: string | null
          events?: Json
          heartbeat_at?: string
          id?: string
          input?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_jobs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_subtasks: {
        Row: {
          attempts: number
          bot_id: string
          created_at: string
          error: string | null
          heartbeat_at: string
          id: string
          job_id: string
          key: string
          lines: number
          output: string
          sig: string
          status: string
          title: string
          tokens: number
          user_id: string
        }
        Insert: {
          attempts?: number
          bot_id: string
          created_at?: string
          error?: string | null
          heartbeat_at?: string
          id?: string
          job_id: string
          key: string
          lines?: number
          output?: string
          sig: string
          status?: string
          title?: string
          tokens?: number
          user_id: string
        }
        Update: {
          attempts?: number
          bot_id?: string
          created_at?: string
          error?: string | null
          heartbeat_at?: string
          id?: string
          job_id?: string
          key?: string
          lines?: number
          output?: string
          sig?: string
          status?: string
          title?: string
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      bot_usage_daily: {
        Row: {
          ai_messages: number
          builds: number
          fix_requests: number
          temp_host_minutes: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          ai_messages?: number
          builds?: number
          fix_requests?: number
          temp_host_minutes?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          ai_messages?: number
          builds?: number
          fix_requests?: number
          temp_host_minutes?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_versions: {
        Row: {
          bot_id: string
          coins_used: number
          created_at: string
          files: Json
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          bot_id: string
          coins_used?: number
          created_at?: string
          files?: Json
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          bot_id?: string
          coins_used?: number
          created_at?: string
          files?: Json
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_versions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          admin_id: string | null
          bot_username: string | null
          cancel_requested_at: string | null
          created_at: string
          emoji_mode: string
          files: Json
          id: string
          language: string
          last_build_at: string | null
          last_log: string | null
          messages: Json
          name: string
          pending_answers: Json | null
          pending_questions: Json | null
          run_mode: string | null
          status: string
          temp_expires_at: string | null
          temp_started_at: string | null
          temp_status: string
          test_log: string | null
          test_until: string | null
          token_enc: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          bot_username?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          emoji_mode?: string
          files?: Json
          id?: string
          language?: string
          last_build_at?: string | null
          last_log?: string | null
          messages?: Json
          name?: string
          pending_answers?: Json | null
          pending_questions?: Json | null
          run_mode?: string | null
          status?: string
          temp_expires_at?: string | null
          temp_started_at?: string | null
          temp_status?: string
          test_log?: string | null
          test_until?: string | null
          token_enc?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          bot_username?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          emoji_mode?: string
          files?: Json
          id?: string
          language?: string
          last_build_at?: string | null
          last_log?: string | null
          messages?: Json
          name?: string
          pending_answers?: Json | null
          pending_questions?: Json | null
          run_mode?: string | null
          status?: string
          temp_expires_at?: string | null
          temp_started_at?: string | null
          temp_status?: string
          test_log?: string | null
          test_until?: string | null
          token_enc?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_summaries: {
        Row: {
          created_at: string
          id: string
          project_id: string
          summary_text: string
          up_to_message_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          summary_text: string
          up_to_message_id: number
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          summary_text?: string
          up_to_message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      curated_lotties: {
        Row: {
          attribution_required: boolean
          category: string
          created_at: string
          enabled: boolean
          id: string
          json_url: string
          license: string
          source: string
          source_url: string
          tags: string[]
          title: string
        }
        Insert: {
          attribution_required?: boolean
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          json_url: string
          license?: string
          source?: string
          source_url?: string
          tags?: string[]
          title?: string
        }
        Update: {
          attribution_required?: boolean
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          json_url?: string
          license?: string
          source?: string
          source_url?: string
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      curated_photos: {
        Row: {
          alt: string
          attribution_required: boolean
          category: string
          created_at: string
          enabled: boolean
          id: string
          license: string
          source: string
          source_url: string
          tags: string[]
          url: string
        }
        Insert: {
          alt?: string
          attribution_required?: boolean
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          license?: string
          source?: string
          source_url?: string
          tags?: string[]
          url: string
        }
        Update: {
          alt?: string
          attribution_required?: boolean
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          license?: string
          source?: string
          source_url?: string
          tags?: string[]
          url?: string
        }
        Relationships: []
      }
      flag_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          events: Json
          heartbeat_at: string
          id: string
          input: Json
          mode: string
          origin: string
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          events?: Json
          heartbeat_at?: string
          id?: string
          input?: Json
          mode?: string
          origin: string
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          events?: Json
          heartbeat_at?: string
          id?: string
          input?: Json
          mode?: string
          origin?: string
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_connections: {
        Row: {
          access_token_encrypted: string
          avatar_url: string
          created_at: string
          github_username: string
          id: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          avatar_url?: string
          created_at?: string
          github_username?: string
          id?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          avatar_url?: string
          created_at?: string
          github_username?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      icon_favorites: {
        Row: {
          created_at: string
          enabled: boolean
          icon_set: string
          id: string
          name: string
          tags: string[]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          icon_set: string
          id?: string
          name: string
          tags?: string[]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          icon_set?: string
          id?: string
          name?: string
          tags?: string[]
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          plan_id: string
          sender_number: string | null
          status: string
          trx_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method: string
          plan_id: string
          sender_number?: string | null
          status?: string
          trx_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          plan_id?: string
          sender_number?: string | null
          status?: string
          trx_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pexels_cache: {
        Row: {
          created_at: string
          query: string
          results: Json
        }
        Insert: {
          created_at?: string
          query: string
          results?: Json
        }
        Update: {
          created_at?: string
          query?: string
          results?: Json
        }
        Relationships: []
      }
      plan_providers: {
        Row: {
          plan_id: string
          provider_id: string
        }
        Insert: {
          plan_id: string
          provider_id: string
        }
        Update: {
          plan_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_providers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_providers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sessions: {
        Row: {
          answers_json: Json
          approved_at: string | null
          created_at: string
          current_step: number
          id: string
          plan_markdown: string | null
          project_id: string | null
          prompt: string
          question_set: Json
          spec_checksum: string | null
          spec_json: Json | null
          spec_version: number | null
          status: string
          total_steps: number
          user_id: string
        }
        Insert: {
          answers_json?: Json
          approved_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          plan_markdown?: string | null
          project_id?: string | null
          prompt?: string
          question_set?: Json
          spec_checksum?: string | null
          spec_json?: Json | null
          spec_version?: number | null
          status?: string
          total_steps?: number
          user_id: string
        }
        Update: {
          answers_json?: Json
          approved_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          plan_markdown?: string | null
          project_id?: string | null
          prompt?: string
          question_set?: Json
          spec_checksum?: string | null
          spec_json?: Json | null
          spec_version?: number | null
          status?: string
          total_steps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          allow_custom_domain: boolean
          bonus_coins: number
          can_download: boolean
          can_publish: boolean
          can_view_code: boolean
          coin_cap: number
          created_at: string
          daily_ai_messages: number
          daily_coins: number
          default_provider_id: string | null
          duration_days: number
          features: string[]
          id: string
          is_default: boolean
          max_bot_projects: number
          max_fix_requests_per_day: number
          max_projects: number
          max_published: number
          name_bn: string
          name_en: string
          price_bdt: number
          rate_limit_per_minute: number
          show_badge: boolean
          temp_host_minutes_per_day: number
          tokens_per_day: number
          zip_download_allowed: boolean
        }
        Insert: {
          allow_custom_domain?: boolean
          bonus_coins?: number
          can_download?: boolean
          can_publish?: boolean
          can_view_code?: boolean
          coin_cap?: number
          created_at?: string
          daily_ai_messages?: number
          daily_coins?: number
          default_provider_id?: string | null
          duration_days?: number
          features?: string[]
          id?: string
          is_default?: boolean
          max_bot_projects?: number
          max_fix_requests_per_day?: number
          max_projects?: number
          max_published?: number
          name_bn: string
          name_en: string
          price_bdt?: number
          rate_limit_per_minute?: number
          show_badge?: boolean
          temp_host_minutes_per_day?: number
          tokens_per_day?: number
          zip_download_allowed?: boolean
        }
        Update: {
          allow_custom_domain?: boolean
          bonus_coins?: number
          can_download?: boolean
          can_publish?: boolean
          can_view_code?: boolean
          coin_cap?: number
          created_at?: string
          daily_ai_messages?: number
          daily_coins?: number
          default_provider_id?: string | null
          duration_days?: number
          features?: string[]
          id?: string
          is_default?: boolean
          max_bot_projects?: number
          max_fix_requests_per_day?: number
          max_projects?: number
          max_published?: number
          name_bn?: string
          name_en?: string
          price_bdt?: number
          rate_limit_per_minute?: number
          show_badge?: boolean
          temp_host_minutes_per_day?: number
          tokens_per_day?: number
          zip_download_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plans_default_provider_id_fkey"
            columns: ["default_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          coins: number
          created_at: string
          email: string | null
          id: string
          is_banned: boolean
          last_reset_date: string
          name: string | null
          plan_ended_at: string | null
          plan_expires_at: string | null
          plan_id: string | null
          sites_deleted_at: string | null
          tokens_used_today: number
        }
        Insert: {
          coins?: number
          created_at?: string
          email?: string | null
          id: string
          is_banned?: boolean
          last_reset_date?: string
          name?: string | null
          plan_ended_at?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          sites_deleted_at?: string | null
          tokens_used_today?: number
        }
        Update: {
          coins?: number
          created_at?: string
          email?: string | null
          id?: string
          is_banned?: boolean
          last_reset_date?: string
          name?: string | null
          plan_ended_at?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          sites_deleted_at?: string | null
          tokens_used_today?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      project_analysis: {
        Row: {
          analyzed_at: string
          entry_file: string
          file_count: number
          file_map_json: Json
          framework: string
          id: string
          project_id: string
        }
        Insert: {
          analyzed_at?: string
          entry_file?: string
          file_count?: number
          file_map_json?: Json
          framework?: string
          id?: string
          project_id: string
        }
        Update: {
          analyzed_at?: string
          entry_file?: string
          file_count?: number
          file_map_json?: Json
          framework?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_analysis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          changelog_bn: string
          code_html: string
          created_at: string
          id: string
          project_id: string
          version_number: number
        }
        Insert: {
          changelog_bn?: string
          code_html: string
          created_at?: string
          id?: string
          project_id: string
          version_number: number
        }
        Update: {
          changelog_bn?: string
          code_html?: string
          created_at?: string
          id?: string
          project_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          backend_enabled: boolean
          build_log: string
          build_status: string
          changes_since_publish: number
          code_html: string
          created_at: string
          custom_domain: string | null
          deploy_message: string
          deploy_status: string
          deployed_at: string | null
          deployed_url: string | null
          dns_status: string
          domain_checked_at: string | null
          domain_found_ns: string[]
          domain_status: string
          files: Json
          flag_reason: string | null
          github_repo: string | null
          id: string
          is_flagged: boolean
          is_published: boolean
          messages: Json
          name: string
          plan_answers: Json | null
          plan_session_id: string | null
          project_type: string
          published_code_hash: string | null
          published_html: string | null
          published_version: number
          show_badge: boolean
          skill_pack_id: string | null
          spec_checksum: string | null
          spec_json: Json | null
          spec_version: number | null
          subdomain: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backend_enabled?: boolean
          build_log?: string
          build_status?: string
          changes_since_publish?: number
          code_html?: string
          created_at?: string
          custom_domain?: string | null
          deploy_message?: string
          deploy_status?: string
          deployed_at?: string | null
          deployed_url?: string | null
          dns_status?: string
          domain_checked_at?: string | null
          domain_found_ns?: string[]
          domain_status?: string
          files?: Json
          flag_reason?: string | null
          github_repo?: string | null
          id?: string
          is_flagged?: boolean
          is_published?: boolean
          messages?: Json
          name?: string
          plan_answers?: Json | null
          plan_session_id?: string | null
          project_type?: string
          published_code_hash?: string | null
          published_html?: string | null
          published_version?: number
          show_badge?: boolean
          skill_pack_id?: string | null
          spec_checksum?: string | null
          spec_json?: Json | null
          spec_version?: number | null
          subdomain?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backend_enabled?: boolean
          build_log?: string
          build_status?: string
          changes_since_publish?: number
          code_html?: string
          created_at?: string
          custom_domain?: string | null
          deploy_message?: string
          deploy_status?: string
          deployed_at?: string | null
          deployed_url?: string | null
          dns_status?: string
          domain_checked_at?: string | null
          domain_found_ns?: string[]
          domain_status?: string
          files?: Json
          flag_reason?: string | null
          github_repo?: string | null
          id?: string
          is_flagged?: boolean
          is_published?: boolean
          messages?: Json
          name?: string
          plan_answers?: Json | null
          plan_session_id?: string | null
          project_type?: string
          published_code_hash?: string | null
          published_html?: string | null
          published_version?: number
          show_badge?: boolean
          skill_pack_id?: string | null
          spec_checksum?: string | null
          spec_json?: Json | null
          spec_version?: number | null
          subdomain?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_skill_pack_id_fkey"
            columns: ["skill_pack_id"]
            isOneToOne: false
            referencedRelation: "skill_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          agent_host: string
          agent_port: number
          announcement_active: boolean
          announcement_color: string
          announcement_text: string
          aurapay_enabled: boolean
          backend_master_url: string
          backend_max_rows: number
          backend_max_tables: number
          build_prompt: string
          button_emoji_meta: Json
          button_emojis: Json
          delete_after_days: number
          free_block_publish: boolean
          grace_days: number
          hexahoster_url: string
          hosting_domain: string
          id: number
          logo_url: string | null
          maintenance_mode: boolean
          max_output_tokens: number
          ns1: string
          ns2: string
          ns3: string
          ns4: string
          payment_instructions: string
          plan_prompt: string
          qa_screenshots: boolean
          rate_limit_per_minute: number
          require_email_verify: boolean
          server_ip: string
          single_pass_simple: boolean
          site_name: string
          support_email: string
          support_whatsapp: string
          system_prompt: string
          tagline: string
          telegram_link: string
          tokens_per_coin: number
          updated_at: string
        }
        Insert: {
          agent_host?: string
          agent_port?: number
          announcement_active?: boolean
          announcement_color?: string
          announcement_text?: string
          aurapay_enabled?: boolean
          backend_master_url?: string
          backend_max_rows?: number
          backend_max_tables?: number
          build_prompt?: string
          button_emoji_meta?: Json
          button_emojis?: Json
          delete_after_days?: number
          free_block_publish?: boolean
          grace_days?: number
          hexahoster_url?: string
          hosting_domain?: string
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_output_tokens?: number
          ns1?: string
          ns2?: string
          ns3?: string
          ns4?: string
          payment_instructions?: string
          plan_prompt?: string
          qa_screenshots?: boolean
          rate_limit_per_minute?: number
          require_email_verify?: boolean
          server_ip?: string
          single_pass_simple?: boolean
          site_name?: string
          support_email?: string
          support_whatsapp?: string
          system_prompt?: string
          tagline?: string
          telegram_link?: string
          tokens_per_coin?: number
          updated_at?: string
        }
        Update: {
          agent_host?: string
          agent_port?: number
          announcement_active?: boolean
          announcement_color?: string
          announcement_text?: string
          aurapay_enabled?: boolean
          backend_master_url?: string
          backend_max_rows?: number
          backend_max_tables?: number
          build_prompt?: string
          button_emoji_meta?: Json
          button_emojis?: Json
          delete_after_days?: number
          free_block_publish?: boolean
          grace_days?: number
          hexahoster_url?: string
          hosting_domain?: string
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_output_tokens?: number
          ns1?: string
          ns2?: string
          ns3?: string
          ns4?: string
          payment_instructions?: string
          plan_prompt?: string
          qa_screenshots?: boolean
          rate_limit_per_minute?: number
          require_email_verify?: boolean
          server_ip?: string
          single_pass_simple?: boolean
          site_name?: string
          support_email?: string
          support_whatsapp?: string
          system_prompt?: string
          tagline?: string
          telegram_link?: string
          tokens_per_coin?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_users: {
        Row: {
          avatar_url: string
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string
          project_id: string
          provider: string
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          email: string
          id?: string
          name?: string
          password_hash?: string
          project_id: string
          provider?: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string
          project_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_packs: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name_bn: string
          slug: string
          sort_order: number
          system_prompt: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name_bn: string
          slug: string
          sort_order?: number
          system_prompt?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name_bn?: string
          slug?: string
          sort_order?: number
          system_prompt?: string
        }
        Relationships: []
      }
      task_checkpoints: {
        Row: {
          completed_steps: Json
          created_at: string
          expires_at: string
          id: string
          partial_html: string
          pending_steps: Json
          progress_percent: number
          project_id: string
          prompt: string
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_steps?: Json
          created_at?: string
          expires_at?: string
          id?: string
          partial_html?: string
          pending_steps?: Json
          progress_percent?: number
          project_id: string
          prompt?: string
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_steps?: Json
          created_at?: string
          expires_at?: string
          id?: string
          partial_html?: string
          pending_steps?: Json
          progress_percent?: number
          project_id?: string
          prompt?: string
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checkpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string
          id: string
          provider_name: string | null
          tokens_saved: number
          tokens_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_name?: string | null
          tokens_saved?: number
          tokens_used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_name?: string | null
          tokens_saved?: number
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_coins: {
        Args: { _amount: number; _reason: string; _type: string; _user: string }
        Returns: number
      }
      daily_coin_refill: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      job_push: {
        Args: { _events: Json; _id: string; _status: string }
        Returns: string
      }
      kick_bot_job: {
        Args: { _id: string; _origin: string }
        Returns: undefined
      }
      kick_job: { Args: { _id: string }; Returns: undefined }
      rescue_jobs: { Args: never; Returns: number }
      sweep_bot_jobs: { Args: { _origin: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
