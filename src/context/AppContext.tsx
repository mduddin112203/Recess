import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  ScheduleBlock,
  Zone,
  Presence,
  CurrentRecess,
  FriendWithPresence,
  ZoneWithCounts,
  BreakType,
  BlockType,
  BreakInvitation,
  BreakHistoryEntry,
  ScheduledBreak,
  AppNotification,
  NotificationType,
  getCurrentWeekId,
} from '../types';
import { CAMPUS_ZONES } from '../utils/constants';
import { toLocalDateString, getLocalDayBoundsUTC, getLocalDayOfWeek, localDateTimeFromStrings } from '../utils/dateUtils';
import {
  registerForNotifications,
  scheduleBreakEndingReminder,
  scheduleItemReminder,
  showImmediateNotification,
} from '../utils/notifications';

interface AppContextType {
  // Schedule
  scheduleBlocks: ScheduleBlock[];
  loadScheduleBlocks: () => Promise<void>;
  addScheduleBlock: (
    block: { title: string; type: BlockType; start_time: string; end_time: string; date?: string | null; day_of_week?: number | null }
  ) => Promise<{ error: Error | null }>;
  addRecurringBlocks: (
    block: { title: string; type: BlockType; start_time: string; end_time: string; days: number[]; end_date?: string | null }
  ) => Promise<{ error: Error | null }>;
  deleteScheduleBlock: (id: string) => Promise<void>;
  
  // Presence & Recess
  currentRecess: CurrentRecess | null;
  myPresence: Presence | null;
  startRecess: (
    type: BreakType,
    zoneId: string,
    zoneName: string,
    duration: number,
    shareLevel?: 'friends' | 'public',
    customTitle?: string,
    customDescription?: string,
    activityImageUrl?: string | null
  ) => Promise<{ error: Error | null }>;
  endRecess: () => Promise<{ pointsAwarded: number }>;
  updatePresenceStatus: (status: 'busy' | 'free') => Promise<void>;
  
  // Zones
  zones: ZoneWithCounts[];
  loadZones: () => Promise<void>;
  createCustomZone: (location: { name: string; address: string; lat: number; lng: number }, expiresAt: Date) => Promise<{ zoneId: string | null; error: Error | null }>;
  
  // Friends
  friends: FriendWithPresence[];
  pendingRequests: { id: string; displayName: string; friendCode: string }[];
  sentRequests: { id: string; displayName: string; friendCode: string; addresseeId: string }[];
  loadFriends: () => Promise<void>;
  addFriend: (friendCode: string) => Promise<{ error: Error | null }>;
  addFriendById: (userId: string) => Promise<{ error: Error | null }>;
  acceptFriend: (friendshipId: string) => Promise<void>;
  declineFriend: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  
  // Blocking
  blockedUsers: string[];
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  loadBlockedUsers: () => Promise<void>;
  
  // Invitations
  breakInvitations: BreakInvitation[];
  sendBreakInvitation: (breakId: string, friendId: string) => Promise<{ error: Error | null }>;
  respondToInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  loadBreakInvitations: () => Promise<void>;
  
  // Scheduled Breaks
  scheduledBreaks: ScheduledBreak[];
  loadScheduledBreaks: () => Promise<void>;
  deleteScheduledBreak: (id: string) => Promise<void>;

  // Break History
  breakHistory: BreakHistoryEntry[];
  loadBreakHistory: (date?: string) => Promise<void>;

  // Notifications
  notifications: AppNotification[];
  unreadNotificationCount: number;
  loadNotifications: () => Promise<void>;
  createNotification: (
    type: NotificationType,
    title: string,
    body: string,
    relatedUserId?: string | null,
    relatedUserName?: string | null,
    relatedBreakId?: string | null,
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Points
  weeklyPoints: number;
  todayBreaksCount: number;
  loadWeeklyPoints: () => Promise<void>;
  
  // Loading states
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Days of week helpers
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  
  // State
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [currentRecess, setCurrentRecess] = useState<CurrentRecess | null>(null);
  const [myPresence, setMyPresence] = useState<Presence | null>(null);
  const [zones, setZones] = useState<ZoneWithCounts[]>([]);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; displayName: string; friendCode: string }[]>([]);
  const [sentRequests, setSentRequests] = useState<{ id: string; displayName: string; friendCode: string; addresseeId: string }[]>([]);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [todayBreaksCount, setTodayBreaksCount] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [breakInvitations, setBreakInvitations] = useState<BreakInvitation[]>([]);
  const [breakHistory, setBreakHistory] = useState<BreakHistoryEntry[]>([]);
  const [scheduledBreaks, setScheduledBreaks] = useState<ScheduledBreak[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initializeData();
      registerForNotifications().catch(console.error);
    } else {
      resetState();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const getProfileName = async (userId: string): Promise<string> => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();
        return data?.display_name || 'Someone';
      } catch {
        return 'Someone';
      }
    };

    const notifiedBreakSessions = new Set<string>();

    const subscription = supabase
      .channel('app-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence' },
        async (payload: any) => {
          loadZones();
          loadFriends();

          if (
            payload.new?.status === 'in_recess' &&
            payload.new?.user_id !== user.id &&
            payload.new?.started_at
          ) {
            const friendUserId = payload.new.user_id;
            const sessionKey = `${friendUserId}:${payload.new.started_at}`;

            if (notifiedBreakSessions.has(sessionKey)) return;

            const { data: friendship } = await supabase
              .from('friendships')
              .select('id')
              .eq('status', 'accepted')
              .or(
                `and(requester_id.eq.${user.id},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${user.id})`
              )
              .maybeSingle();

            if (friendship) {
              notifiedBreakSessions.add(sessionKey);
              const friendName = await getProfileName(friendUserId);
              const recessType = payload.new.recess_type || 'a';
              showImmediateNotification(
                'Friend Started Break',
                `${friendName} started a ${recessType} break!`
              );
              // Save to in-app notifications
              createNotification(
                'friend_started_break',
                'Friend Started Break',
                `${friendName} started a ${recessType} break!`,
                friendUserId,
                friendName,
              );
            }
          }

          if (payload.new?.status !== 'in_recess' && payload.new?.user_id) {
            for (const key of notifiedBreakSessions) {
              if (key.startsWith(`${payload.new.user_id}:`)) {
                notifiedBreakSessions.delete(key);
              }
            }
          }
        }
      )
      // New friend request received
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` },
        async (payload: any) => {
          if (payload.new?.status === 'pending') {
            const requesterName = await getProfileName(payload.new.requester_id);
            showImmediateNotification('New Friend Request', `${requesterName} sent you a friend request!`);
            createNotification(
              'friend_request_received',
              'New Friend Request',
              `${requesterName} sent you a friend request!`,
              payload.new.requester_id,
              requesterName,
            );
          }
          loadFriends();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friendships', filter: `requester_id=eq.${user.id}` },
        async (payload: any) => {
          if (payload.new?.status === 'accepted') {
            const accepterName = await getProfileName(payload.new.addressee_id);
            showImmediateNotification('Friend Request Accepted', `${accepterName} accepted your friend request!`);
            createNotification(
              'friend_request_accepted',
              'Friend Request Accepted',
              `${accepterName} accepted your friend request!`,
              payload.new.addressee_id,
              accepterName,
            );
          }
          loadFriends();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` },
        () => { loadFriends(); }
      )
      // Friendship deleted (unfriended)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'friendships' },
        () => { loadFriends(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'break_invitations', filter: `inviter_id=eq.${user.id}` },
        async (payload: any) => {
          const status = payload.new?.status;
          if (status === 'accepted' || status === 'declined') {
            const responderName = await getProfileName(payload.new.invitee_id);
            const statusText = status === 'accepted' ? 'accepted' : 'declined';
            showImmediateNotification(
              `Invitation ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
              `${responderName} ${statusText} your break invitation!`
            );
            createNotification(
              status === 'accepted' ? 'break_invitation_accepted' : 'break_invitation_declined',
              `Invitation ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
              `${responderName} ${statusText} your break invitation!`,
              payload.new.invitee_id,
              responderName,
              payload.new.break_id,
            );
          }
          loadBreakInvitations();
          loadScheduledBreaks();
        }
      )
      // New break invitation received
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'break_invitations', filter: `invitee_id=eq.${user.id}` },
        async (payload: any) => {
          const inviterName = await getProfileName(payload.new.inviter_id);
          showImmediateNotification('Break Invitation', `${inviterName} invited you to a break!`);
          createNotification(
            'break_invitation_received',
            'Break Invitation',
            `${inviterName} invited you to a break!`,
            payload.new.inviter_id,
            inviterName,
            payload.new.break_id,
          );
          loadBreakInvitations();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_breaks' },
        () => { loadScheduledBreaks(); }
      )
      // Schedule blocks changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_blocks', filter: `user_id=eq.${user.id}` },
        () => { loadScheduleBlocks(); }
      )
      // Points changes
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'points_log', filter: `user_id=eq.${user.id}` },
        () => { loadWeeklyPoints(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const resetState = () => {
    setScheduleBlocks([]);
    setCurrentRecess(null);
    setMyPresence(null);
    setZones([]);
    setFriends([]);
    setPendingRequests([]);
    setSentRequests([]);
    setWeeklyPoints(0);
    setTodayBreaksCount(0);
    setBlockedUsers([]);
    setBreakInvitations([]);
    setBreakHistory([]);
    setScheduledBreaks([]);
    setNotifications([]);
    setLoading(false);
  };

  const initializeData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadScheduleBlocks(),
        loadZones(),
        loadFriends(),
        loadWeeklyPoints(),
        loadMyPresence(),
        loadBlockedUsers(),
        loadBreakInvitations(),
        loadBreakHistory(),
        loadScheduledBreaks(),
        loadNotifications(),
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== SCHEDULE BLOCKS ==========
  const loadScheduleBlocks = useCallback(async () => {
    if (!user) return;

    try {
      const today = toLocalDateString();
      const todayDow = getLocalDayOfWeek(); // 0=Sun ... 6=Sat

      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setScheduleBlocks(data || []);

      const todayBlocks = (data || []).filter(
        b => {
          if (b.end_date && b.end_date < today) return false;
          return b.date === today || (b.day_of_week != null && b.day_of_week === todayDow);
        }
      );
      for (const block of todayBlocks) {
        const dateForBlock = block.date || today;
        const startDate = localDateTimeFromStrings(dateForBlock, block.start_time);
        scheduleItemReminder(block.title, startDate).catch(() => {});
      }
    } catch (error) {
      console.error('Error loading schedule blocks:', error);
    }
  }, [user]);

  const addScheduleBlock = async (
    block: { title: string; type: BlockType; start_time: string; end_time: string; date?: string | null; day_of_week?: number | null }
  ) => {
    if (!user) return { error: new Error('Not logged in') };

    try {
      const insertData: any = {
        user_id: user.id,
        title: block.title,
        type: block.type,
        start_time: block.start_time,
        end_time: block.end_time,
      };

      if (block.day_of_week != null) {
        insertData.day_of_week = block.day_of_week;
        insertData.date = null;
      } else {
        insertData.date = block.date || toLocalDateString();
      }

      const { error } = await supabase.from('schedule_blocks').insert(insertData);

      if (error) throw error;
      await loadScheduleBlocks();

      if (insertData.date && block.start_time) {
        const startDate = localDateTimeFromStrings(insertData.date, block.start_time);
        scheduleItemReminder(block.title, startDate).catch(console.error);
      }

      return { error: null };
    } catch (error) {
      console.error('Error adding schedule block:', error);
      return { error: error as Error };
    }
  };

  const addRecurringBlocks = async (
    block: { title: string; type: BlockType; start_time: string; end_time: string; days: number[]; end_date?: string | null }
  ) => {
    if (!user) return { error: new Error('Not logged in') };

    try {
      const inserts = block.days.map(day => ({
        user_id: user.id,
        title: block.title,
        type: block.type,
        start_time: block.start_time,
        end_time: block.end_time,
        day_of_week: day,
        date: null,
        end_date: block.end_date || null,
      }));

      const { error } = await supabase.from('schedule_blocks').insert(inserts);

      if (error) throw error;
      await loadScheduleBlocks();
      return { error: null };
    } catch (error) {
      console.error('Error adding recurring blocks:', error);
      return { error: error as Error };
    }
  };

  const deleteScheduleBlock = async (id: string) => {
    try {
      await supabase.from('schedule_blocks').delete().eq('id', id);
      setScheduleBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error('Error deleting schedule block:', error);
    }
  };

  // ========== PRESENCE ==========
  const loadMyPresence = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('presence')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading presence:', error);
        return;
      }

      if (data) {
        setMyPresence(data);
        
        if (data.status === 'in_recess' && data.expires_at) {
          const expiresAt = new Date(data.expires_at).getTime();
          const now = Date.now();
          
          if (expiresAt > now && data.zone_id && data.recess_type && data.started_at) {
            const zone = zones.find(z => z.id === data.zone_id) || CAMPUS_ZONES.find(z => z.id === data.zone_id);
            const startTime = new Date(data.started_at).getTime();
            const duration = Math.ceil((expiresAt - startTime) / 60000);
            
            setCurrentRecess({
              type: data.recess_type,
              zoneId: data.zone_id,
              zoneName: zone?.name || 'Unknown',
              startTime: startTime,
              duration: duration,
              customTitle: data.custom_title || undefined,
              customDescription: data.custom_description || undefined,
              shareLevel: data.share_level || undefined,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading presence:', error);
    }
  };

  const updatePresenceStatus = async (status: 'busy' | 'free') => {
    if (!user) return;

    try {
      await supabase.from('presence').upsert({
        user_id: user.id,
        status,
        zone_id: null,
        recess_type: null,
        started_at: null,
        expires_at: null,
      }, { onConflict: 'user_id' });

      setMyPresence((prev) => (prev ? { ...prev, status } : null));
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  const startRecess = async (
    type: BreakType,
    zoneId: string,
    zoneName: string,
    duration: number,
    shareLevel?: 'friends' | 'public',
    customTitle?: string,
    customDescription?: string,
    activityImageUrl?: string | null
  ) => {
    if (!user) return { error: new Error('Not logged in') };

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + duration * 60000);
      const effectiveShareLevel = shareLevel || 'friends';

      const { error } = await supabase.from('presence').upsert({
        user_id: user.id,
        status: 'in_recess',
        zone_id: zoneId,
        recess_type: type,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        share_level: effectiveShareLevel,
        custom_title: customTitle || null,
        custom_description: customDescription || null,
        activity_image_url: activityImageUrl || null,
      }, { onConflict: 'user_id' });

      if (error) throw error;

      setCurrentRecess({
        type,
        zoneId,
        zoneName,
        startTime: now.getTime(),
        duration,
        customTitle: customTitle || undefined,
        customDescription: customDescription || undefined,
        shareLevel: effectiveShareLevel,
      });

      scheduleBreakEndingReminder(type, expiresAt).catch(console.error);

      await loadZones();
      return { error: null };
    } catch (error) {
      console.error('Error starting recess:', error);
      return { error: error as Error };
    }
  };

  const endRecess = async () => {
    if (!user || !currentRecess) return { pointsAwarded: 0 };

    try {
      const elapsed = Date.now() - currentRecess.startTime;
      const elapsedMinutes = elapsed / 60000;
      const expectedMinutes = currentRecess.duration;
      const completionRatio = elapsedMinutes / expectedMinutes;

      await supabase.from('presence').upsert({
        user_id: user.id,
        status: 'free',
        zone_id: null,
        recess_type: null,
        started_at: null,
        expires_at: null,
        custom_title: null,
        custom_description: null,
        activity_image_url: null,
      }, { onConflict: 'user_id' });

      // Save to break history
      try {
        await supabase.from('break_history').insert({
          user_id: user.id,
          type: currentRecess.type,
          zone_id: currentRecess.zoneId,
          zone_name: currentRecess.zoneName,
          started_at: new Date(currentRecess.startTime).toISOString(),
          ended_at: new Date().toISOString(),
          duration_minutes: Math.round(elapsedMinutes),
          points_awarded: 0, // Updated below
          custom_title: currentRecess.customTitle || null,
          activity_image_url: null,
        });
      } catch (historyError) {
        console.error('Error saving break history:', historyError);
      }

      let pointsAwarded = 0;
      if (completionRatio >= 0.7) {
        const weekId = getCurrentWeekId();
        
        // Base active points
        pointsAwarded = 8;
        await supabase.from('points_log').insert({
          user_id: user.id,
          category: 'active',
          points: 8,
          reason: `Completed ${currentRecess.type} recess`,
          week_id: weekId,
        });

        // Physical points for walk/gym
        if (currentRecess.type === 'walk' || currentRecess.type === 'gym') {
          const physicalPoints = currentRecess.type === 'gym' ? 12 : 10;
          pointsAwarded += physicalPoints;
          await supabase.from('points_log').insert({
            user_id: user.id,
            category: 'physical',
            points: physicalPoints,
            reason: `${currentRecess.type} activity`,
            week_id: weekId,
          });
        }

        const { data: friendsInZone } = await supabase
          .from('presence')
          .select('user_id')
          .eq('zone_id', currentRecess.zoneId)
          .eq('status', 'in_recess')
          .neq('user_id', user.id);

        if (friendsInZone && friendsInZone.length > 0) {
          const friendIds = friends.map(f => f.id);
          const friendsCount = friendsInZone.filter(p => friendIds.includes(p.user_id)).length;
          
          if (friendsCount >= 3) {
            pointsAwarded += 15;
            await supabase.from('points_log').insert({
              user_id: user.id,
              category: 'social',
              points: 15,
              reason: 'Group recess with 3+ friends',
              week_id: weekId,
            });
          } else if (friendsCount >= 1) {
            pointsAwarded += 10;
            await supabase.from('points_log').insert({
              user_id: user.id,
              category: 'social',
              points: 10,
              reason: 'Recess with friend',
              week_id: weekId,
            });
          }
        }

        await loadWeeklyPoints();
      }

      const recessZoneId = currentRecess.zoneId;
      const recessZone = zones.find(z => z.id === recessZoneId);
      const isCustomZone = (recessZone && recessZone.type === 'custom') || recessZoneId.startsWith('custom-');
      if (isCustomZone) {
        const { data: othersAtZone } = await supabase
          .from('presence')
          .select('user_id')
          .eq('zone_id', recessZoneId)
          .eq('status', 'in_recess')
          .neq('user_id', user.id)
          .limit(1);

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: linkedBreaks } = await supabase
          .from('scheduled_breaks')
          .select('id')
          .eq('zone_id', recessZoneId)
          .gte('date', todayStr)
          .limit(1);

        const stillInUse =
          (othersAtZone && othersAtZone.length > 0) ||
          (linkedBreaks && linkedBreaks.length > 0);

        if (!stillInUse) {
          await supabase.from('zones').delete().eq('id', recessZoneId);
        }
      }

      setCurrentRecess(null);
      await Promise.all([
        loadZones(),
        loadFriends(),
        loadWeeklyPoints(),
        loadBreakHistory(),
      ]);
      
      return { pointsAwarded };
    } catch (error) {
      console.error('Error ending recess:', error);
      return { pointsAwarded: 0 };
    }
  };

  // ========== ZONES ==========
  const loadZones = useCallback(async () => {
    try {
      // Get all zones
      const { data: zonesData, error: zonesError } = await supabase
        .from('zones')
        .select('*');

      if (zonesError) throw zonesError;

      const now = new Date();
      const nowISO = now.toISOString();

      // Remove orphaned custom zones with no active presence or linked breaks
      const myCustomZones = (zonesData || []).filter(
        z => z.type === 'custom' && z.created_by === user?.id
      );

      let deletedIds = new Set<string>();

      if (myCustomZones.length > 0) {
        const customIds = myCustomZones.map(z => z.id);

        const { data: activePresence } = await supabase
          .from('presence')
          .select('zone_id')
          .in('zone_id', customIds)
          .eq('status', 'in_recess');

        const liveZoneIds = new Set((activePresence || []).map(p => p.zone_id));

        const todayStr = nowISO.split('T')[0];
        const { data: linkedBreaks } = await supabase
          .from('scheduled_breaks')
          .select('zone_id')
          .in('zone_id', customIds)
          .gte('date', todayStr);

        const scheduledZoneIds = new Set((linkedBreaks || []).map(b => b.zone_id));

        const orphaned = myCustomZones.filter(z =>
          !liveZoneIds.has(z.id) && !scheduledZoneIds.has(z.id)
        );

        if (orphaned.length > 0) {
          const orphanIds = orphaned.map(z => z.id);
          const { error: delErr } = await supabase
            .from('zones')
            .delete()
            .in('id', orphanIds);
          if (!delErr) {
            deletedIds = new Set(orphanIds);
          }
        }
      }

      const activeZones = (zonesData || []).filter(z => {
        if (deletedIds.has(z.id)) return false;
        if (z.type === 'campus') return true;
        if (!z.expires_at) return true;
        return new Date(z.expires_at) >= now;
      });

      // Hide other users' custom zones unless current user is invited
      const otherCustomZones = activeZones.filter(
        z => z.type === 'custom' && z.created_by && z.created_by !== user?.id
      );

      let hiddenOtherZoneIds = new Set<string>();
      if (otherCustomZones.length > 0) {
        const otherCustomIds = otherCustomZones.map(z => z.id);

        const { data: otherPresence } = await supabase
          .from('presence')
          .select('zone_id')
          .in('zone_id', otherCustomIds)
          .eq('status', 'in_recess');

        const otherLiveIds = new Set((otherPresence || []).map(p => p.zone_id));

        const notLiveIds = otherCustomIds.filter(id => !otherLiveIds.has(id));
        if (notLiveIds.length > 0) {
          const { data: otherBreaks } = await supabase
            .from('scheduled_breaks')
            .select('id, zone_id')
            .in('zone_id', notLiveIds);

          const invitedZoneIds = new Set<string>();

          if (otherBreaks && otherBreaks.length > 0) {
            const breakIds = otherBreaks.map(b => b.id);
            const { data: myInvites } = await supabase
              .from('break_invitations')
              .select('break_id')
              .in('break_id', breakIds)
              .eq('invitee_id', user?.id || '')
              .eq('status', 'accepted');

            const invitedBreakIds = new Set((myInvites || []).map(i => i.break_id));
            for (const b of otherBreaks) {
              if (invitedBreakIds.has(b.id)) {
                invitedZoneIds.add(b.zone_id);
              }
            }
          }

          for (const id of notLiveIds) {
            if (!invitedZoneIds.has(id)) {
              hiddenOtherZoneIds.add(id);
            }
          }
        }
      }

      // Final filtered list
      const visibleZones = activeZones.filter(z => !hiddenOtherZoneIds.has(z.id));

      const { data: presenceData, error: presenceError } = await supabase
        .from('presence')
        .select('*')
        .or(`status.eq.free,and(status.eq.in_recess,expires_at.gt.${nowISO})`);

      if (presenceError && presenceError.code !== 'PGRST116') {
        console.error('Presence error:', presenceError);
      }

      // Get friend IDs for counting
      const friendIds = friends.map(f => f.id);

      const filteredPresence = (presenceData || []).filter(p => !blockedUsers.includes(p.user_id));

      const nonFriendUserIds = filteredPresence
        .filter(p => !friendIds.includes(p.user_id) && p.user_id !== user?.id)
        .map(p => p.user_id);

      let publicProfiles: Record<string, { display_name: string; avatar_url: string | null }> = {};
      if (nonFriendUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', nonFriendUserIds);
        if (profilesData) {
          profilesData.forEach(p => {
            publicProfiles[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
          });
        }
      }

      const campusIconMap: Record<string, string> = {};
      const campusBuildingMap: Record<string, string> = {};
      const campusAddressMap: Record<string, string> = {};
      CAMPUS_ZONES.forEach(cz => {
        campusIconMap[cz.id] = cz.icon;
        campusBuildingMap[cz.id] = cz.building;
        campusAddressMap[cz.id] = cz.address;
      });

      const zonesWithCounts: ZoneWithCounts[] = (visibleZones.length > 0 ? visibleZones : CAMPUS_ZONES as any[]).map((zone: any) => {
        const zonePresence = filteredPresence.filter(p => p.zone_id === zone.id);
        const inRecess = zonePresence.filter(p => p.status === 'in_recess');
        const free = zonePresence.filter(p => p.status === 'free');

        const pubUsers = zonePresence
          .filter(p => !friendIds.includes(p.user_id) && p.user_id !== user?.id && p.share_level === 'public' && publicProfiles[p.user_id])
          .map(p => ({
            userId: p.user_id,
            displayName: publicProfiles[p.user_id]?.display_name || 'Someone',
            avatarUrl: publicProfiles[p.user_id]?.avatar_url || null,
            status: p.status,
            recessType: p.recess_type || null,
            customTitle: p.custom_title || null,
            customDescription: p.custom_description || null,
          }));

        return {
          id: zone.id,
          name: zone.name,
          building: campusBuildingMap[zone.id] || null,
          lat: zone.lat,
          lng: zone.lng,
          radiusM: zone.radius_m || 50,
          type: zone.type || 'campus',
          icon: zone.icon || campusIconMap[zone.id] || 'location-outline',
          address: zone.address || campusAddressMap[zone.id] || null,
          createdBy: zone.created_by || null,
          expiresAt: zone.expires_at || null,
          totalInRecess: inRecess.length,
          totalFree: free.length,
          friendsInRecess: inRecess.filter(p => friendIds.includes(p.user_id)).length,
          friendsFree: free.filter(p => friendIds.includes(p.user_id)).length,
          breakTypeCounts: {
            social: inRecess.filter(p => p.recess_type === 'social').length,
            walk: inRecess.filter(p => p.recess_type === 'walk').length,
            gym: inRecess.filter(p => p.recess_type === 'gym').length,
            quiet: inRecess.filter(p => p.recess_type === 'quiet').length,
            coffee: inRecess.filter(p => p.recess_type === 'coffee').length,
            custom: inRecess.filter(p => p.recess_type === 'custom').length,
          },
          publicUsers: pubUsers,
        };
      });

      setZones(zonesWithCounts);
    } catch (error) {
      console.error('Error loading zones:', error);
      // Use default zones on error
      setZones(CAMPUS_ZONES.map(zone => ({
        id: zone.id,
        name: zone.name,
        building: zone.building,
        lat: zone.lat,
        lng: zone.lng,
        radiusM: 50,
        type: 'campus' as const,
        icon: zone.icon,
        address: zone.address,
        createdBy: null,
        expiresAt: null,
        totalInRecess: 0,
        totalFree: 0,
        friendsInRecess: 0,
        friendsFree: 0,
        breakTypeCounts: { social: 0, walk: 0, gym: 0, quiet: 0, coffee: 0, custom: 0 },
        publicUsers: [],
      })));
    }
  }, [friends, blockedUsers, user]);

  const createCustomZone = async (
    location: { name: string; address: string; lat: number; lng: number },
    expiresAt: Date
  ): Promise<{ zoneId: string | null; error: Error | null }> => {
    if (!user) return { zoneId: null, error: new Error('Not logged in') };

    try {
      const zoneId = `custom-${user.id.slice(0, 8)}-${Date.now()}`;
      const { error } = await supabase.from('zones').insert({
        id: zoneId,
        campus_id: 'default',
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        radius_m: 50,
        type: 'custom',
        icon: 'location-outline',
        address: location.address,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      return { zoneId, error: null };
    } catch (error: any) {
      console.error('Error creating custom zone:', error);
      return { zoneId: null, error };
    }
  };

  // ========== FRIENDS ==========
  const loadFriends = useCallback(async () => {
    if (!user) return;

    try {
      // Get accepted friendships
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (friendshipsError) throw friendshipsError;

      const { data: pending, error: pendingError } = await supabase
        .from('friendships')
        .select('id, requester_id')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      const { data: sent, error: sentError } = await supabase
        .from('friendships')
        .select('id, addressee_id')
        .eq('requester_id', user.id)
        .eq('status', 'pending');

      if (sentError) throw sentError;

      const friendUserIds = (friendships || [])
        .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
        .filter(id => !blockedUsers.includes(id));

      const pendingUserIds = (pending || [])
        .map(p => p.requester_id)
        .filter(id => !blockedUsers.includes(id));

      const sentUserIds = (sent || [])
        .map(s => s.addressee_id)
        .filter(id => !blockedUsers.includes(id));

      const allUserIds = [...new Set([...friendUserIds, ...pendingUserIds, ...sentUserIds])];
      
      if (allUserIds.length === 0) {
        setFriends([]);
        setPendingRequests([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allUserIds);

      if (profilesError) throw profilesError;

      // Fetch presence for friends
      const { data: presence, error: presenceError } = await supabase
        .from('presence')
        .select('*')
        .in('user_id', friendUserIds);

      if (presenceError && presenceError.code !== 'PGRST116') {
        console.error('Presence error:', presenceError);
      }

      const now = new Date();
      const todayDow = now.getDay(); // 0=Sun
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const sharingScheduleFriendIds = friendUserIds.filter(fId => {
        const prof = (profiles || []).find(p => p.id === fId);
        return prof?.share_schedule === true;
      });

      let allScheduleBlocks: any[] = [];
      if (sharingScheduleFriendIds.length > 0) {
        const { data: recurringBlocks } = await supabase
          .from('schedule_blocks')
          .select('*')
          .in('user_id', sharingScheduleFriendIds)
          .eq('day_of_week', todayDow)
          .is('date', null);

        const { data: dateBlocks } = await supabase
          .from('schedule_blocks')
          .select('*')
          .in('user_id', sharingScheduleFriendIds)
          .eq('date', todayDateStr);

        allScheduleBlocks = [...(recurringBlocks || []), ...(dateBlocks || [])];
      }

      // Build friends with presence
      const allProfiles = profiles || [];
      const allPresence = presence || [];

      const friendsWithPresence: FriendWithPresence[] = friendUserIds.map((friendId) => {
        const prof = allProfiles.find(p => p.id === friendId);
        const friendPresence = allPresence.find(p => p.user_id === friendId);
        const zone = friendPresence?.zone_id 
          ? (zones.find(z => z.id === friendPresence.zone_id) || CAMPUS_ZONES.find(z => z.id === friendPresence.zone_id))
          : null;
        const friendship = (friendships || []).find(f =>
          (f.requester_id === user.id && f.addressee_id === friendId) ||
          (f.addressee_id === user.id && f.requester_id === friendId)
        );

        let currentScheduleBlock: FriendWithPresence['currentScheduleBlock'] = null;
        if (prof?.share_schedule) {
          const friendBlocks = allScheduleBlocks.filter(b => b.user_id === friendId);
          const activeBlock = friendBlocks.find(b => {
            if (b.end_date && b.end_date < todayDateStr) return false;
            return b.start_time <= nowTimeStr && b.end_time > nowTimeStr;
          });
          if (activeBlock) {
            currentScheduleBlock = {
              title: activeBlock.title,
              type: activeBlock.type,
              startTime: activeBlock.start_time,
              endTime: activeBlock.end_time,
            };
          }
        }

        const friendSharePresence = prof?.share_presence ?? true;
        const effectiveStatus = friendSharePresence ? (friendPresence?.status || 'free') : 'free';
        const effectiveRecessType = friendSharePresence ? (friendPresence?.recess_type || null) : null;
        const effectiveCustomTitle = friendSharePresence ? (friendPresence?.custom_title || null) : null;
        const effectiveCustomDescription = friendSharePresence ? (friendPresence?.custom_description || null) : null;
        const effectiveZoneId = friendSharePresence ? (friendPresence?.zone_id || null) : null;
        const effectiveZoneName = friendSharePresence ? (zone?.name || null) : null;

        return {
          id: friendId,
          displayName: prof?.display_name || 'Unknown',
          friendCode: prof?.friend_code || '',
          avatarUrl: prof?.avatar_url || null,
          gender: prof?.gender || null,
          school: prof?.school || null,
          birthday: prof?.birthday || null,
          privacyFriendVisibility: prof?.privacy_friend_visibility ?? true,
          sharePresence: prof?.share_presence ?? true,
          shareSchedule: prof?.share_schedule ?? true,
          status: effectiveStatus as any,
          zoneId: effectiveZoneId,
          zoneName: effectiveZoneName,
          recessType: effectiveRecessType as any,
          customTitle: effectiveCustomTitle,
          customDescription: effectiveCustomDescription,
          expiresAt: friendSharePresence ? (friendPresence?.expires_at || null) : null,
          friendshipId: friendship?.id || '',
          currentScheduleBlock,
        };
      });

      const pendingRequestsList = (pending || []).map(p => {
        const prof = allProfiles.find(pr => pr.id === p.requester_id);
        return {
          id: p.id,
          displayName: prof?.display_name || 'Unknown',
          friendCode: prof?.friend_code || '',
        };
      });

      // Build sent requests
      const sentRequestsList = (sent || [])
        .filter(s => sentUserIds.includes(s.addressee_id))
        .map(s => {
          const prof = allProfiles.find(pr => pr.id === s.addressee_id);
          return {
            id: s.id,
            displayName: prof?.display_name || 'Unknown',
            friendCode: prof?.friend_code || '',
            addresseeId: s.addressee_id,
          };
        });

      setFriends(friendsWithPresence);
      setPendingRequests(pendingRequestsList);
      setSentRequests(sentRequestsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [user, blockedUsers]);

  const addFriend = async (friendCode: string) => {
    if (!user) return { error: new Error('Not logged in') };

    try {
      // Find user by friend code
      const { data: friendProfile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('friend_code', friendCode.toUpperCase())
        .single();

      if (findError || !friendProfile) {
        return { error: new Error('Friend code not found') };
      }

      if (friendProfile.id === user.id) {
        return { error: new Error("You can't add yourself as a friend") };
      }


      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${friendProfile.id}),and(requester_id.eq.${friendProfile.id},addressee_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return { error: new Error('You are already friends') };
        }
        return { error: new Error('Friend request already exists') };
      }

      const { error: insertError } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: friendProfile.id,
        status: 'pending',
      });

      if (insertError) throw insertError;

      return { error: null };
    } catch (error) {
      console.error('Error adding friend:', error);
      return { error: error as Error };
    }
  };

  const addFriendById = async (friendUserId: string) => {
    if (!user) return { error: new Error('Not logged in') };
    if (friendUserId === user.id) return { error: new Error("You can't add yourself") };
    if (blockedUsers.includes(friendUserId)) return { error: new Error('Cannot add this user') };

    try {
      const { data: reverseBlock } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', friendUserId)
        .eq('blocked_id', user.id)
        .maybeSingle();
      if (reverseBlock) return { error: new Error('Cannot add this user') };


      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') return { error: new Error('Already friends') };
        return { error: new Error('Request already sent') };
      }

      const { error: insertError } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: friendUserId,
        status: 'pending',
      });
      if (insertError) throw insertError;

      showImmediateNotification('Friend Request Sent', 'Your request has been sent!').catch(console.error);
      await loadFriends();
      return { error: null };
    } catch (error) {
      console.error('Error adding friend by ID:', error);
      return { error: error as Error };
    }
  };

  const acceptFriend = async (friendshipId: string) => {
    try {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      showImmediateNotification('Friend Request Accepted', 'You have a new friend!').catch(console.error);

      await loadFriends();
    } catch (error) {
      console.error('Error accepting friend:', error);
    }
  };

  const declineFriend = async (friendshipId: string) => {
    try {
      await supabase
        .from('friendships')
        .update({ status: 'declined' })
        .eq('id', friendshipId);

      await loadFriends();
    } catch (error) {
      console.error('Error declining friend:', error);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  // ========== BLOCKING ==========
  const loadBlockedUsers = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      if (error) {
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading blocked users:', error);
        }
        return;
      }
      setBlockedUsers((data || []).map(b => b.blocked_id));
    } catch (error) {
      console.error('Error loading blocked users:', error);
    }
  }, [user]);

  const blockUser = async (userId: string) => {
    if (!user) return;
    try {
      // Insert block
      await supabase.from('user_blocks').insert({
        blocker_id: user.id,
        blocked_id: userId,
      });
      const { data: friendships } = await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
        );
      if (friendships && friendships.length > 0) {
        for (const f of friendships) {
          await supabase.from('friendships').delete().eq('id', f.id);
        }
      }
      setBlockedUsers(prev => [...prev, userId]);
      await loadFriends();
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const unblockUser = async (userId: string) => {
    if (!user) return;
    try {
      await supabase.from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);
      setBlockedUsers(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  // ========== INVITATIONS ==========
  const loadBreakInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('break_invitations')
        .select('*')
        .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) {
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading invitations:', error);
        }
        return;
      }

      const filtered = (data || []).filter(inv =>
        !blockedUsers.includes(inv.inviter_id) && !blockedUsers.includes(inv.invitee_id)
      );

      const enriched: BreakInvitation[] = [];
      for (const inv of filtered) {
        let enrichedInv: BreakInvitation = { ...inv };
        try {
          const { data: breakData } = await supabase
            .from('scheduled_breaks')
            .select('title, date, start_time')
            .eq('id', inv.break_id)
            .single();
          if (breakData) {
            enrichedInv.breakTitle = breakData.title;
            enrichedInv.breakDate = breakData.date;
            enrichedInv.breakTime = breakData.start_time;
          }
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', inv.inviter_id)
            .maybeSingle();
          if (inviterProfile) {
            enrichedInv.inviterName = inviterProfile.display_name;
          }
          const { data: inviteeProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', inv.invitee_id)
            .maybeSingle();
          if (inviteeProfile) {
            enrichedInv.inviteeName = inviteeProfile.display_name;
          }
        } catch (e) {
          // Enrichment is best-effort
        }
        enriched.push(enrichedInv);
      }

      setBreakInvitations(enriched);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  }, [user, blockedUsers]);

  const sendBreakInvitation = async (breakId: string, friendId: string) => {
    if (!user) return { error: new Error('Not logged in') };
    // Prevent inviting blocked users
    if (blockedUsers.includes(friendId)) {
      return { error: new Error('Cannot invite this user') };
    }
    try {
      const { data: existing } = await supabase
        .from('break_invitations')
        .select('id')
        .eq('break_id', breakId)
        .eq('invitee_id', friendId)
        .maybeSingle();
      if (existing) {
        return { error: new Error('This friend has already been invited') };
      }

      const { error } = await supabase.from('break_invitations').insert({
        break_id: breakId,
        inviter_id: user.id,
        invitee_id: friendId,
      });
      if (error) throw error;

      // Show confirmation notification
      const invitedFriend = friends.find(f => f.id === friendId);
      showImmediateNotification(
        'Invitation Sent',
        `${invitedFriend?.displayName || 'Your friend'} has been invited to your break`
      ).catch(console.error);

      await loadBreakInvitations();
      return { error: null };
    } catch (error) {
      console.error('Error sending invitation:', error);
      return { error: error as Error };
    }
  };

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    try {
      await supabase.from('break_invitations')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', invitationId);

      if (accept) {
        showImmediateNotification('Break Joined', 'You accepted a break invitation!').catch(console.error);
      }

      await loadBreakInvitations();
      if (accept) {
        await loadScheduledBreaks();
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
    }
  };

  // ========== BREAK HISTORY ==========
  const loadBreakHistory = useCallback(async (date?: string) => {
    if (!user) return;
    try {
      const targetDate = date || toLocalDateString();
      const { start: startOfDay, end: endOfDay } = getLocalDayBoundsUTC(targetDate);

      const { data, error } = await supabase.from('break_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay)
        .order('started_at', { ascending: false });

      if (error) {
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading break history:', error);
        }
        return;
      }
      setBreakHistory(data || []);

      const todayStr = toLocalDateString();
      if (targetDate === todayStr) {
        setTodayBreaksCount((data || []).length);
      }
    } catch (error) {
      console.error('Error loading break history:', error);
    }
  }, [user]);

  // ========== SCHEDULED BREAKS ==========
  const loadScheduledBreaks = useCallback(async () => {
    if (!user) return;
    try {
      const { data: ownBreaks, error } = await supabase
        .from('scheduled_breaks')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      if (error) {
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading scheduled breaks:', error);
        }
        return;
      }

      const { data: acceptedInvites } = await supabase
        .from('break_invitations')
        .select('break_id')
        .eq('invitee_id', user.id)
        .eq('status', 'accepted');

      let invitedBreaks: typeof ownBreaks = [];
      if (acceptedInvites && acceptedInvites.length > 0) {
        const breakIds = acceptedInvites.map(inv => inv.break_id);
        const { data: invited } = await supabase
          .from('scheduled_breaks')
          .select('*')
          .in('id', breakIds)
          .order('date', { ascending: true });
        invitedBreaks = invited || [];
      }

      const allBreaks = [...(ownBreaks || [])];
      for (const ib of invitedBreaks) {
        if (!allBreaks.find(b => b.id === ib.id)) {
          allBreaks.push(ib);
        }
      }
      allBreaks.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
      setScheduledBreaks(allBreaks);
    } catch (error) {
      console.error('Error loading scheduled breaks:', error);
    }
  }, [user]);

  const deleteScheduledBreak = async (id: string) => {
    try {
      const breakToDelete = scheduledBreaks.find(b => b.id === id);
      const zoneId = breakToDelete?.zone_id;

      await supabase.from('scheduled_breaks').delete().eq('id', id);
      setScheduledBreaks(prev => prev.filter(b => b.id !== id));

      if (zoneId && zoneId.startsWith('custom-')) {
        const { data: otherBreaks } = await supabase
          .from('scheduled_breaks')
          .select('id')
          .eq('zone_id', zoneId)
          .neq('id', id)
          .limit(1);

        const { data: livePresence } = await supabase
          .from('presence')
          .select('user_id')
          .eq('zone_id', zoneId)
          .eq('status', 'in_recess')
          .limit(1);

        const stillInUse = (otherBreaks && otherBreaks.length > 0) ||
                           (livePresence && livePresence.length > 0);

        if (!stillInUse) {
          await supabase.from('zones').delete().eq('id', zoneId);
        }
      }

      await loadZones();
    } catch (error) {
      console.error('Error deleting scheduled break:', error);
    }
  };

  // ========== NOTIFICATIONS ==========
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (!error.message?.includes('does not exist')) {
          console.error('Error loading notifications:', error);
        }
        return;
      }

      const mapped: AppNotification[] = (data || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type as NotificationType,
        title: n.title,
        body: n.body,
        relatedUserId: n.related_user_id,
        relatedUserName: n.related_user_name,
        relatedBreakId: n.related_break_id,
        isRead: n.is_read,
        createdAt: n.created_at,
      }));

      setNotifications(mapped);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user]);

  const createNotification = useCallback(async (
    type: NotificationType,
    title: string,
    body: string,
    relatedUserId?: string | null,
    relatedUserName?: string | null,
    relatedBreakId?: string | null,
  ) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type,
        title,
        body,
        related_user_id: relatedUserId || null,
        related_user_name: relatedUserName || null,
        related_break_id: relatedBreakId || null,
      }).select().single();

      if (error) {
        console.error('Error creating notification:', error);
        return;
      }

      if (data) {
        const newNotif: AppNotification = {
          id: data.id,
          userId: data.user_id,
          type: data.type as NotificationType,
          title: data.title,
          body: data.body,
          relatedUserId: data.related_user_id,
          relatedUserName: data.related_user_name,
          relatedBreakId: data.related_break_id,
          isRead: data.is_read,
          createdAt: data.created_at,
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }, [user]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  }, [user]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  }, [user]);

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // ========== POINTS ==========
  const loadWeeklyPoints = useCallback(async () => {
    if (!user) return;

    try {
      const weekId = getCurrentWeekId();
      const { data, error } = await supabase
        .from('points_log')
        .select('points')
        .eq('user_id', user.id)
        .eq('week_id', weekId);

      if (error) throw error;

      const total = (data || []).reduce((sum, log) => sum + log.points, 0);
      setWeeklyPoints(total);
    } catch (error) {
      console.error('Error loading weekly points:', error);
    }
  }, [user]);

  return (
    <AppContext.Provider
      value={{
        scheduleBlocks,
        loadScheduleBlocks,
        addScheduleBlock,
        addRecurringBlocks,
        deleteScheduleBlock,
        currentRecess,
        myPresence,
        startRecess,
        endRecess,
        updatePresenceStatus,
        zones,
        loadZones,
        createCustomZone,
        friends,
        pendingRequests,
        sentRequests,
        loadFriends,
        addFriend,
        addFriendById,
        acceptFriend,
        declineFriend,
        removeFriend,
        blockedUsers,
        blockUser,
        unblockUser,
        loadBlockedUsers,
        breakInvitations,
        sendBreakInvitation,
        respondToInvitation,
        loadBreakInvitations,
        scheduledBreaks,
        loadScheduledBreaks,
        deleteScheduledBreak,
        breakHistory,
        loadBreakHistory,
        notifications,
        unreadNotificationCount,
        loadNotifications,
        createNotification,
        markNotificationRead,
        markAllNotificationsRead,
        weeklyPoints,
        todayBreaksCount,
        loadWeeklyPoints,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
