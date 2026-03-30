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
      accounting_counters: {
        Row: {
          fiscal_year: number
          id: string
          last_fee_statement_number: number
          last_invoice_number: number
          user_id: string
        }
        Insert: {
          fiscal_year: number
          id?: string
          last_fee_statement_number?: number
          last_invoice_number?: number
          user_id: string
        }
        Update: {
          fiscal_year?: number
          id?: string
          last_fee_statement_number?: number
          last_invoice_number?: number
          user_id?: string
        }
        Relationships: []
      }
      accounting_entries: {
        Row: {
          amount_ht: number
          amount_ttc: number
          client_id: string | null
          created_at: string
          description: string | null
          entry_date: string
          entry_number: string
          entry_type: string
          fiscal_year: number
          id: string
          payment_method: string | null
          reference_id: string
          tax_amount: number
          user_id: string
        }
        Insert: {
          amount_ht?: number
          amount_ttc?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_number: string
          entry_type: string
          fiscal_year?: number
          id?: string
          payment_method?: string | null
          reference_id: string
          tax_amount?: number
          user_id: string
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_number?: string
          entry_type?: string
          fiscal_year?: number
          id?: string
          payment_method?: string | null
          reference_id?: string
          tax_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      article_reactions: {
        Row: {
          article_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_reactions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          category: string | null
          content: string | null
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          reading_time: number | null
          schema_type: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          schema_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          schema_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_opponents: {
        Row: {
          address: string | null
          case_id: string
          created_at: string
          id: string
          name: string
          party_type: string
          phone: string | null
          sort_order: number
        }
        Insert: {
          address?: string | null
          case_id: string
          created_at?: string
          id?: string
          name: string
          party_type?: string
          phone?: string | null
          sort_order?: number
        }
        Update: {
          address?: string | null
          case_id?: string
          created_at?: string
          id?: string
          name?: string
          party_type?: string
          phone?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_opponents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_procedures: {
        Row: {
          action_date: string | null
          action_type: string
          case_id: string
          conflict_log: Json | null
          created_at: string
          decision: string | null
          id: string
          is_manual: boolean
          next_session_date: string | null
          source: string
        }
        Insert: {
          action_date?: string | null
          action_type: string
          case_id: string
          conflict_log?: Json | null
          created_at?: string
          decision?: string | null
          id?: string
          is_manual?: boolean
          next_session_date?: string | null
          source?: string
        }
        Update: {
          action_date?: string | null
          action_type?: string
          case_id?: string
          conflict_log?: Json | null
          created_at?: string
          decision?: string | null
          id?: string
          is_manual?: boolean
          next_session_date?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_procedures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          case_number: string | null
          case_type: string | null
          client_id: string | null
          court: string | null
          court_level: string
          created_at: string
          description: string | null
          id: string
          last_sync_result: Json | null
          last_synced_at: string | null
          mahakim_appellate_court: string | null
          mahakim_department: string | null
          mahakim_judge: string | null
          mahakim_status: string | null
          opposing_party: string | null
          opposing_party_address: string | null
          opposing_party_phone: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_level?: string
          created_at?: string
          description?: string | null
          id?: string
          last_sync_result?: Json | null
          last_synced_at?: string | null
          mahakim_appellate_court?: string | null
          mahakim_department?: string | null
          mahakim_judge?: string | null
          mahakim_status?: string | null
          opposing_party?: string | null
          opposing_party_address?: string | null
          opposing_party_phone?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_level?: string
          created_at?: string
          description?: string | null
          id?: string
          last_sync_result?: Json | null
          last_synced_at?: string | null
          mahakim_appellate_court?: string | null
          mahakim_department?: string | null
          mahakim_judge?: string | null
          mahakim_status?: string | null
          opposing_party?: string | null
          opposing_party_address?: string | null
          opposing_party_phone?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cassation_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          ruling_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          ruling_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          ruling_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cassation_chunks_ruling_id_fkey"
            columns: ["ruling_id"]
            isOneToOne: false
            referencedRelation: "cassation_rulings"
            referencedColumns: ["id"]
          },
        ]
      }
      cassation_rulings: {
        Row: {
          chamber: string | null
          created_at: string | null
          date: string | null
          id: string
          metadata: Json | null
          parties: string | null
          ruling_number: string | null
          source: string | null
          subject: string | null
          year: number | null
        }
        Insert: {
          chamber?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          metadata?: Json | null
          parties?: string | null
          ruling_number?: string | null
          source?: string | null
          subject?: string | null
          year?: number | null
        }
        Update: {
          chamber?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          metadata?: Json | null
          parties?: string | null
          ruling_number?: string | null
          source?: string | null
          subject?: string | null
          year?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          cin: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          cin?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          cin?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          article_id: string
          content: string
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      court_sessions: {
        Row: {
          case_id: string
          court_room: string | null
          created_at: string
          gcal_event_id: string | null
          id: string
          notes: string | null
          required_action: string
          session_date: string
          session_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          court_room?: string | null
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          required_action?: string
          session_date: string
          session_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          court_room?: string | null
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          required_action?: string
          session_date?: string
          session_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          address: string | null
          addressee: string
          city: string
          court_type: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          addressee?: string
          city: string
          court_type?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          addressee?: string
          city?: string
          court_type?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_statement_cases: {
        Row: {
          case_id: string
          created_at: string
          fee_statement_id: string
          id: string
          lawyer_fees: number
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
        }
        Insert: {
          case_id: string
          created_at?: string
          fee_statement_id: string
          id?: string
          lawyer_fees?: number
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          fee_statement_id?: string
          id?: string
          lawyer_fees?: number
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_statement_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_statement_cases_fee_statement_id_fkey"
            columns: ["fee_statement_id"]
            isOneToOne: false
            referencedRelation: "fee_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_statement_items: {
        Row: {
          amount: number
          case_id: string | null
          created_at: string
          description: string
          fee_statement_id: string
          id: string
          sort_order: number
        }
        Insert: {
          amount?: number
          case_id?: string | null
          created_at?: string
          description: string
          fee_statement_id: string
          id?: string
          sort_order?: number
        }
        Update: {
          amount?: number
          case_id?: string | null
          created_at?: string
          description?: string
          fee_statement_id?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_statement_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_statement_items_fee_statement_id_fkey"
            columns: ["fee_statement_id"]
            isOneToOne: false
            referencedRelation: "fee_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_statements: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          id: string
          lawyer_fees: number
          letterhead_id: string | null
          notes: string | null
          pdf_path: string | null
          power_of_attorney_date: string | null
          signature_uuid: string
          statement_number: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          lawyer_fees?: number
          letterhead_id?: string | null
          notes?: string | null
          pdf_path?: string | null
          power_of_attorney_date?: string | null
          signature_uuid?: string
          statement_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          lawyer_fees?: number
          letterhead_id?: string | null
          notes?: string | null
          pdf_path?: string | null
          power_of_attorney_date?: string | null
          signature_uuid?: string
          statement_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_statements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_statements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_statements_letterhead_id_fkey"
            columns: ["letterhead_id"]
            isOneToOne: false
            referencedRelation: "letterheads"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          case_id: string | null
          case_number: string | null
          client_id: string | null
          client_name: string | null
          content: string | null
          court: string | null
          created_at: string
          doc_type: string
          id: string
          metadata: Json | null
          next_court: string | null
          opponent_memo: string | null
          opposing_party: string | null
          parent_id: string | null
          status: string
          step_number: number | null
          thread_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          case_number?: string | null
          client_id?: string | null
          client_name?: string | null
          content?: string | null
          court?: string | null
          created_at?: string
          doc_type: string
          id?: string
          metadata?: Json | null
          next_court?: string | null
          opponent_memo?: string | null
          opposing_party?: string | null
          parent_id?: string | null
          status?: string
          step_number?: number | null
          thread_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          case_number?: string | null
          client_id?: string | null
          client_name?: string | null
          content?: string | null
          court?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          metadata?: Json | null
          next_court?: string | null
          opponent_memo?: string | null
          opposing_party?: string | null
          parent_id?: string | null
          status?: string
          step_number?: number | null
          thread_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string
          connected_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          connected_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          connected_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_receipts_audit: {
        Row: {
          amount: number
          case_number: string | null
          client_cin: string | null
          client_name_ar: string | null
          client_name_fr: string | null
          created_at: string
          id: string
          invoice_id: string | null
          invoice_number: string
          issued_at: string
          issued_by_user_id: string
          lawyer_name: string | null
          payment_method: string | null
          pdf_path: string | null
          security_seal: string | null
          signature_uuid: string | null
          user_agent: string | null
        }
        Insert: {
          amount: number
          case_number?: string | null
          client_cin?: string | null
          client_name_ar?: string | null
          client_name_fr?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number: string
          issued_at?: string
          issued_by_user_id: string
          lawyer_name?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          security_seal?: string | null
          signature_uuid?: string | null
          user_agent?: string | null
        }
        Update: {
          amount?: number
          case_number?: string | null
          client_cin?: string | null
          client_name_ar?: string | null
          client_name_fr?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string
          issued_at?: string
          issued_by_user_id?: string
          lawyer_name?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          security_seal?: string | null
          signature_uuid?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipts_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          case_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          fee_statement_id: string | null
          id: string
          invoice_number: string
          letterhead_id: string | null
          payment_method: string | null
          pdf_path: string | null
          signature_uuid: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          fee_statement_id?: string | null
          id?: string
          invoice_number: string
          letterhead_id?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          signature_uuid?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          fee_statement_id?: string | null
          id?: string
          invoice_number?: string
          letterhead_id?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          signature_uuid?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_fee_statement_id_fkey"
            columns: ["fee_statement_id"]
            isOneToOne: false
            referencedRelation: "fee_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_letterhead_id_fkey"
            columns: ["letterhead_id"]
            isOneToOne: false
            referencedRelation: "letterheads"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          ai_classification: Json | null
          ai_summary: string | null
          category: string | null
          content: string
          court_chamber: string | null
          created_at: string
          decision_date: string | null
          doc_type: string
          embedding: string | null
          id: string
          issuing_authority: string | null
          local_pdf_path: string | null
          metadata: Json | null
          official_gazette_date: string | null
          official_gazette_number: string | null
          pdf_url: string | null
          reference_number: string | null
          resource_page_id: number | null
          signing_date: string | null
          source: string | null
          subject: string | null
          title: string
          year_issued: number | null
        }
        Insert: {
          ai_classification?: Json | null
          ai_summary?: string | null
          category?: string | null
          content: string
          court_chamber?: string | null
          created_at?: string
          decision_date?: string | null
          doc_type?: string
          embedding?: string | null
          id?: string
          issuing_authority?: string | null
          local_pdf_path?: string | null
          metadata?: Json | null
          official_gazette_date?: string | null
          official_gazette_number?: string | null
          pdf_url?: string | null
          reference_number?: string | null
          resource_page_id?: number | null
          signing_date?: string | null
          source?: string | null
          subject?: string | null
          title: string
          year_issued?: number | null
        }
        Update: {
          ai_classification?: Json | null
          ai_summary?: string | null
          category?: string | null
          content?: string
          court_chamber?: string | null
          created_at?: string
          decision_date?: string | null
          doc_type?: string
          embedding?: string | null
          id?: string
          issuing_authority?: string | null
          local_pdf_path?: string | null
          metadata?: Json | null
          official_gazette_date?: string | null
          official_gazette_number?: string | null
          pdf_url?: string | null
          reference_number?: string | null
          resource_page_id?: number | null
          signing_date?: string | null
          source?: string | null
          subject?: string | null
          title?: string
          year_issued?: number | null
        }
        Relationships: []
      }
      letterheads: {
        Row: {
          address: string | null
          bar_name_ar: string | null
          bar_name_fr: string | null
          city: string | null
          created_at: string
          email: string | null
          footer_image_path: string | null
          header_data: Json | null
          header_image_path: string | null
          id: string
          lawyer_name: string
          name_fr: string | null
          phone: string | null
          template_path: string | null
          title_ar: string | null
          title_fr: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          bar_name_ar?: string | null
          bar_name_fr?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          footer_image_path?: string | null
          header_data?: Json | null
          header_image_path?: string | null
          id?: string
          lawyer_name: string
          name_fr?: string | null
          phone?: string | null
          template_path?: string | null
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          bar_name_ar?: string | null
          bar_name_fr?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          footer_image_path?: string | null
          header_data?: Json | null
          header_image_path?: string | null
          id?: string
          lawyer_name?: string
          name_fr?: string | null
          phone?: string | null
          template_path?: string | null
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mahakim_sync_jobs: {
        Row: {
          case_id: string
          case_number: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number
          next_session_date: string | null
          request_payload: Json | null
          result_data: Json | null
          retry_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          case_number: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          next_session_date?: string | null
          request_payload?: Json | null
          result_data?: Json | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          case_number?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          next_session_date?: string | null
          request_payload?: Json | null
          result_data?: Json | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mahakim_sync_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          case_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          push_sent: string | null
          push_status: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          push_sent?: string | null
          push_status?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          push_sent?: string | null
          push_status?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "court_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      reference_documents: {
        Row: {
          content: string
          created_at: string | null
          doc_type: string
          file_name: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_type?: string
          file_name?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_type?: string
          file_name?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      required_actions: {
        Row: {
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          domain_verified: boolean | null
          email_domain: string | null
          id: string
          notify_case: boolean | null
          notify_reset: boolean | null
          notify_signup: boolean | null
          office_address: string | null
          office_email: string | null
          office_name: string | null
          office_phone: string | null
          sender_email: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_verified?: boolean | null
          email_domain?: string | null
          id?: string
          notify_case?: boolean | null
          notify_reset?: boolean | null
          notify_signup?: boolean | null
          office_address?: string | null
          office_email?: string | null
          office_name?: string | null
          office_phone?: string | null
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_verified?: boolean | null
          email_domain?: string | null
          id?: string
          notify_case?: boolean | null
          notify_reset?: boolean | null
          notify_signup?: boolean | null
          office_address?: string | null
          office_email?: string | null
          office_name?: string | null
          office_phone?: string | null
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
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
      count_embedded_rulings: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_cassation_chunks: {
        Args: {
          filter_chamber?: string
          filter_ruling_id?: string
          filter_year?: number
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          ruling_id: string
          similarity: number
        }[]
      }
      next_accounting_number: {
        Args: { _type: string; _user_id: string }
        Returns: string
      }
      search_legal_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          doc_type: string
          id: string
          reference_number: string
          similarity: number
          source: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "director" | "partner" | "clerk" | "content_writer" | "client"
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
      app_role: ["director", "partner", "clerk", "content_writer", "client"],
    },
  },
} as const
