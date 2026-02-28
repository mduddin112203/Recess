import { Database } from './database';

// Database row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Zone = Database['public']['Tables']['zones']['Row'];
export type Presence = Database['public']['Tables']['presence']['Row'];
export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
export type PointsLog = Database['public']['Tables']['points_log']['Row'];
export type UserBlockRow = Database['public']['Tables']['user_blocks']['Row'];
export type ScheduledBreakRow = Database['public']['Tables']['scheduled_breaks']['Row'];
export type BreakInvitationRow = Database['public']['Tables']['break_invitations']['Row'];
export type BreakHistoryRow = Database['public']['Tables']['break_history']['Row'];
export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type PresenceInsert = Database['public']['Tables']['presence']['Insert'];
export type ScheduleBlockInsert = Database['public']['Tables']['schedule_blocks']['Insert'];
export type PointsLogInsert = Database['public']['Tables']['points_log']['Insert'];
export type ScheduledBreakInsert = Database['public']['Tables']['scheduled_breaks']['Insert'];
export type BreakInvitationInsert = Database['public']['Tables']['break_invitations']['Insert'];
export type BreakHistoryInsert = Database['public']['Tables']['break_history']['Insert'];

// Custom types for app state
export type BreakType = 'social' | 'walk' | 'gym' | 'quiet' | 'coffee' | 'custom';
export type BlockType = 'class' | 'study' | 'work' | 'break' | 'other';
export type PresenceStatus = 'busy' | 'free' | 'in_recess';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type ShareLevel = 'public' | 'friends' | 'private';
export type PointsCategory = 'active' | 'physical' | 'social';

// Burnout risk assessment
export interface BurnoutRisk {
  level: 'low' | 'medium' | 'high';
  reason: string;
}

// Active recess session
export interface CurrentRecess {
  type: BreakType;
  zoneId: string;
  zoneName: string;
  startTime: number;
  duration: number; // in minutes
  customTitle?: string;
  customDescription?: string;
  shareLevel?: ShareLevel;
}

// Friend with presence data
export interface FriendWithPresence {
  id: string;
  displayName: string;
  friendCode: string;
  avatarUrl: string | null;
  gender: string | null;
  school: string | null;
  birthday: string | null;
  privacyFriendVisibility: boolean;
  sharePresence: boolean;
  shareSchedule: boolean;
  status: PresenceStatus;
  zoneId: string | null;
  zoneName: string | null;
  recessType: BreakType | null;
  customTitle: string | null;
  customDescription: string | null;
  expiresAt: string | null;
  friendshipId: string;
  currentScheduleBlock: {
    title: string;
    type: BlockType;
    startTime: string;
    endTime: string;
  } | null;
}

// Zone with live counts
export interface ZonePublicUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  recessType: string | null;
  customTitle: string | null;
  customDescription: string | null;
}

export interface ZoneWithCounts {
  id: string;
  name: string;
  building: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  type: 'campus' | 'custom';
  icon: string;
  address: string | null;
  createdBy: string | null;
  expiresAt: string | null;
  totalInRecess: number;
  totalFree: number;
  friendsInRecess: number;
  friendsFree: number;
  breakTypeCounts: {
    social: number;
    walk: number;
    gym: number;
    quiet: number;
    coffee: number;
    custom: number;
  };
  publicUsers: ZonePublicUser[];
}

// Leaderboard entry
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  totalPoints: number;
  activePoints: number;
  physicalPoints: number;
  socialPoints: number;
  rank: number;
  isCurrentUser: boolean;
}

// Scheduled break
export interface ScheduledBreak {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  zone_id: string | null;
  date: string;
  start_time: string;
  duration: number;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
}

// Break invitation
export interface BreakInvitation {
  id: string;
  break_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  // Populated on client
  inviterName?: string;
  inviteeName?: string;
  breakTitle?: string;
  breakDate?: string;
  breakTime?: string;
}

// Break history entry
export interface BreakHistoryEntry {
  id: string;
  user_id: string;
  type: string;
  zone_id: string | null;
  zone_name: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  points_awarded: number;
  custom_title: string | null;
  activity_image_url: string | null;
  created_at: string;
}

// Notification types
export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'break_invitation_received'
  | 'break_invitation_accepted'
  | 'break_invitation_declined'
  | 'friend_started_break';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedUserId: string | null;
  relatedUserName: string | null;
  relatedBreakId: string | null;
  isRead: boolean;
  createdAt: string;
}

// Week ID helper
export function getCurrentWeekId(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Re-export database types
export * from './database';
