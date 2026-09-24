// Hand-written to match supabase/migrations. Can be regenerated with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
// Insert/Update types list only the columns clients are GRANTed to write.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          display_name?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          id: string
          name: string
          emoji: string
          description: string | null
          start_date: string | null
          end_date: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          name?: string
          emoji?: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
        }
        Relationships: []
      }
      trip_members: {
        Row: {
          trip_id: string
          user_id: string
          role: MemberRole
          joined_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'trip_members_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_members_user_profile_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      trip_invites: {
        Row: {
          id: string
          trip_id: string
          token: string
          created_by: string
          created_at: string
          expires_at: string | null
          revoked_at: string | null
        }
        Insert: {
          trip_id: string
          expires_at?: string | null
        }
        Update: {
          revoked_at?: string | null
        }
        Relationships: []
      }
      counters: {
        Row: {
          id: string
          trip_id: string
          name: string
          emoji: string
          unit: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          trip_id: string
          name: string
          emoji: string
          unit?: string | null
        }
        Update: {
          name?: string
          emoji?: string
          unit?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          trip_id: string
          counter_id: string
          user_id: string
          amount: number
          note: string | null
          created_at: string
        }
        Insert: {
          trip_id: string
          counter_id: string
          amount?: number
          note?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: {
      counters_with_totals: {
        Row: {
          id: string
          trip_id: string
          name: string
          emoji: string
          unit: string | null
          created_by: string
          created_at: string
          total: number
          event_count: number
          last_event_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_trip: {
        Args: {
          p_name: string
          p_emoji?: string
          p_description?: string | null
          p_start_date?: string | null
          p_end_date?: string | null
          p_with_default_counters?: boolean
        }
        Returns: Database['public']['Tables']['trips']['Row']
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          status: InviteStatus
          trip_id: string | null
          trip_name: string | null
          trip_emoji: string | null
          member_count: number | null
          is_member: boolean
        }[]
      }
      accept_invite: {
        Args: { p_token: string }
        Returns: string
      }
      get_or_create_invite: {
        Args: { p_trip_id: string }
        Returns: Database['public']['Tables']['trip_invites']['Row']
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type MemberRole = 'owner' | 'member'
export type InviteStatus = 'valid' | 'invalid' | 'revoked' | 'expired'

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']

export type Profile = Tables<'profiles'>
export type Trip = Tables<'trips'>
export type TripMember = Tables<'trip_members'>
export type TripInvite = Tables<'trip_invites'>
export type Counter = Tables<'counters'>
export type TripEvent = Tables<'events'>
export type CounterWithTotal = Views<'counters_with_totals'>
