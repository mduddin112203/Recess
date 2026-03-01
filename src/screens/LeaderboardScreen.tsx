import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { LEADERBOARD_CATEGORIES } from '../utils/constants';
import { LeaderboardEntry, getCurrentWeekId } from '../types';

type CategoryId = 'total' | 'active' | 'physical' | 'social';

export function LeaderboardScreen() {
  const { user } = useAuth();
  const { friends, weeklyPoints, blockedUsers } = useApp();
  const { colors } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('total');
  const [leaderboardMode, setLeaderboardMode] = useState<'friends' | 'public'>('friends');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const createStyles = (colors: any) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: colors.background },
      container: { flex: 1, backgroundColor: colors.background },
      tabsContainer: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.border },
      tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.background },
      tabSelected: { backgroundColor: colors.primary },
      tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
      tabTextSelected: { color: colors.white },
      yourStatsCard: { flexDirection: 'row', backgroundColor: colors.primary, margin: 16, borderRadius: 16, padding: 20 },
      yourStatsLeft: { flex: 1, alignItems: 'center' },
      yourStatsRight: { flex: 1, alignItems: 'center' },
      yourStatsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 16 },
      yourStatsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
      yourStatsRank: { fontSize: 28, fontWeight: '700', color: colors.white },
      yourStatsPoints: { fontSize: 28, fontWeight: '700', color: colors.white },
      listContainer: { flex: 1, paddingHorizontal: 16 },
      listTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
      listContent: { paddingBottom: 20 },
      leaderboardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, marginBottom: 10 },
      currentUserItem: { borderWidth: 2, borderColor: colors.primary, backgroundColor: `${colors.primary}08` },
      rankContainer: { width: 32, alignItems: 'center' },
      rankMedal: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
      rankText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
      avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
      currentUserAvatar: { backgroundColor: colors.primary },
      avatarImg: { width: 44, height: 44, borderRadius: 22, marginLeft: 8 },
      avatarText: { fontSize: 18, fontWeight: '600', color: colors.white },
      userInfo: { flex: 1, marginLeft: 12 },
      userName: { fontSize: 16, fontWeight: '600', color: colors.text },
      currentUserName: { color: colors.primary },
      pointsContainer: { alignItems: 'flex-end' },
      pointsValue: { fontSize: 20, fontWeight: '700', color: colors.text },
      currentUserPoints: { color: colors.primary },
      pointsLabel: { fontSize: 12, color: colors.textSecondary },
      emptyState: { alignItems: 'center', paddingVertical: 40 },
      emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 8 },
      emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
      modeToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
      modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
      modeToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
      modeToggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
      modeToggleTextActive: { color: colors.white },
    });
  const styles = useMemo(() => createStyles(colors), [colors]);

  const loadLeaderboard = useCallback(async () => {
    if (!user) return;

    try {
      const weekId = getCurrentWeekId();

      let pointsData: any[] = [];
      let profilesData: { id: string; display_name: string; avatar_url: string | null }[] = [];

      if (leaderboardMode === 'friends') {
        const friendIds = friends.map(f => f.id);
        const relevantUserIds = [...friendIds, user.id];

        const { data, error: pointsError } = await supabase
          .from('points_log')
          .select('user_id, category, points')
          .eq('week_id', weekId)
          .in('user_id', relevantUserIds);
        if (pointsError) throw pointsError;
        pointsData = data || [];

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', relevantUserIds) as any;
        if (profilesError) throw profilesError;
        profilesData = profiles || [];
      } else {
        const { data, error: pointsError } = await supabase
          .from('points_log')
          .select('user_id, category, points')
          .eq('week_id', weekId);
        if (pointsError) throw pointsError;
        pointsData = data || [];

        const allUserIds = [...new Set([...pointsData.map(p => p.user_id), user.id])];
        if (allUserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', allUserIds) as any;
          if (profilesError) throw profilesError;
          profilesData = profiles || [];
        }
      }

      const userPointsMap: Record<string, { total: number; active: number; physical: number; social: number }> = {};

      userPointsMap[user.id] = { total: 0, active: 0, physical: 0, social: 0 };

      pointsData.forEach((log: any) => {
        if (!userPointsMap[log.user_id]) {
          userPointsMap[log.user_id] = { total: 0, active: 0, physical: 0, social: 0 };
        }
        userPointsMap[log.user_id][log.category as 'active' | 'physical' | 'social'] += log.points;
        userPointsMap[log.user_id].total += log.points;
      });

      const entries: LeaderboardEntry[] = Object.entries(userPointsMap)
        .filter(([userId]) => !blockedUsers.includes(userId))
        .map(([userId, points]) => {
          const profile = profilesData?.find(p => p.id === userId);
          return {
            userId,
            displayName: profile?.display_name || 'Unknown',
            avatarUrl: profile?.avatar_url ?? null,
            totalPoints: points.total,
            activePoints: points.active,
            physicalPoints: points.physical,
            socialPoints: points.social,
            rank: 0,
            isCurrentUser: userId === user.id,
          };
        });

      const sortKey = selectedCategory === 'total' ? 'totalPoints' : `${selectedCategory}Points` as keyof LeaderboardEntry;
      entries.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
      entries.forEach((entry, index) => { entry.rank = index + 1; });

      setLeaderboard(entries);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user, friends, selectedCategory, leaderboardMode, blockedUsers]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const onRefresh = async () => { setRefreshing(true); await loadLeaderboard(); setRefreshing(false); };

  const getPointsForCategory = (entry: LeaderboardEntry) => {
    switch (selectedCategory) {
      case 'active': return entry.activePoints;
      case 'physical': return entry.physicalPoints;
      case 'social': return entry.socialPoints;
      default: return entry.totalPoints;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) { case 1: return '#FFD700'; case 2: return '#C0C0C0'; case 3: return '#CD7F32'; default: return null; }
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const points = getPointsForCategory(item);
    const rankColor = getRankColor(item.rank);
    return (
      <View style={[styles.leaderboardItem, item.isCurrentUser && styles.currentUserItem]}>
        <View style={styles.rankContainer}>
          {rankColor ? (
            <View style={[styles.rankMedal, { backgroundColor: rankColor }]}>
              <Ionicons name="trophy" size={14} color={colors.white} />
            </View>
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatar, item.isCurrentUser && styles.currentUserAvatar]}>
            <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, item.isCurrentUser && styles.currentUserName]}>
            {item.displayName}{item.isCurrentUser && ' (You)'}
          </Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={[styles.pointsValue, item.isCurrentUser && styles.currentUserPoints]}>{points}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  const currentUserEntry = leaderboard.find(e => e.isCurrentUser);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.tabsContainer}>
          {LEADERBOARD_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.tab, selectedCategory === category.id && styles.tabSelected]}
              onPress={() => setSelectedCategory(category.id as CategoryId)}
            >
              <Ionicons
                name={category.icon as any}
                size={18}
                color={selectedCategory === category.id ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.tabText, selectedCategory === category.id && styles.tabTextSelected]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {currentUserEntry && (
          <View style={styles.yourStatsCard}>
            <View style={styles.yourStatsLeft}>
              <Text style={styles.yourStatsLabel}>Your Rank</Text>
              <Text style={styles.yourStatsRank}>#{currentUserEntry.rank}</Text>
            </View>
            <View style={styles.yourStatsDivider} />
            <View style={styles.yourStatsRight}>
              <Text style={styles.yourStatsLabel}>This Week</Text>
              <Text style={styles.yourStatsPoints}>{getPointsForCategory(currentUserEntry)} pts</Text>
            </View>
          </View>
        )}

        <View style={styles.listContainer}>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeToggle, leaderboardMode === 'friends' && styles.modeToggleActive]}
              onPress={() => setLeaderboardMode('friends')}
            >
              <Ionicons name="people" size={16} color={leaderboardMode === 'friends' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modeToggleText, leaderboardMode === 'friends' && styles.modeToggleTextActive]}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggle, leaderboardMode === 'public' && styles.modeToggleActive]}
              onPress={() => setLeaderboardMode('public')}
            >
              <Ionicons name="globe" size={16} color={leaderboardMode === 'public' ? colors.white : colors.textSecondary} />
              <Text style={[styles.modeToggleText, leaderboardMode === 'public' && styles.modeToggleTextActive]}>Public</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.listTitle}>{leaderboardMode === 'friends' ? 'Friends' : 'Public'} Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>Start taking breaks and add friends to compete!</Text>
            </View>
          ) : (
            <FlatList
              data={leaderboard}
              renderItem={renderLeaderboardItem}
              keyExtractor={(item) => item.userId}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
