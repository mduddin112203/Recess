export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          friend_code: string
          campus_id: string
          default_break_length: number
          privacy_friend_visibility: boolean
          privacy_public_zone_visibility: boolean
          share_presence: boolean
          share_schedule: boolean
          avatar_url: string | null
          gender: string | null
          birthday: string | null
          school: string | null
          timezone: string
          theme_preference: 'system' | 'light' | 'dark'
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          friend_code: string
          campus_id?: string
          default_break_length?: number
          privacy_friend_visibility?: boolean
          privacy_public_zone_visibility?: boolean
          share_presence?: boolean
          share_schedule?: boolean
          avatar_url?: string | null
          gender?: string | null
          birthday?: string | null
          school?: string | null
          timezone?: string
          theme_preference?: 'system' | 'light' | 'dark'
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          friend_code?: string
          campus_id?: string
          default_break_length?: number
          privacy_friend_visibility?: boolean
          privacy_public_zone_visibility?: boolean
          share_presence?: boolean
          share_schedule?: boolean
          avatar_url?: string | null
          gender?: string | null
          birthday?: string | null
          school?: string | null
          timezone?: string
          theme_preference?: 'system' | 'light' | 'dark'
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      zones: {
        Row: {
          id: string
          campus_id: string
          name: string
          lat: number
          lng: number
          radius_m: number
          type: 'campus' | 'custom'
          icon: string | null
          address: string | null
          created_by: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          campus_id?: string
          name: string
          lat: number
          lng: number
          radius_m?: number
          type?: 'campus' | 'custom'
          icon?: string | null
          address?: string | null
          created_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campus_id?: string
          name?: string
          lat?: number
          lng?: number
          radius_m?: number
          type?: 'campus' | 'custom'
          icon?: string | null
          address?: string | null
          created_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      presence: {
        Row: {
          user_id: string
          status: 'busy' | 'free' | 'in_recess'
          zone_id: string | null
          recess_type: 'social' | 'walk' | 'gym' | 'quiet' | 'coffee' | 'custom' | null
          started_at: string | null
          expires_at: string | null
          share_level: 'public' | 'friends' | 'private'
          custom_title: string | null
          custom_description: string | null
          activity_image_url: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: 'busy' | 'free' | 'in_recess'
          zone_id?: string | null
          recess_type?: 'social' | 'walk' | 'gym' | 'quiet' | 'coffee' | 'custom' | null
          started_at?: string | null
          expires_at?: string | null
          share_level?: 'public' | 'friends' | 'private'
          custom_title?: string | null
          custom_description?: string | null
          activity_image_url?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          status?: 'busy' | 'free' | 'in_recess'
          zone_id?: string | null
          recess_type?: 'social' | 'walk' | 'gym' | 'quiet' | 'coffee' | 'custom' | null
          started_at?: string | null
          expires_at?: string | null
          share_level?: 'public' | 'friends' | 'private'
          custom_title?: string | null
          custom_description?: string | null
          activity_image_url?: string | null
          updated_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
      }
      schedule_blocks: {
        Row: {
          id: string
          user_id: string
          title: string
          type: 'class' | 'study' | 'work' | 'break' | 'other'
          start_time: string
          end_time: string
          date: string | null
          day_of_week: number | null
          end_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          type?: 'class' | 'study' | 'work' | 'break' | 'other'
          start_time: string
          end_time: string
          date?: string | null
          day_of_week?: number | null
          end_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          type?: 'class' | 'study' | 'work' | 'break' | 'other'
          start_time?: string
          end_time?: string
          date?: string | null
          day_of_week?: number | null
          end_date?: string | null
          created_at?: string
        }
      }
      points_log: {
        Row: {
          id: string
          user_id: string
          category: 'active' | 'physical' | 'social'
          points: number
          reason: string | null
          created_at: string
          week_id: string
        }
        Insert: {
          id?: string
          user_id: string
          category: 'active' | 'physical' | 'social'
          points: number
          reason?: string | null
          created_at?: string
          week_id: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: 'active' | 'physical' | 'social'
          points?: number
          reason?: string | null
          created_at?: string
          week_id?: string
        }
      }
      user_blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
      }
      scheduled_breaks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          zone_id: string | null
          date: string
          start_time: string
          duration: number
          visibility: 'public' | 'friends' | 'private'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          zone_id?: string | null
          date: string
          start_time: string
          duration?: number
          visibility?: 'public' | 'friends' | 'private'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          zone_id?: string | null
          date?: string
          start_time?: string
          duration?: number
          visibility?: 'public' | 'friends' | 'private'
          created_at?: string
        }
      }
      break_invitations: {
        Row: {
          id: string
          break_id: string
          inviter_id: string
          invitee_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
        }
        Insert: {
          id?: string
          break_id: string
          inviter_id: string
          invitee_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
        Update: {
          id?: string
          break_id?: string
          inviter_id?: string
          invitee_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
      }
      break_history: {
        Row: {
          id: string
          user_id: string
          type: string
          zone_id: string | null
          zone_name: string | null
          started_at: string
          ended_at: string
          duration_minutes: number
          points_awarded: number
          custom_title: string | null
          activity_image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          zone_id?: string | null
          zone_name?: string | null
          started_at: string
          ended_at: string
          duration_minutes: number
          points_awarded?: number
          custom_title?: string | null
          activity_image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          zone_id?: string | null
          zone_name?: string | null
          started_at?: string
          ended_at?: string
          duration_minutes?: number
          points_awarded?: number
          custom_title?: string | null
          activity_image_url?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          related_user_id: string | null
          related_user_name: string | null
          related_break_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          related_user_id?: string | null
          related_user_name?: string | null
          related_break_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          related_user_id?: string | null
          related_user_name?: string | null
          related_break_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      leaderboard_weekly: {
        Row: {
          user_id: string
          display_name: string
          week_id: string
          total_points: number
          active_points: number
          physical_points: number
          social_points: number
          sessions_count: number
        }
      }
    }
  }
}
