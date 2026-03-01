import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';
import { FriendWithPresence, BreakInvitation, AppNotification, NotificationType } from '../types';
import { FriendProfileModal } from '../components/FriendProfileModal';

export function FriendsScreen() {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const {
    friends, pendingRequests, sentRequests, loadFriends, addFriend,
    acceptFriend, declineFriend, breakInvitations, respondToInvitation,
    loadBreakInvitations, scheduledBreaks, zones,
    notifications, unreadNotificationCount, loadNotifications,
    markNotificationRead, markAllNotificationsRead,
  } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithPresence | null>(null);
  const [notifExpanded, setNotifExpanded] = useState(true);
  const [notifShowAll, setNotifShowAll] = useState(false);

  useEffect(() => { loadFriends(); loadBreakInvitations(); loadNotifications(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFriends(), loadBreakInvitations(), loadNotifications()]);
    setRefreshing(false);
  };

  const handleAddFriend = async () => {
    if (!friendCode.trim()) {
      Alert.alert('Error', 'Please enter a friend code');
      return;
    }
    setLoading(true);
    const { error } = await addFriend(friendCode.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Friend request sent!');
      setFriendCode('');
      setShowAddModal(false);
    }
  };

  const handleAccept = async (id: string) => { await acceptFriend(id); };
  const handleDecline = async (id: string) => {
    Alert.alert('Decline Request', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => declineFriend(id) },
    ]);
  };

  const copyFriendCode = () => {
    Alert.alert('Your Friend Code', `${profile?.friend_code}\n\nShare this code with friends!`, [{ text: 'OK' }]);
  };

  const pendingInvitesReceived = breakInvitations.filter(
    inv => inv.invitee_id === user?.id && inv.status === 'pending'
  );
  const pendingInvitesSent = breakInvitations.filter(
    inv => inv.inviter_id === user?.id && inv.status === 'pending'
  );
  const respondedInvitesSent = breakInvitations.filter(
    inv => inv.inviter_id === user?.id && (inv.status === 'accepted' || inv.status === 'declined')
  );

  const getActivityLabel = (item: FriendWithPresence): { text: string; icon: string; color: string } | null => {
    if (item.status === 'in_recess' && item.recessType) {
      const breakLabel = item.recessType === 'custom' && item.customTitle
        ? item.customTitle
        : `${item.recessType.charAt(0).toUpperCase() + item.recessType.slice(1)} break`;
      return { text: breakLabel, icon: 'cafe-outline', color: STATUS_COLORS.in_recess };
    }
    if (item.currentScheduleBlock) {
      const block = item.currentScheduleBlock;
      const typeIcons: Record<string, string> = {
        class: 'school-outline',
        study: 'book-outline',
        work: 'briefcase-outline',
        break: 'cafe-outline',
        other: 'ellipsis-horizontal-outline',
      };
      return {
        text: block.title,
        icon: typeIcons[block.type] || 'time-outline',
        color: colors.primary,
      };
    }
    return null;
  };

  const getInviteZoneName = (inv: BreakInvitation) => {
    const sb = scheduledBreaks.find(b => b.id === inv.break_id);
    if (sb?.zone_id) {
      return zones.find(z => z.id === sb.zone_id)?.name || null;
    }
    return null;
  };

  // ===== Notification helpers =====
  const getRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    if (isNaN(date)) return '';
    const diffMs = now - date;
    if (diffMs < 0) return 'Just now'; // future timestamp (clock skew)
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 7)}w ago`;
  };

  const getNotifIcon = (type: NotificationType): { name: string; color: string } => {
    switch (type) {
      case 'friend_request_received':
        return { name: 'person-add-outline', color: colors.warning };
      case 'friend_request_accepted':
        return { name: 'people-outline', color: colors.success };
      case 'break_invitation_received':
        return { name: 'calendar-outline', color: colors.secondary };
      case 'break_invitation_accepted':
        return { name: 'checkmark-circle-outline', color: colors.success };
      case 'break_invitation_declined':
        return { name: 'close-circle-outline', color: colors.error };
      case 'friend_started_break':
        return { name: 'play-circle-outline', color: colors.primary };
      default:
        return { name: 'notifications-outline', color: colors.textSecondary };
    }
  };

  const visibleNotifications = notifShowAll ? notifications : notifications.slice(0, 20);

  const renderFriendItem = ({ item }: { item: FriendWithPresence }) => {
    const activity = getActivityLabel(item);
    return (
      <TouchableOpacity style={styles.friendCard} onPress={() => setSelectedFriend(item)} activeOpacity={0.7}>
        <View style={styles.friendAvatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.friendAvatarImg} />
          ) : (
            <Text style={styles.friendAvatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
          )}
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>{item.displayName}</Text>
          <View style={styles.friendStatusRow}>
            <Text style={[styles.friendStatus, { color: STATUS_COLORS[item.status] }]} numberOfLines={1}>
              {STATUS_LABELS[item.status]}
            </Text>
            {item.zoneName && item.status === 'in_recess' && (
              <Text style={styles.friendZone} numberOfLines={1}> · {item.zoneName}</Text>
            )}
          </View>
          {activity && (
            <View style={styles.activityRow}>
              <Ionicons name={activity.icon as any} size={13} color={activity.color} />
              <Text style={[styles.activityText, { color: activity.color }]} numberOfLines={1}>
                {activity.text}
              </Text>
            </View>
          )}
          {item.status === 'in_recess' && item.customDescription && (
            <Text style={styles.friendRecessDesc} numberOfLines={1}>{item.customDescription}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Friend Code + Add */}
        <TouchableOpacity style={styles.codeCard} onPress={copyFriendCode}>
          <View style={styles.codeLeft}>
            <Ionicons name="person-add" size={24} color={colors.primary} />
            <View>
              <Text style={styles.codeLabel}>Your Friend Code</Text>
              <Text style={styles.codeValue}>{profile?.friend_code || 'Loading...'}</Text>
            </View>
          </View>
          <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addButtonText}>Add Friend</Text>
        </TouchableOpacity>

        {/* ===== NOTIFICATIONS FEED ===== */}
        {notifications.length > 0 && (
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.notifSectionHeader}
              onPress={() => setNotifExpanded(!notifExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.notifHeaderLeft}>
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>Notifications</Text>
                {unreadNotificationCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.countBadgeText, { color: colors.primary }]}>{unreadNotificationCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.notifHeaderRight}>
                {unreadNotificationCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllReadBtn}
                    onPress={() => markAllNotificationsRead()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.markAllReadText}>Mark All Read</Text>
                  </TouchableOpacity>
                )}
                <Ionicons
                  name={notifExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {notifExpanded && (
              <>
                {visibleNotifications.map((notif: AppNotification) => {
                  const icon = getNotifIcon(notif.type);
                  return (
                    <TouchableOpacity
                      key={notif.id}
                      style={[
                        styles.notifCard,
                        !notif.isRead && { borderLeftWidth: 3, borderLeftColor: icon.color },
                      ]}
                      onPress={() => { if (!notif.isRead) markNotificationRead(notif.id); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.notifIconWrap, { backgroundColor: `${icon.color}15` }]}>
                        <Ionicons name={icon.name as any} size={20} color={icon.color} />
                      </View>
                      <View style={styles.notifContent}>
                        <Text
                          style={[
                            styles.notifTitle,
                            !notif.isRead && { fontWeight: '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {notif.title}
                        </Text>
                        <Text style={styles.notifBody} numberOfLines={2}>
                          {notif.body}
                        </Text>
                        <Text style={styles.notifTime}>{getRelativeTime(notif.createdAt)}</Text>
                      </View>
                      {!notif.isRead && (
                        <View style={[styles.unreadDot, { backgroundColor: icon.color }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {!notifShowAll && notifications.length > 20 && (
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() => setNotifShowAll(true)}
                  >
                    <Text style={styles.showMoreText}>Show More ({notifications.length - 20} older)</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* ===== PENDING FRIEND REQUESTS RECEIVED ===== */}
        {pendingRequests.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail-outline" size={18} color={colors.warning} />
              <Text style={[styles.sectionTitle, { color: colors.warning }]}>Friend Requests</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
              </View>
            </View>
            {pendingRequests.map(item => (
              <View key={item.id} style={styles.pendingCard}>
                <View style={[styles.pendingAvatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.pendingAvatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={styles.pendingCode} numberOfLines={1}>{item.friendCode}</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item.id)}>
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(item.id)}>
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== SENT FRIEND REQUESTS ===== */}
        {sentRequests.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="paper-plane-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Sent Requests</Text>
              <View style={[styles.countBadge, { backgroundColor: `${colors.textSecondary}20` }]}>
                <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>{sentRequests.length}</Text>
              </View>
            </View>
            {sentRequests.map(item => (
              <View key={item.id} style={[styles.pendingCard, { borderColor: colors.border }]}>
                <View style={[styles.pendingAvatar, { backgroundColor: `${colors.textSecondary}30` }]}>
                  <Text style={[styles.pendingAvatarText, { color: colors.textSecondary }]}>{item.displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={styles.pendingCode} numberOfLines={1}>{item.friendCode}</Text>
                </View>
                <View style={[styles.sentBadge, { backgroundColor: `${colors.warning}15` }]}>
                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                  <Text style={[styles.sentBadgeText, { color: colors.warning }]}>Pending</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== BREAK INVITATIONS RECEIVED ===== */}
        {pendingInvitesReceived.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
              <Text style={[styles.sectionTitle, { color: colors.secondary }]}>Break Invitations</Text>
              <View style={[styles.countBadge, { backgroundColor: `${colors.secondary}20` }]}>
                <Text style={[styles.countBadgeText, { color: colors.secondary }]}>{pendingInvitesReceived.length}</Text>
              </View>
            </View>
            {pendingInvitesReceived.map(inv => {
              const inviterFriend = friends.find(f => f.id === inv.inviter_id);
              const inviterName = inv.inviterName || inviterFriend?.displayName || 'Someone';
              const zoneName = getInviteZoneName(inv);
              return (
                <View key={inv.id} style={[styles.pendingCard, { borderColor: `${colors.secondary}30` }]}>
                  <View style={[styles.pendingAvatar, { backgroundColor: colors.secondary }]}>
                    {inviterFriend?.avatarUrl ? (
                      <Image source={{ uri: inviterFriend.avatarUrl }} style={styles.friendAvatarImg} />
                    ) : (
                      <Text style={styles.pendingAvatarTextWhite}>{inviterName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName} numberOfLines={1}>{inv.breakTitle || 'Break'}</Text>
                    <Text style={styles.pendingCode} numberOfLines={1}>{inviterName} invited you</Text>
                    <View style={styles.inviteMetaRow}>
                      {inv.breakDate && (
                        <>
                          <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                          <Text style={styles.inviteMetaText} numberOfLines={1}>
                            {inv.breakDate}{inv.breakTime ? ` at ${inv.breakTime}` : ''}
                          </Text>
                        </>
                      )}
                      {zoneName && (
                        <>
                          <Ionicons name="location-outline" size={11} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                          <Text style={styles.inviteMetaText} numberOfLines={1}>{zoneName}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => respondToInvitation(inv.id, true)}>
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineButton} onPress={() => respondToInvitation(inv.id, false)}>
                      <Ionicons name="close" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== BREAK INVITATIONS SENT ===== */}
        {pendingInvitesSent.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="send-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Invitations Sent</Text>
              <View style={[styles.countBadge, { backgroundColor: `${colors.textSecondary}20` }]}>
                <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>{pendingInvitesSent.length}</Text>
              </View>
            </View>
            {pendingInvitesSent.map(inv => {
              const inviteeFriend = friends.find(f => f.id === inv.invitee_id);
              const inviteeName = inv.inviteeName || inviteeFriend?.displayName || 'Someone';
              const zoneName = getInviteZoneName(inv);
              return (
                <View key={inv.id} style={[styles.pendingCard, { borderColor: colors.border }]}>
                  <View style={[styles.pendingAvatar, { backgroundColor: `${colors.textSecondary}30` }]}>
                    {inviteeFriend?.avatarUrl ? (
                      <Image source={{ uri: inviteeFriend.avatarUrl }} style={styles.friendAvatarImg} />
                    ) : (
                      <Text style={[styles.pendingAvatarText, { color: colors.textSecondary }]}>{inviteeName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName} numberOfLines={1}>{inv.breakTitle || 'Break'}</Text>
                    <Text style={styles.pendingCode} numberOfLines={1}>Sent to {inviteeName}</Text>
                    {zoneName && (
                      <View style={styles.inviteMetaRow}>
                        <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                        <Text style={styles.inviteMetaText} numberOfLines={1}>{zoneName}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.sentBadge, { backgroundColor: `${colors.warning}15` }]}>
                    <Ionicons name="time-outline" size={14} color={colors.warning} />
                    <Text style={[styles.sentBadgeText, { color: colors.warning }]}>Pending</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== INVITATION RESPONSES (accepted/declined to your invites) ===== */}
        {respondedInvitesSent.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Invitation Responses</Text>
            </View>
            {respondedInvitesSent.slice(0, 5).map(inv => {
              const inviteeName = inv.inviteeName || friends.find(f => f.id === inv.invitee_id)?.displayName || 'Someone';
              const isAccepted = inv.status === 'accepted';
              return (
                <View key={inv.id} style={[styles.responseCard, { borderColor: isAccepted ? `${colors.success}30` : `${colors.error}20` }]}>
                  <Ionicons
                    name={isAccepted ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={isAccepted ? colors.success : colors.error}
                  />
                  <View style={styles.pendingInfo}>
                    <Text style={styles.responseText} numberOfLines={2}>
                      {inviteeName} {isAccepted ? 'accepted' : 'declined'} your invite to{' '}
                      <Text style={{ fontWeight: '700' }}>{inv.breakTitle || 'a break'}</Text>
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== FRIENDS LIST ===== */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Friends {friends.length > 0 && `(${friends.length})`}</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>
                Add friends using their friend code to see their break status and coordinate downtime together.
              </Text>
            </View>
          ) : (
            friends.map(item => (
              <View key={item.id}>{renderFriendItem({ item })}</View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Enter Friend Code</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g., RCS-4K9P"
              placeholderTextColor={colors.textSecondary}
              value={friendCode}
              onChangeText={(text) => {
                const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (cleaned.length <= 3) {
                  setFriendCode(cleaned);
                } else {
                  setFriendCode(cleaned.slice(0, 3) + '-' + cleaned.slice(3, 7));
                }
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={handleAddFriend}
              disabled={loading}
            >
              <Text style={styles.sendButtonText}>{loading ? 'Sending...' : 'Send Request'}</Text>
            </TouchableOpacity>
            <View style={styles.modalHint}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.modalHintText}>Ask your friend for their code, or share yours with them!</Text>
            </View>
          </View>
        </View>
      </Modal>

      <FriendProfileModal
        visible={!!selectedFriend}
        onClose={() => setSelectedFriend(null)}
        friend={selectedFriend}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    codeCard: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    codeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codeLabel: { fontSize: 12, color: colors.textSecondary },
    codeValue: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 1 },
    addButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
    addButtonText: { fontSize: 16, fontWeight: '600', color: colors.white },
    sectionBlock: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    countBadge: {
      backgroundColor: `${colors.warning}20`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 4,
    },
    countBadgeText: { fontSize: 12, fontWeight: '700', color: colors.warning },
    listContent: { paddingBottom: 20 },
    friendCard: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    friendAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 14, position: 'relative' },
    friendAvatarImg: { width: 48, height: 48, borderRadius: 24 },
    friendAvatarText: { fontSize: 18, fontWeight: '600', color: colors.white },
    statusDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.cardBg },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    friendStatusRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    friendStatus: { fontSize: 14, fontWeight: '500', flexShrink: 0 },
    friendZone: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
    friendRecessType: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    friendRecessDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    activityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 3 },
    activityText: { fontSize: 13, fontWeight: '500' as const },
    friendActivityThumb: { width: 40, height: 40, borderRadius: 8, marginLeft: 8 },
    pendingCard: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: colors.accent },
    pendingAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
    pendingAvatarText: { fontSize: 17, fontWeight: '600', color: colors.primary },
    pendingAvatarTextWhite: { fontSize: 17, fontWeight: '600', color: colors.white },
    pendingInfo: { flex: 1 },
    pendingName: { fontSize: 15, fontWeight: '600', color: colors.text },
    pendingCode: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    pendingActions: { flexDirection: 'row', gap: 8 },
    acceptButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
    declineButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.error}15`, justifyContent: 'center', alignItems: 'center' },
    sentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    sentBadgeText: { fontSize: 13, fontWeight: '600' },
    inviteMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 3,
    },
    inviteMetaText: { fontSize: 11, color: colors.textSecondary },
    responseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
    },
    responseText: { fontSize: 13, color: colors.text, lineHeight: 18 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    modalContent: { padding: 20 },
    modalLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    codeInput: { backgroundColor: colors.cardBg, borderRadius: 12, padding: 16, fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center', letterSpacing: 2, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
    sendButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    sendButtonDisabled: { opacity: 0.7 },
    sendButtonText: { fontSize: 16, fontWeight: '600', color: colors.white },
    modalHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, padding: 12, backgroundColor: `${colors.secondary}10`, borderRadius: 10 },
    modalHintText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    // ===== Notification styles =====
    notifSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    notifHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    notifHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    markAllReadBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: `${colors.primary}12`,
    },
    markAllReadText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    notifCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    notifIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    notifContent: {
      flex: 1,
    },
    notifTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    notifBody: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    notifTime: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 3,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
    },
    showMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
    },
    showMoreText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });
