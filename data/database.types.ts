/**
 * Supabase database types — GENERATED. Do not edit.
 *
 * Regenerate after every migration:
 *
 *   npx --yes supabase gen types typescript --linked > data/database.types.ts
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 *   data/types.ts used to hand-write the `Database` type: 22 tables, against a
 *   schema that has 105. Worse than incomplete — it was structurally invalid.
 *   @supabase/postgrest-js requires `Relationships` on every table and
 *   Views/Functions/Enums/CompositeTypes on the schema; none were there. So the
 *   type failed its GenericSchema constraint and supabase-js resolved EVERY
 *   table to `never`, including the 22 that were present.
 *
 *   Which means the typed client never typed anything, and the 24 `(db as any)`
 *   casts scattered through this codebase were not laziness — they were the only
 *   way to use it. analytics-repository.ts had the diagnosis written in a comment
 *   and built around it anyway.
 *
 *   data/types.ts still owns the hand-written Row/Insert types the app passes
 *   around (SessionRow, EventRow, …). Only `Database` comes from here.
 */

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _migrations: {
        Row: {
          applied_at: string
          filename: string
        }
        Insert: {
          applied_at?: string
          filename: string
        }
        Update: {
          applied_at?: string
          filename?: string
        }
        Relationships: []
      }
      abm_lead_visits: {
        Row: {
          id: string
          lead_id: string
          path: string
          tenant_id: string
          visited_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          path?: string
          tenant_id: string
          visited_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          path?: string
          tenant_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abm_lead_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "abm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      abm_leads: {
        Row: {
          created_at: string
          expires_at: string | null
          first_seen_at: string | null
          id: string
          identifier: string
          last_seen_at: string | null
          profile: Json
          segment_hint: string | null
          status: string
          target_path: string
          tenant_id: string
          updated_at: string
          vanity_path: string | null
          visit_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string | null
          id?: string
          identifier: string
          last_seen_at?: string | null
          profile?: Json
          segment_hint?: string | null
          status?: string
          target_path?: string
          tenant_id: string
          updated_at?: string
          vanity_path?: string | null
          visit_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string | null
          id?: string
          identifier?: string
          last_seen_at?: string | null
          profile?: Json
          segment_hint?: string | null
          status?: string
          target_path?: string
          tenant_id?: string
          updated_at?: string
          vanity_path?: string | null
          visit_count?: number
        }
        Relationships: []
      }
      abm_settings: {
        Row: {
          hubspot_token: string | null
          notify_min_score: number | null
          notify_slack_url: string | null
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          hubspot_token?: string | null
          notify_min_score?: number | null
          notify_slack_url?: string | null
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          hubspot_token?: string | null
          notify_min_score?: number | null
          notify_slack_url?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      ad_conversion_events: {
        Row: {
          created_at: string
          error: string | null
          event_name: string | null
          id: string
          platform: string
          status: string
          tenant_id: string
          trigger: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_name?: string | null
          id?: string
          platform: string
          status: string
          tenant_id: string
          trigger?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_name?: string | null
          id?: string
          platform?: string
          status?: string
          tenant_id?: string
          trigger?: string
        }
        Relationships: []
      }
      ad_sync_audience_members: {
        Row: {
          created_at: string
          email_hash: string
          platform: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email_hash: string
          platform: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email_hash?: string
          platform?: string
          tenant_id?: string
        }
        Relationships: []
      }
      ad_sync_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          members_removed: number
          members_sent: number
          members_total: number
          platform: string
          status: string
          tenant_id: string
          trigger: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          members_removed?: number
          members_sent?: number
          members_total?: number
          platform: string
          status: string
          tenant_id: string
          trigger?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          members_removed?: number
          members_sent?: number
          members_total?: number
          platform?: string
          status?: string
          tenant_id?: string
          trigger?: string
        }
        Relationships: []
      }
      ad_sync_settings: {
        Row: {
          conversions: Json | null
          created_at: string
          enabled: boolean
          google: Json | null
          last_run_at: string | null
          linkedin: Json | null
          meta: Json | null
          segment: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conversions?: Json | null
          created_at?: string
          enabled?: boolean
          google?: Json | null
          last_run_at?: string | null
          linkedin?: Json | null
          meta?: Json | null
          segment?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conversions?: Json | null
          created_at?: string
          enabled?: boolean
          google?: Json | null
          last_run_at?: string | null
          linkedin?: Json | null
          meta?: Json | null
          segment?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      adaptive_blocks: {
        Row: {
          adaptive_variants: Json
          created_at: string
          default_variant: Json
          id: string
          is_active: boolean
          key: string
          label: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          adaptive_variants?: Json
          created_at?: string
          default_variant: Json
          id?: string
          is_active?: boolean
          key: string
          label?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          adaptive_variants?: Json
          created_at?: string
          default_variant?: Json
          id?: string
          is_active?: boolean
          key?: string
          label?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_tenants: {
        Row: {
          assigned_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          name: string | null
          password_hash: string
          role: string
          two_factor_backup_codes: string[]
          two_factor_enabled: boolean
          two_factor_enabled_at: string | null
          two_factor_pending_secret: string | null
          two_factor_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          name?: string | null
          password_hash: string
          role?: string
          two_factor_backup_codes?: string[]
          two_factor_enabled?: boolean
          two_factor_enabled_at?: string | null
          two_factor_pending_secret?: string | null
          two_factor_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          name?: string | null
          password_hash?: string
          role?: string
          two_factor_backup_codes?: string[]
          two_factor_enabled?: boolean
          two_factor_enabled_at?: string | null
          two_factor_pending_secret?: string | null
          two_factor_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_branding: {
        Row: {
          agency_name: string | null
          created_at: string
          custom_domain: string | null
          domain_verified: boolean
          favicon_url: string | null
          footer_text: string | null
          logo_url: string | null
          primary_color: string | null
          support_email: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_name?: string | null
          created_at?: string
          custom_domain?: string | null
          domain_verified?: boolean
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string | null
          support_email?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_name?: string | null
          created_at?: string
          custom_domain?: string | null
          domain_verified?: boolean
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string | null
          support_email?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_memberships: {
        Row: {
          agency_tenant_id: string
          created_at: string
          id: string
          invite_note: string | null
          invited_by: string | null
          member_tenant_id: string
          role: string
          updated_at: string
        }
        Insert: {
          agency_tenant_id: string
          created_at?: string
          id?: string
          invite_note?: string | null
          invited_by?: string | null
          member_tenant_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          agency_tenant_id?: string
          created_at?: string
          id?: string
          invite_note?: string | null
          invited_by?: string | null
          member_tenant_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_decision_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          live_plan: Json
          live_provider: string
          page_type: string
          plans_match: boolean
          session_id: string
          shadow_plan: Json
          shadow_provider: string
          tenant_id: string | null
        }
        Insert: {
          context: Json
          created_at?: string
          id?: string
          live_plan: Json
          live_provider: string
          page_type: string
          plans_match: boolean
          session_id: string
          shadow_plan: Json
          shadow_provider: string
          tenant_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          live_plan?: Json
          live_provider?: string
          page_type?: string
          plans_match?: boolean
          session_id?: string
          shadow_plan?: Json
          shadow_provider?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_segments: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      behavior_scoring_rules: {
        Row: {
          created_at: string
          decay_profile: string
          description: string | null
          event_type: string
          event_value: string | null
          id: string
          is_active: boolean
          key: string | null
          label: string
          page_category: string | null
          priority: number
          score: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decay_profile?: string
          description?: string | null
          event_type: string
          event_value?: string | null
          id?: string
          is_active?: boolean
          key?: string | null
          label: string
          page_category?: string | null
          priority?: number
          score: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decay_profile?: string
          description?: string | null
          event_type?: string
          event_value?: string | null
          id?: string
          is_active?: boolean
          key?: string | null
          label?: string
          page_category?: string | null
          priority?: number
          score?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      behavior_sequence_patterns: {
        Row: {
          confidence_contribution: number | null
          created_at: string
          cross_session: boolean | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          max_gap_minutes: number
          name: string
          priority: number
          score: number
          sequence: Json
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confidence_contribution?: number | null
          created_at?: string
          cross_session?: boolean | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label?: string
          max_gap_minutes?: number
          name: string
          priority?: number
          score?: number
          sequence: Json
          slug?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confidence_contribution?: number | null
          created_at?: string
          cross_session?: boolean | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          max_gap_minutes?: number
          name?: string
          priority?: number
          score?: number
          sequence?: Json
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_defaults: {
        Row: {
          auto_reload_amount: number
          auto_reload_trigger: number
          created_at: string
          currency: string
          id: string
          key: string
          low_balance_threshold: number
          monthly_auto_reload_cap: number | null
          updated_at: string
        }
        Insert: {
          auto_reload_amount?: number
          auto_reload_trigger?: number
          created_at?: string
          currency?: string
          id?: string
          key?: string
          low_balance_threshold?: number
          monthly_auto_reload_cap?: number | null
          updated_at?: string
        }
        Update: {
          auto_reload_amount?: number
          auto_reload_trigger?: number
          created_at?: string
          currency?: string
          id?: string
          key?: string
          low_balance_threshold?: number
          monthly_auto_reload_cap?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          active: boolean
          annual_monthly_price: number
          created_at: string
          description: string | null
          features: Json
          id: string
          included_credits: number
          label: string
          limits: Json
          monthly_price: number
          overage_price_per_credit: number
          plan_id: string
          sort_order: number
          stripe_monthly_price_id: string | null
          stripe_test_monthly_price_id: string | null
          stripe_test_yearly_price_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          active?: boolean
          annual_monthly_price?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          included_credits?: number
          label: string
          limits?: Json
          monthly_price?: number
          overage_price_per_credit?: number
          plan_id: string
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_test_monthly_price_id?: string | null
          stripe_test_yearly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          active?: boolean
          annual_monthly_price?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          included_credits?: number
          label?: string
          limits?: Json
          monthly_price?: number
          overage_price_per_credit?: number
          plan_id?: string
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_test_monthly_price_id?: string | null
          stripe_test_yearly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      billing_request_debug_events: {
        Row: {
          anomalies: Json
          anomaly_count: number
          billing_mode: string
          created_at: string
          demo_mode: boolean
          entries: Json
          id: string
          request_id: string
          result: string
          route: string | null
          tenant_id: string
          total_credits_used: number
          total_price: number
          wallet_after: number | null
          wallet_before: number | null
        }
        Insert: {
          anomalies?: Json
          anomaly_count?: number
          billing_mode?: string
          created_at?: string
          demo_mode?: boolean
          entries?: Json
          id?: string
          request_id: string
          result?: string
          route?: string | null
          tenant_id: string
          total_credits_used?: number
          total_price?: number
          wallet_after?: number | null
          wallet_before?: number | null
        }
        Update: {
          anomalies?: Json
          anomaly_count?: number
          billing_mode?: string
          created_at?: string
          demo_mode?: boolean
          entries?: Json
          id?: string
          request_id?: string
          result?: string
          route?: string | null
          tenant_id?: string
          total_credits_used?: number
          total_price?: number
          wallet_after?: number | null
          wallet_before?: number | null
        }
        Relationships: []
      }
      context_variable_metadata: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          enabled: boolean
          id: number
          is_custom: boolean
          key: string
          label: string | null
          sort_order: number
          updated_at: string
          usable_in_ai: boolean
          usable_in_rules: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: number
          is_custom?: boolean
          key: string
          label?: string | null
          sort_order?: number
          updated_at?: string
          usable_in_ai?: boolean
          usable_in_rules?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: number
          is_custom?: boolean
          key?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
          usable_in_ai?: boolean
          usable_in_rules?: boolean
        }
        Relationships: []
      }
      credit_balance: {
        Row: {
          balance: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_pricing: {
        Row: {
          active: boolean
          billing_unit: string
          category: string
          created_at: string
          customer_price_cents: number
          description: string | null
          feature_key: string
          id: string
          internal_cost_cents: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_unit?: string
          category: string
          created_at?: string
          customer_price_cents?: number
          description?: string | null
          feature_key: string
          id?: string
          internal_cost_cents?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_unit?: string
          category?: string
          created_at?: string
          customer_price_cents?: number
          description?: string | null
          feature_key?: string
          id?: string
          internal_cost_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          bundle_id: string | null
          created_at: string
          description: string | null
          feature: string | null
          id: string
          stripe_event_id: string | null
          stripe_payment_intent: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["credit_tx_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          bundle_id?: string | null
          created_at?: string
          description?: string | null
          feature?: string | null
          id?: string
          stripe_event_id?: string | null
          stripe_payment_intent?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["credit_tx_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          bundle_id?: string | null
          created_at?: string
          description?: string | null
          feature?: string | null
          id?: string
          stripe_event_id?: string | null
          stripe_payment_intent?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["credit_tx_type"]
        }
        Relationships: []
      }
      decay_profiles: {
        Row: {
          created_at: string
          day_1: number | null
          day_1_weight: number
          day_30: number | null
          day_30_weight: number
          day_7: number | null
          day_7_weight: number
          day_90: number | null
          day_90_weight: number
          id: string
          is_default: boolean
          key: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          day_1?: number | null
          day_1_weight?: number
          day_30?: number | null
          day_30_weight?: number
          day_7?: number | null
          day_7_weight?: number
          day_90?: number | null
          day_90_weight?: number
          id?: string
          is_default?: boolean
          key: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          day_1?: number | null
          day_1_weight?: number
          day_30?: number | null
          day_30_weight?: number
          day_7?: number | null
          day_7_weight?: number
          day_90?: number | null
          day_90_weight?: number
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      demo_instances: {
        Row: {
          analysis_result: Json | null
          brand_signals: Json | null
          content_en: Json | null
          content_nl: Json | null
          created_at: string
          created_by: string | null
          demo_mode: string
          expires_at: string | null
          favicon_url: string | null
          generated_blueprint: Json | null
          generated_by: string | null
          generated_pages: Json | null
          generated_preview: Json | null
          generated_scenarios: Json | null
          generated_theme_preset: Json | null
          generation_ms: number | null
          id: string
          logo_url: string | null
          mirrored_html: string | null
          page_images: Json | null
          primary_color: string
          scenario_slots: Json | null
          scenarios: Json
          secondary_color: string
          share_token: string | null
          site_category: string
          site_description: string
          site_name: string
          site_title: string | null
          source_url: string
          status: string
          tenant_id: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          analysis_result?: Json | null
          brand_signals?: Json | null
          content_en?: Json | null
          content_nl?: Json | null
          created_at?: string
          created_by?: string | null
          demo_mode?: string
          expires_at?: string | null
          favicon_url?: string | null
          generated_blueprint?: Json | null
          generated_by?: string | null
          generated_pages?: Json | null
          generated_preview?: Json | null
          generated_scenarios?: Json | null
          generated_theme_preset?: Json | null
          generation_ms?: number | null
          id?: string
          logo_url?: string | null
          mirrored_html?: string | null
          page_images?: Json | null
          primary_color?: string
          scenario_slots?: Json | null
          scenarios?: Json
          secondary_color?: string
          share_token?: string | null
          site_category?: string
          site_description?: string
          site_name?: string
          site_title?: string | null
          source_url: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          analysis_result?: Json | null
          brand_signals?: Json | null
          content_en?: Json | null
          content_nl?: Json | null
          created_at?: string
          created_by?: string | null
          demo_mode?: string
          expires_at?: string | null
          favicon_url?: string | null
          generated_blueprint?: Json | null
          generated_by?: string | null
          generated_pages?: Json | null
          generated_preview?: Json | null
          generated_scenarios?: Json | null
          generated_theme_preset?: Json | null
          generation_ms?: number | null
          id?: string
          logo_url?: string | null
          mirrored_html?: string | null
          page_images?: Json | null
          primary_color?: string
          scenario_slots?: Json | null
          scenarios?: Json
          secondary_color?: string
          share_token?: string | null
          site_category?: string
          site_description?: string
          site_name?: string
          site_title?: string | null
          source_url?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      enrichment_price_cards: {
        Row: {
          active: boolean
          billing_unit: string
          created_at: string
          enrichment_type: string
          id: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_unit?: string
          created_at?: string
          enrichment_type: string
          id?: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_unit?: string
          created_at?: string
          enrichment_type?: string
          id?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_pricing: {
        Row: {
          active: boolean
          billable: boolean
          billing_unit: string
          category: string
          created_at: string
          credit_cost: number
          description: string | null
          enrichment_type: string
          id: string
          internal_cost: number | null
          label: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billable?: boolean
          billing_unit?: string
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string | null
          enrichment_type: string
          id?: string
          internal_cost?: number | null
          label: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billable?: boolean
          billing_unit?: string
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string | null
          enrichment_type?: string
          id?: string
          internal_cost?: number | null
          label?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_usage: {
        Row: {
          billable: boolean
          cache_hit: boolean
          created_at: string
          enrichment_type: string
          error_code: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          quantity: number
          request_id: string | null
          success: boolean
          tenant_id: string
          total_price_cents: number
          unit_price_cents: number
          wallet_blocked: boolean
        }
        Insert: {
          billable?: boolean
          cache_hit?: boolean
          created_at?: string
          enrichment_type: string
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          quantity?: number
          request_id?: string | null
          success?: boolean
          tenant_id: string
          total_price_cents?: number
          unit_price_cents?: number
          wallet_blocked?: boolean
        }
        Update: {
          billable?: boolean
          cache_hit?: boolean
          created_at?: string
          enrichment_type?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          quantity?: number
          request_id?: string | null
          success?: boolean
          tenant_id?: string
          total_price_cents?: number
          unit_price_cents?: number
          wallet_blocked?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          session_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          session_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          session_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_assignments: {
        Row: {
          bucket: number
          created_at: string
          experiment_id: string
          id: string
          session_id: string
          variant_key: string
        }
        Insert: {
          bucket: number
          created_at?: string
          experiment_id: string
          id?: string
          session_id: string
          variant_key: string
        }
        Update: {
          bucket?: number
          created_at?: string
          experiment_id?: string
          id?: string
          session_id?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          name: string
          slot: string
          status: string
          tenant_id: string | null
          traffic_fraction: number
          variants: Json
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id: string
          name: string
          slot: string
          status?: string
          tenant_id?: string | null
          traffic_fraction?: number
          variants: Json
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          name?: string
          slot?: string
          status?: string
          tenant_id?: string | null
          traffic_fraction?: number
          variants?: Json
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          form_key: string
          id: number
          pathname: string | null
          payload: Json
          session_id: string | null
          submitted_at: string | null
          tenant_id: string
        }
        Insert: {
          form_key: string
          id?: number
          pathname?: string | null
          payload?: Json
          session_id?: string | null
          submitted_at?: string | null
          tenant_id: string
        }
        Update: {
          form_key?: string
          id?: number
          pathname?: string | null
          payload?: Json
          session_id?: string | null
          submitted_at?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      interest_profile_tags: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          tag: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          tag: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          tag?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "interest_profile_tags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "interest_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_profiles: {
        Row: {
          created_at: string
          default_status: string
          description: string | null
          family: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          priority: number
          recommended_site_models: string[]
          tags: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_status?: string
          description?: string | null
          family?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          priority?: number
          recommended_site_models?: string[]
          tags?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_status?: string
          description?: string | null
          family?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          priority?: number
          recommended_site_models?: string[]
          tags?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string | null
          source: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          reason?: string | null
          source?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string | null
          source?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      navigation: {
        Row: {
          config: Json | null
          id: string
          tenant_id: string | null
        }
        Insert: {
          config?: Json | null
          id?: string
          tenant_id?: string | null
        }
        Update: {
          config?: Json | null
          id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      page_templates: {
        Row: {
          active: boolean | null
          key: string
          label: string | null
          sections_config: Json | null
          site_type_key: string | null
          theme_key: string | null
        }
        Insert: {
          active?: boolean | null
          key: string
          label?: string | null
          sections_config?: Json | null
          site_type_key?: string | null
          theme_key?: string | null
        }
        Update: {
          active?: boolean | null
          key?: string
          label?: string | null
          sections_config?: Json | null
          site_type_key?: string | null
          theme_key?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          content_blocks: Json
          context_slots: Json
          created_at: string | null
          id: string
          is_homepage: boolean | null
          page: Json | null
          page_type: string | null
          seo: Json
          slug: string
          status: string | null
          template_key: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content_blocks?: Json
          context_slots?: Json
          created_at?: string | null
          id: string
          is_homepage?: boolean | null
          page?: Json | null
          page_type?: string | null
          seo?: Json
          slug: string
          status?: string | null
          template_key?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content_blocks?: Json
          context_slots?: Json
          created_at?: string | null
          id?: string
          is_homepage?: boolean | null
          page?: Json | null
          page_type?: string | null
          seo?: Json
          slug?: string
          status?: string | null
          template_key?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pending_trial_signups: {
        Row: {
          company: string
          completed_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string
          plan_id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          company: string
          completed_at?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          password_hash: string
          plan_id: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          company?: string
          completed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string
          plan_id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      personalization_sessions: {
        Row: {
          created_at: string
          month_key: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          month_key: string
          session_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          month_key?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      plan_experiment_assignments: {
        Row: {
          bucket: number
          created_at: string
          experiment_id: string
          id: string
          session_id: string
        }
        Insert: {
          bucket: number
          created_at?: string
          experiment_id: string
          id?: string
          session_id: string
        }
        Update: {
          bucket?: number
          created_at?: string
          experiment_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_experiment_assignments_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_experiments: {
        Row: {
          challenger_plan: Json
          created_at: string
          ended_at: string | null
          id: string
          name: string
          rule_id: string
          status: string
          tenant_id: string
          traffic_fraction: number
        }
        Insert: {
          challenger_plan?: Json
          created_at?: string
          ended_at?: string | null
          id: string
          name: string
          rule_id: string
          status?: string
          tenant_id?: string
          traffic_fraction?: number
        }
        Update: {
          challenger_plan?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          name?: string
          rule_id?: string
          status?: string
          tenant_id?: string
          traffic_fraction?: number
        }
        Relationships: []
      }
      platform_backups: {
        Row: {
          created_at: string
          created_by: string
          data: Json
          error: string | null
          id: string
          label: string | null
          restored_from_version: number | null
          row_count: number
          status: string
          tables: string[]
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          data?: Json
          error?: string | null
          id?: string
          label?: string | null
          restored_from_version?: number | null
          row_count?: number
          status?: string
          tables?: string[]
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: Json
          error?: string | null
          id?: string
          label?: string | null
          restored_from_version?: number | null
          row_count?: number
          status?: string
          tables?: string[]
          version?: number
        }
        Relationships: []
      }
      platform_cms_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          variant_key: string
          variant_type: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          variant_key: string
          variant_type: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          variant_key?: string
          variant_type?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          count: number
          created_at: string
          identifier: string
          window_key: string
        }
        Insert: {
          count?: number
          created_at?: string
          identifier: string
          window_key: string
        }
        Update: {
          count?: number
          created_at?: string
          identifier?: string
          window_key?: string
        }
        Relationships: []
      }
      rules_config: {
        Row: {
          config: Json
          key: string
          updated_at: string
        }
        Insert: {
          config: Json
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      runtime_rules: {
        Row: {
          condition_tree: Json
          created_at: string | null
          id: string
          is_enabled: boolean | null
          name: string
          priority: number | null
          slot: string
          target_variant_key: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          condition_tree: Json
          created_at?: string | null
          id: string
          is_enabled?: boolean | null
          name: string
          priority?: number | null
          slot: string
          target_variant_key: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          condition_tree?: Json
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          priority?: number | null
          slot?: string
          target_variant_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      served_variants: {
        Row: {
          created_at: string
          cta_key: string
          hero_key: string
          id: string
          proof_key: string
          reason: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          cta_key: string
          hero_key: string
          id?: string
          proof_key: string
          reason: string
          session_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          cta_key?: string
          hero_key?: string
          id?: string
          proof_key?: string
          reason?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "served_variants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_credit_balances: {
        Row: {
          balance: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          bundle_id: string | null
          created_at: string
          entry_type: string
          id: string
          note: string | null
          session_ref: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          bundle_id?: string | null
          created_at?: string
          entry_type: string
          id?: string
          note?: string | null
          session_ref?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          bundle_id?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          note?: string | null
          session_ref?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "session_credit_balances"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          device: string
          id: string
          pathname: string
          referrer: string | null
          source: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visit_type: string
        }
        Insert: {
          created_at?: string
          device: string
          id?: string
          pathname: string
          referrer?: string | null
          source: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visit_type: string
        }
        Update: {
          created_at?: string
          device?: string
          id?: string
          pathname?: string
          referrer?: string | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visit_type?: string
        }
        Relationships: []
      }
      site_blueprints: {
        Row: {
          active: boolean | null
          content_scaffold_config: Json | null
          description: string | null
          key: string
          label: string
          navigation_config: Json | null
          pages_config: Json | null
          site_type_key: string | null
          sort_order: number | null
          theme_key: string | null
        }
        Insert: {
          active?: boolean | null
          content_scaffold_config?: Json | null
          description?: string | null
          key: string
          label: string
          navigation_config?: Json | null
          pages_config?: Json | null
          site_type_key?: string | null
          sort_order?: number | null
          theme_key?: string | null
        }
        Update: {
          active?: boolean | null
          content_scaffold_config?: Json | null
          description?: string | null
          key?: string
          label?: string
          navigation_config?: Json | null
          pages_config?: Json | null
          site_type_key?: string | null
          sort_order?: number | null
          theme_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_blueprints_site_type_key_fkey"
            columns: ["site_type_key"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "site_blueprints_theme_key_fkey"
            columns: ["theme_key"]
            isOneToOne: false
            referencedRelation: "theme_presets"
            referencedColumns: ["key"]
          },
        ]
      }
      site_navigation: {
        Row: {
          created_at: string
          href: string
          id: string
          label: string
          order_index: number
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          href: string
          id?: string
          label: string
          order_index?: number
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          href?: string
          id?: string
          label?: string
          order_index?: number
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_navigation_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "site_navigation"
            referencedColumns: ["id"]
          },
        ]
      }
      site_types: {
        Row: {
          active: boolean | null
          default_interest_profiles: string[] | null
          default_page_set: Json | null
          default_rule_packs: string[] | null
          description: string | null
          key: string
          label: string
          sort_order: number | null
          supported_theme_keys: string[] | null
        }
        Insert: {
          active?: boolean | null
          default_interest_profiles?: string[] | null
          default_page_set?: Json | null
          default_rule_packs?: string[] | null
          description?: string | null
          key: string
          label: string
          sort_order?: number | null
          supported_theme_keys?: string[] | null
        }
        Update: {
          active?: boolean | null
          default_interest_profiles?: string[] | null
          default_page_set?: Json | null
          default_rule_packs?: string[] | null
          description?: string | null
          key?: string
          label?: string
          sort_order?: number | null
          supported_theme_keys?: string[] | null
        }
        Relationships: []
      }
      statamic_drafts: {
        Row: {
          created_at: string
          entry: Json
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string
          entry: Json
          expires_at: string
          token: string
        }
        Update: {
          created_at?: string
          entry?: Json
          expires_at?: string
          token?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          dunning_email_sent_at: string | null
          id: string
          payment_due_since: string | null
          pending_plan: string | null
          pending_plan_billing_cycle: string | null
          pending_plan_effective_date: string | null
          pending_plan_paid_at: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          dunning_email_sent_at?: string | null
          id?: string
          payment_due_since?: string | null
          pending_plan?: string | null
          pending_plan_billing_cycle?: string | null
          pending_plan_effective_date?: string | null
          pending_plan_paid_at?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          dunning_email_sent_at?: string | null
          id?: string
          payment_due_since?: string | null
          pending_plan?: string | null
          pending_plan_billing_cycle?: string | null
          pending_plan_effective_date?: string | null
          pending_plan_paid_at?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_assets: {
        Row: {
          alt_text: string | null
          asset_type: string
          created_at: string
          file_name: string | null
          file_size: number | null
          folder: string | null
          height: number | null
          id: string
          mime_type: string | null
          provider_bucket: string | null
          public_url: string | null
          sanity_asset_id: string | null
          storage_backend: string | null
          storage_path: string | null
          tags: Json | null
          tenant_id: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          asset_type?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          folder?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          provider_bucket?: string | null
          public_url?: string | null
          sanity_asset_id?: string | null
          storage_backend?: string | null
          storage_path?: string | null
          tags?: Json | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          asset_type?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          folder?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          provider_bucket?: string | null
          public_url?: string | null
          sanity_asset_id?: string | null
          storage_backend?: string | null
          storage_path?: string | null
          tags?: Json | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      tenant_domains: {
        Row: {
          created_at: string | null
          domain: string
          hostname: string | null
          id: number
          is_primary: boolean | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          vercel_domain_id: string | null
          vercel_verification: Json | null
          verification_method: string | null
          verification_value: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          hostname?: string | null
          id?: number
          is_primary?: boolean | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          vercel_domain_id?: string | null
          vercel_verification?: Json | null
          verification_method?: string | null
          verification_value?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          hostname?: string | null
          id?: number
          is_primary?: boolean | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          vercel_domain_id?: string | null
          vercel_verification?: Json | null
          verification_method?: string | null
          verification_value?: string | null
        }
        Relationships: []
      }
      tenant_dunning_settings: {
        Row: {
          billing_email: string | null
          created_at: string
          email_body: string
          email_subject: string
          payment_link: string | null
          quarantine_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          email_body?: string
          email_subject?: string
          payment_link?: string | null
          quarantine_days?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          email_body?: string
          email_subject?: string
          payment_link?: string | null
          quarantine_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_dunning_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_settings"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_email_transport: {
        Row: {
          config: Json
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_form_overrides: {
        Row: {
          form_key: string
          id: string
          overrides: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          form_key: string
          id?: string
          overrides?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          form_key?: string
          id?: string
          overrides?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_form_settings: {
        Row: {
          id: string
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_host_resolution_cache: {
        Row: {
          host: string
          settings: Json
          updated_at: string
        }
        Insert: {
          host: string
          settings: Json
          updated_at?: string
        }
        Update: {
          host?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tenant_interest_profiles: {
        Row: {
          created_at: string
          enabled: boolean
          profile_key: string
          tenant_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          profile_key: string
          tenant_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          profile_key?: string
          tenant_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      tenant_pipeline_stages: {
        Row: {
          enabled: boolean
          position: number
          stage_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          position?: number
          stage_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          position?: number
          stage_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_search_settings: {
        Row: {
          config: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          additional_domains: string[] | null
          ai_api_key: string | null
          ai_confidence_threshold: number | null
          ai_mode: string | null
          ai_model: string | null
          ai_provider: string | null
          cms_dataset: string | null
          cms_project_id: string | null
          cms_provider: string | null
          cms_write_token: string | null
          created_at: string | null
          id: string
          is_active_override: boolean | null
          name: string | null
          package: string | null
          primary_color: string | null
          primary_domain: string | null
          primary_font: string | null
          radius_card: string | null
          radius_interactive: string | null
          radius_popover: string | null
          settings: Json | null
          slug: string | null
          tenant_id: string | null
          theme: string | null
          updated_at: string | null
        }
        Insert: {
          additional_domains?: string[] | null
          ai_api_key?: string | null
          ai_confidence_threshold?: number | null
          ai_mode?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          cms_dataset?: string | null
          cms_project_id?: string | null
          cms_provider?: string | null
          cms_write_token?: string | null
          created_at?: string | null
          id: string
          is_active_override?: boolean | null
          name?: string | null
          package?: string | null
          primary_color?: string | null
          primary_domain?: string | null
          primary_font?: string | null
          radius_card?: string | null
          radius_interactive?: string | null
          radius_popover?: string | null
          settings?: Json | null
          slug?: string | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_domains?: string[] | null
          ai_api_key?: string | null
          ai_confidence_threshold?: number | null
          ai_mode?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          cms_dataset?: string | null
          cms_project_id?: string | null
          cms_provider?: string | null
          cms_write_token?: string | null
          created_at?: string | null
          id?: string
          is_active_override?: boolean | null
          name?: string | null
          package?: string | null
          primary_color?: string | null
          primary_domain?: string | null
          primary_font?: string | null
          radius_card?: string | null
          radius_interactive?: string | null
          radius_popover?: string | null
          settings?: Json | null
          slug?: string | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_site_settings_cache: {
        Row: {
          locale: string
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          locale: string
          settings: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          locale?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_site_setup: {
        Row: {
          company_name: string | null
          created_at: string | null
          description: string | null
          id: string
          initialized_at: string | null
          primary_cta_label: string | null
          primary_cta_url: string | null
          reference_url: string | null
          setup_status: string | null
          target_audience: string | null
          tenant_id: string
          tone_of_voice: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          initialized_at?: string | null
          primary_cta_label?: string | null
          primary_cta_url?: string | null
          reference_url?: string | null
          setup_status?: string | null
          target_audience?: string | null
          tenant_id: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          initialized_at?: string | null
          primary_cta_label?: string | null
          primary_cta_url?: string | null
          reference_url?: string | null
          setup_status?: string | null
          target_audience?: string | null
          tenant_id?: string
          tone_of_voice?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_sites: {
        Row: {
          blueprint_key: string | null
          created_at: string | null
          id: string
          site_type_key: string | null
          status: string | null
          tenant_id: string
          theme_key: string | null
          updated_at: string | null
        }
        Insert: {
          blueprint_key?: string | null
          created_at?: string | null
          id?: string
          site_type_key?: string | null
          status?: string | null
          tenant_id: string
          theme_key?: string | null
          updated_at?: string | null
        }
        Update: {
          blueprint_key?: string | null
          created_at?: string | null
          id?: string
          site_type_key?: string | null
          status?: string | null
          tenant_id?: string
          theme_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_wallets: {
        Row: {
          auto_reload_amount_cents: number
          auto_reload_enabled: boolean
          auto_reload_month_reset_at: string | null
          auto_reload_monthly_cap_cents: number | null
          auto_reload_monthly_limit_cents: number
          auto_reload_spent_this_month_cents: number
          auto_reload_trigger_cents: number
          balance: number | null
          balance_cents: number
          created_at: string
          currency: string
          fallback_mode: string
          id: string
          low_balance_threshold_cents: number
          monthly_credit_cap_cents: number
          notification_email: string | null
          notification_phone: string | null
          notify_email: boolean
          notify_sms: boolean
          purchased_credits: number
          status: string
          stripe_customer_id: string | null
          stripe_default_payment_method_id: string | null
          stripe_payment_method_id: string | null
          stripe_test_customer_id: string | null
          stripe_test_payment_method_id: string | null
          subscription_credits: number
          tenant_id: string
          test_mode: Database["public"]["Enums"]["wallet_test_mode"]
          updated_at: string
        }
        Insert: {
          auto_reload_amount_cents?: number
          auto_reload_enabled?: boolean
          auto_reload_month_reset_at?: string | null
          auto_reload_monthly_cap_cents?: number | null
          auto_reload_monthly_limit_cents?: number
          auto_reload_spent_this_month_cents?: number
          auto_reload_trigger_cents?: number
          balance?: number | null
          balance_cents?: number
          created_at?: string
          currency?: string
          fallback_mode?: string
          id?: string
          low_balance_threshold_cents?: number
          monthly_credit_cap_cents?: number
          notification_email?: string | null
          notification_phone?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          purchased_credits?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_test_customer_id?: string | null
          stripe_test_payment_method_id?: string | null
          subscription_credits?: number
          tenant_id: string
          test_mode?: Database["public"]["Enums"]["wallet_test_mode"]
          updated_at?: string
        }
        Update: {
          auto_reload_amount_cents?: number
          auto_reload_enabled?: boolean
          auto_reload_month_reset_at?: string | null
          auto_reload_monthly_cap_cents?: number | null
          auto_reload_monthly_limit_cents?: number
          auto_reload_spent_this_month_cents?: number
          auto_reload_trigger_cents?: number
          balance?: number | null
          balance_cents?: number
          created_at?: string
          currency?: string
          fallback_mode?: string
          id?: string
          low_balance_threshold_cents?: number
          monthly_credit_cap_cents?: number
          notification_email?: string | null
          notification_phone?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          purchased_credits?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_test_customer_id?: string | null
          stripe_test_payment_method_id?: string | null
          subscription_credits?: number
          tenant_id?: string
          test_mode?: Database["public"]["Enums"]["wallet_test_mode"]
          updated_at?: string
        }
        Relationships: []
      }
      theme_presets: {
        Row: {
          active: boolean | null
          description: string | null
          family: string | null
          key: string
          label: string
          layout_config: Json | null
          preview_image: string | null
          sort_order: number | null
          token_config: Json | null
          typography_config: Json | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          family?: string | null
          key: string
          label: string
          layout_config?: Json | null
          preview_image?: string | null
          sort_order?: number | null
          token_config?: Json | null
          typography_config?: Json | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          family?: string | null
          key?: string
          label?: string
          layout_config?: Json | null
          preview_image?: string | null
          sort_order?: number | null
          token_config?: Json | null
          typography_config?: Json | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          billable: boolean
          cache_hit: boolean
          category: string | null
          created_at: string
          credits_cost: number
          credits_used: number | null
          error_code: string | null
          event_type: Database["public"]["Enums"]["usage_event_type"]
          feature_key: string | null
          id: string
          idempotency_key: string | null
          internal_cost_cents: number | null
          metadata: Json
          price: number | null
          quantity: number
          request_id: string | null
          session_id: string | null
          simulated: boolean
          success: boolean
          tenant_id: string
        }
        Insert: {
          billable?: boolean
          cache_hit?: boolean
          category?: string | null
          created_at?: string
          credits_cost?: number
          credits_used?: number | null
          error_code?: string | null
          event_type: Database["public"]["Enums"]["usage_event_type"]
          feature_key?: string | null
          id?: string
          idempotency_key?: string | null
          internal_cost_cents?: number | null
          metadata?: Json
          price?: number | null
          quantity?: number
          request_id?: string | null
          session_id?: string | null
          simulated?: boolean
          success?: boolean
          tenant_id: string
        }
        Update: {
          billable?: boolean
          cache_hit?: boolean
          category?: string | null
          created_at?: string
          credits_cost?: number
          credits_used?: number | null
          error_code?: string | null
          event_type?: Database["public"]["Enums"]["usage_event_type"]
          feature_key?: string | null
          id?: string
          idempotency_key?: string | null
          internal_cost_cents?: number | null
          metadata?: Json
          price?: number | null
          quantity?: number
          request_id?: string | null
          session_id?: string | null
          simulated?: boolean
          success?: boolean
          tenant_id?: string
        }
        Relationships: []
      }
      visitor_behavior_state: {
        Row: {
          burst_penalty: number
          cta_click_count: number
          deduplicated_event_count: number
          download_count: number
          engagement_score: number
          first_seen_at: string | null
          form_start_count: number
          form_submit_count: number
          friction_score: number
          funnel_stage: string
          funnel_stage_confidence: number
          has_clicked_cta: boolean
          has_downloaded_resource: boolean
          has_started_form: boolean
          has_submitted_form: boolean
          has_viewed_case_study: boolean
          has_visited_about: boolean
          has_visited_cases: boolean
          has_visited_contact: boolean
          has_visited_pricing: boolean
          id: string
          intent_freshness: number
          intent_score: number
          last_campaign: string | null
          last_medium: string | null
          last_seen_at: string | null
          last_source: string | null
          long_term_affinity_score: number
          matched_sequences: Json
          page_view_count: number
          recency_score: number
          repeat_session_bonus: number
          sequence_confidence_contribution: number | null
          sequence_matched_at: string | null
          sequence_score: number
          session_count: number
          session_id: string
          short_term_intent_score: number
          signal_diversity_score: number
          tenant_id: string
          unique_signal_count: number
          updated_at: string
          viewed_categories: string[]
          viewed_keywords: string[]
          visited_page_categories: Json
          visited_page_keywords: Json
          visitor_id: string
        }
        Insert: {
          burst_penalty?: number
          cta_click_count?: number
          deduplicated_event_count?: number
          download_count?: number
          engagement_score?: number
          first_seen_at?: string | null
          form_start_count?: number
          form_submit_count?: number
          friction_score?: number
          funnel_stage?: string
          funnel_stage_confidence?: number
          has_clicked_cta?: boolean
          has_downloaded_resource?: boolean
          has_started_form?: boolean
          has_submitted_form?: boolean
          has_viewed_case_study?: boolean
          has_visited_about?: boolean
          has_visited_cases?: boolean
          has_visited_contact?: boolean
          has_visited_pricing?: boolean
          id?: string
          intent_freshness?: number
          intent_score?: number
          last_campaign?: string | null
          last_medium?: string | null
          last_seen_at?: string | null
          last_source?: string | null
          long_term_affinity_score?: number
          matched_sequences?: Json
          page_view_count?: number
          recency_score?: number
          repeat_session_bonus?: number
          sequence_confidence_contribution?: number | null
          sequence_matched_at?: string | null
          sequence_score?: number
          session_count?: number
          session_id?: string
          short_term_intent_score?: number
          signal_diversity_score?: number
          tenant_id: string
          unique_signal_count?: number
          updated_at?: string
          viewed_categories?: string[]
          viewed_keywords?: string[]
          visited_page_categories?: Json
          visited_page_keywords?: Json
          visitor_id: string
        }
        Update: {
          burst_penalty?: number
          cta_click_count?: number
          deduplicated_event_count?: number
          download_count?: number
          engagement_score?: number
          first_seen_at?: string | null
          form_start_count?: number
          form_submit_count?: number
          friction_score?: number
          funnel_stage?: string
          funnel_stage_confidence?: number
          has_clicked_cta?: boolean
          has_downloaded_resource?: boolean
          has_started_form?: boolean
          has_submitted_form?: boolean
          has_viewed_case_study?: boolean
          has_visited_about?: boolean
          has_visited_cases?: boolean
          has_visited_contact?: boolean
          has_visited_pricing?: boolean
          id?: string
          intent_freshness?: number
          intent_score?: number
          last_campaign?: string | null
          last_medium?: string | null
          last_seen_at?: string | null
          last_source?: string | null
          long_term_affinity_score?: number
          matched_sequences?: Json
          page_view_count?: number
          recency_score?: number
          repeat_session_bonus?: number
          sequence_confidence_contribution?: number | null
          sequence_matched_at?: string | null
          sequence_score?: number
          session_count?: number
          session_id?: string
          short_term_intent_score?: number
          signal_diversity_score?: number
          tenant_id?: string
          unique_signal_count?: number
          updated_at?: string
          viewed_categories?: string[]
          viewed_keywords?: string[]
          visited_page_categories?: Json
          visited_page_keywords?: Json
          visitor_id?: string
        }
        Relationships: []
      }
      visitor_events: {
        Row: {
          id: string
          occurred_at: string
          path: string | null
          referrer: string | null
          tenant_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_key: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          path?: string | null
          referrer?: string | null
          tenant_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_key: string
        }
        Update: {
          id?: string
          occurred_at?: string
          path?: string | null
          referrer?: string | null
          tenant_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_key?: string
        }
        Relationships: []
      }
      visitor_history: {
        Row: {
          cta_clicks: number | null
          first_seen_at: string | null
          id: number
          last_cta_key: string | null
          last_hero_key: string | null
          last_seen_at: string | null
          metadata: Json | null
          page_views: number | null
          session_id: string
          tenant_id: string
        }
        Insert: {
          cta_clicks?: number | null
          first_seen_at?: string | null
          id?: number
          last_cta_key?: string | null
          last_hero_key?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          page_views?: number | null
          session_id: string
          tenant_id: string
        }
        Update: {
          cta_clicks?: number | null
          first_seen_at?: string | null
          id?: number
          last_cta_key?: string | null
          last_hero_key?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          page_views?: number | null
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      visitor_journey_events: {
        Row: {
          campaign: string | null
          created_at: string
          event_id: string
          event_type: string
          event_value: string | null
          id: string
          medium: string | null
          metadata: Json
          occurred_at: string
          page_category: string | null
          page_keywords: Json
          page_path: string | null
          session_id: string | null
          source: string | null
          tenant_id: string
          visitor_id: string | null
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          event_id?: string
          event_type: string
          event_value?: string | null
          id?: string
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          page_category?: string | null
          page_keywords?: Json
          page_path?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id: string
          visitor_id?: string | null
        }
        Update: {
          campaign?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          event_value?: string | null
          id?: string
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          page_category?: string | null
          page_keywords?: Json
          page_path?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      visitor_profiles: {
        Row: {
          abm_lead_id: string | null
          company_domain: string | null
          company_industry: string | null
          company_name: string | null
          company_size: string | null
          consent_state: string
          converted_at: string | null
          created_at: string
          crm_visit_logged_at: string | null
          expires_at: string | null
          fbclid: string | null
          firmographics_at: string | null
          first_channel: string | null
          first_seen_at: string
          funnel_stage: string | null
          gclid: string | null
          geo_country: string | null
          geo_region: string | null
          hubspot_company_id: string | null
          hubspot_contact_id: string | null
          id: string
          identity_level: string
          intent_score: number | null
          interests: Json
          last_seen_at: string
          msclkid: string | null
          personalization_group: string | null
          pii: Json | null
          referrer_domain: string | null
          segment_ids: string[] | null
          status: string
          tenant_id: string
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visit_count: number
          visitor_key: string
        }
        Insert: {
          abm_lead_id?: string | null
          company_domain?: string | null
          company_industry?: string | null
          company_name?: string | null
          company_size?: string | null
          consent_state?: string
          converted_at?: string | null
          created_at?: string
          crm_visit_logged_at?: string | null
          expires_at?: string | null
          fbclid?: string | null
          firmographics_at?: string | null
          first_channel?: string | null
          first_seen_at?: string
          funnel_stage?: string | null
          gclid?: string | null
          geo_country?: string | null
          geo_region?: string | null
          hubspot_company_id?: string | null
          hubspot_contact_id?: string | null
          id?: string
          identity_level?: string
          intent_score?: number | null
          interests?: Json
          last_seen_at?: string
          msclkid?: string | null
          personalization_group?: string | null
          pii?: Json | null
          referrer_domain?: string | null
          segment_ids?: string[] | null
          status?: string
          tenant_id: string
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visit_count?: number
          visitor_key: string
        }
        Update: {
          abm_lead_id?: string | null
          company_domain?: string | null
          company_industry?: string | null
          company_name?: string | null
          company_size?: string | null
          consent_state?: string
          converted_at?: string | null
          created_at?: string
          crm_visit_logged_at?: string | null
          expires_at?: string | null
          fbclid?: string | null
          firmographics_at?: string | null
          first_channel?: string | null
          first_seen_at?: string
          funnel_stage?: string | null
          gclid?: string | null
          geo_country?: string | null
          geo_region?: string | null
          hubspot_company_id?: string | null
          hubspot_contact_id?: string | null
          id?: string
          identity_level?: string
          intent_score?: number | null
          interests?: Json
          last_seen_at?: string
          msclkid?: string | null
          personalization_group?: string | null
          pii?: Json | null
          referrer_domain?: string | null
          segment_ids?: string[] | null
          status?: string
          tenant_id?: string
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visit_count?: number
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_profiles_abm_lead_id_fkey"
            columns: ["abm_lead_id"]
            isOneToOne: false
            referencedRelation: "abm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number | null
          amount_cents: number
          balance_after: number | null
          balance_after_cents: number | null
          category: string | null
          created_at: string
          entry_type: string
          id: string
          note: string | null
          reference_id: string | null
          reference_type: string | null
          simulated: boolean
          tenant_id: string
          wallet_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_cents: number
          balance_after?: number | null
          balance_after_cents?: number | null
          category?: string | null
          created_at?: string
          entry_type: string
          id?: string
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          simulated?: boolean
          tenant_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_cents?: number
          balance_after?: number | null
          balance_after_cents?: number | null
          category?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          simulated?: boolean
          tenant_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "tenant_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_reload_attempts: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          reload_amount_cents: number
          simulated: boolean
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          trigger_balance_cents: number | null
          updated_at: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          reload_amount_cents: number
          simulated?: boolean
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id: string
          trigger_balance_cents?: number | null
          updated_at?: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          reload_amount_cents?: number
          simulated?: boolean
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          trigger_balance_cents?: number | null
          updated_at?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_reload_attempts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "tenant_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_webhook_events: {
        Row: {
          action: string | null
          error: string | null
          event_type: string
          handled: boolean
          id: string
          livemode: boolean
          received_at: string
          stripe_event_id: string
          tenant_id: string | null
        }
        Insert: {
          action?: string | null
          error?: string | null
          event_type: string
          handled?: boolean
          id?: string
          livemode?: boolean
          received_at?: string
          stripe_event_id: string
          tenant_id?: string | null
        }
        Update: {
          action?: string | null
          error?: string | null
          event_type?: string
          handled?: boolean
          id?: string
          livemode?: boolean
          received_at?: string
          stripe_event_id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event: string
          id: string
          ok: boolean
          payload: Json | null
          status_code: number | null
          target_url: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event: string
          id?: string
          ok?: boolean
          payload?: Json | null
          status_code?: number | null
          target_url: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          ok?: boolean
          payload?: Json | null
          status_code?: number | null
          target_url?: string
          tenant_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      enrichment_usage_summary: {
        Row: {
          blocked_count: number | null
          cache_hit_count: number | null
          call_count: number | null
          enrichment_type: string | null
          failure_count: number | null
          fresh_call_count: number | null
          success_count: number | null
          tenant_id: string | null
          total_price_cents: number | null
          usage_date: string | null
        }
        Relationships: []
      }
      usage_events_summary: {
        Row: {
          cache_hit_count: number | null
          call_count: number | null
          event_date: string | null
          event_type: Database["public"]["Enums"]["usage_event_type"] | null
          failure_count: number | null
          fresh_call_count: number | null
          success_count: number | null
          tenant_id: string | null
          total_credits: number | null
        }
        Relationships: []
      }
      usage_summary: {
        Row: {
          billable_calls: number | null
          cache_hit_calls: number | null
          category: string | null
          feature_key: string | null
          internal_cost_cents_sum: number | null
          period_key: string | null
          tenant_id: string | null
          total_calls: number | null
          total_cost_cents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_session_credits: {
        Args: {
          p_amount: number
          p_bundle_id?: string
          p_note?: string
          p_stripe_id?: string
          p_tenant_id: string
        }
        Returns: number
      }
      cleanup_rate_limit_counters: { Args: never; Returns: number }
      credit_wallet: {
        Args: {
          p_amount_cents: number
          p_credit_type?: string
          p_entry_type?: string
          p_note?: string
          p_reference?: string
          p_tenant_id: string
        }
        Returns: {
          balance_after_cents: number
          success: boolean
        }[]
      }
      debit_wallet:
        | {
            Args: {
              p_amount_cents: number
              p_category: string
              p_entry_type: string
              p_note?: string
              p_reference_id?: string
              p_reference_type?: string
              p_tenant_id: string
            }
            Returns: {
              debited: boolean
              new_balance_cents: number
              tenant_id: string
              wallet_id: string
              wallet_status: string
            }[]
          }
        | {
            Args: {
              p_amount_cents: number
              p_note?: string
              p_reference?: string
              p_tenant_id: string
            }
            Returns: {
              balance_after_cents: number
              success: boolean
            }[]
          }
        | {
            Args: {
              p_amount_cents: number
              p_note?: string
              p_reference_id?: string
              p_reference_type?: string
              p_tenant_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_category?: string
              p_credit_cost: number
              p_note?: string
              p_reference_id?: string
              p_reference_type?: string
              p_tenant_id: string
            }
            Returns: number
          }
      decrement_credit_balance:
        | { Args: { p_amount: number; p_tenant_id: string }; Returns: number }
        | { Args: { p_amount: number; p_tenant_id: string }; Returns: number }
      deduct_session_credit: {
        Args: { p_session_id?: string; p_tenant_id: string }
        Returns: boolean
      }
      ensure_wallet: { Args: { p_tenant_id: string }; Returns: undefined }
      get_analytics_daily: {
        Args: { p_days?: number; p_tenant_id: string }
        Returns: {
          cta_clicks: number
          day: string
          form_submits: number
          sessions: number
        }[]
      }
      get_analytics_funnel: {
        Args: { p_days?: number; p_tenant_id: string }
        Returns: {
          pct_of_top: number
          session_count: number
          stage: string
        }[]
      }
      get_analytics_variants: {
        Args: { p_days?: number; p_tenant_id: string }
        Returns: {
          cta_clicks: number
          ctr: number
          form_submits: number
          impressions: number
          variant_key: string
        }[]
      }
      get_wallet_breakdown: {
        Args: { p_period_key?: string; p_tenant_id: string }
        Returns: {
          blocked_count: number
          cache_hit_count: number
          call_count: number
          enrichment_type: string
          failure_count: number
          fresh_call_count: number
          success_count: number
          total_price_cents: number
        }[]
      }
      get_wallet_ledger: {
        Args: { p_limit?: number; p_offset?: number; p_tenant_id: string }
        Returns: {
          amount: number
          amount_cents: number
          balance_after: number
          balance_after_cents: number
          category: string
          created_at: string
          entry_type: string
          id: string
          note: string
          reference_id: string
          reference_type: string
          simulated: boolean
          tenant_id: string
        }[]
      }
      get_wallet_state: {
        Args: { p_tenant_id: string }
        Returns: {
          auto_reload_amount_cents: number
          auto_reload_enabled: boolean
          auto_reload_month_reset_at: string
          auto_reload_monthly_limit_cents: number
          auto_reload_spent_this_month_cents: number
          auto_reload_trigger_cents: number
          balance: number
          balance_cents: number
          created_at: string
          currency: string
          fallback_mode: string
          has_payment_method: boolean
          is_low_balance: boolean
          low_balance_threshold_cents: number
          monthly_credit_cap_cents: number
          notification_email: string
          notification_phone: string
          notify_email: boolean
          notify_sms: boolean
          period_end: string
          period_spend_cents: number
          period_start: string
          spend_this_month_cents: number
          spend_today_cents: number
          status: string
          stripe_payment_method_id: string
          stripe_test_customer_id: string
          stripe_test_payment_method_id: string
          tenant_id: string
          test_mode: string
          updated_at: string
        }[]
      }
      increment_credit_balance:
        | { Args: { p_amount: number; p_tenant_id: string }; Returns: number }
        | { Args: { p_amount: number; p_tenant_id: string }; Returns: number }
      increment_rate_limit: {
        Args: { p_identifier: string; p_window_key: string }
        Returns: number
      }
      process_wallet_reload_failure: {
        Args: {
          p_attempt_id: string
          p_failure_reason?: string
          p_new_status: Database["public"]["Enums"]["reload_attempt_status"]
          p_stripe_payment_intent_id?: string
        }
        Returns: boolean
      }
      process_wallet_reload_success: {
        Args: { p_attempt_id: string; p_stripe_payment_intent_id?: string }
        Returns: number
      }
      reset_subscription_credits: {
        Args: {
          p_new_amount: number
          p_note?: string
          p_reference?: string
          p_tenant_id: string
        }
        Returns: {
          balance_after_cents: number
          new_subscription: number
          old_subscription: number
          success: boolean
        }[]
      }
      set_tenant_active_override: {
        Args: { p_tenant_id: string; p_value: boolean }
        Returns: undefined
      }
      sim_credit_wallet: {
        Args: { p_amount_cents: number; p_note?: string; p_tenant_id: string }
        Returns: number
      }
      sim_debit_wallet:
        | {
            Args: {
              p_amount_cents: number
              p_note?: string
              p_tenant_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_amount_cents: number
              p_category?: string
              p_note?: string
              p_reference_id?: string
              p_reference_type?: string
              p_tenant_id: string
            }
            Returns: number
          }
      sim_set_wallet_balance: {
        Args: { p_balance_cents: number; p_note?: string; p_tenant_id: string }
        Returns: number
      }
      sim_trigger_reload_failure: {
        Args: {
          p_failure_reason?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      sim_trigger_reload_success: {
        Args: { p_amount_cents?: number; p_tenant_id: string }
        Returns: number
      }
    }
    Enums: {
      credit_tx_type: "purchase" | "deduction" | "grant" | "refund" | "expiry"
      reload_attempt_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "action_required"
        | "cancelled"
      usage_event_type:
        | "leadinfo_lookup"
        | "ip_enrich"
        | "weather_enrich"
        | "intent_enrich"
        | "crm_lookup"
        | "reverse_geocode"
        | "ga4_history"
        | "company_lookup"
      wallet_entry_type:
        | "top_up_manual"
        | "top_up_auto_reload"
        | "top_up_refund"
        | "enrichment_debit"
        | "manual_adjustment"
        | "failed_reload"
        | "sim_top_up"
        | "sim_debit"
        | "sim_auto_reload"
        | "sim_failed_reload"
      wallet_status: "active" | "suspended" | "frozen"
      wallet_test_mode: "live" | "test_simulated"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      credit_tx_type: ["purchase", "deduction", "grant", "refund", "expiry"],
      reload_attempt_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "action_required",
        "cancelled",
      ],
      usage_event_type: [
        "leadinfo_lookup",
        "ip_enrich",
        "weather_enrich",
        "intent_enrich",
        "crm_lookup",
        "reverse_geocode",
        "ga4_history",
        "company_lookup",
      ],
      wallet_entry_type: [
        "top_up_manual",
        "top_up_auto_reload",
        "top_up_refund",
        "enrichment_debit",
        "manual_adjustment",
        "failed_reload",
        "sim_top_up",
        "sim_debit",
        "sim_auto_reload",
        "sim_failed_reload",
      ],
      wallet_status: ["active", "suspended", "frozen"],
      wallet_test_mode: ["live", "test_simulated"],
    },
  },
} as const
