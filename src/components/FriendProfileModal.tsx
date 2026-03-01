import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { STATUS_COLORS, STATUS_LABELS, GENDER_OPTIONS } from '../utils/constants';
import { FriendWithPresence } from '../types';

interface FriendProfileModalProps {
  visible: boolean;
  onClose: () => void;
  friend: FriendWithPresence | null;
}

export function FriendProfileModal({ visible, onClose, friend }: FriendProfileModalProps) {
  const { colors } = useTheme();
  const { removeFriend, blockUser, unblockUser, blockedUsers } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!friend) return null;

  const isBlocked = blockedUsers.includes(friend.id);

  const genderLabel = friend.gender
    ? GENDER_OPTIONS.find(g => g.id === friend.gender)?.label || friend.gender
    : null;

  const handleRemoveFriend = () => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.displayName} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFriend(friend.friendshipId);
            onClose();
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Block ${friend.displayName}? They won't be able to see your profile, breaks, or activity. This will also remove them as a friend.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(friend.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleUnblockUser = () => {
    Alert.alert(
      'Unblock User',
      `Unblock ${friend.displayName}? They will be able to find your profile again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            await unblockUser(friend.id);
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar & Name */}
          <View style={styles.profileHeader}>
            {friend.avatarUrl ? (
              <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{friend.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.displayName}>{friend.displayName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[friend.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[friend.status] }]}>
                {STATUS_LABELS[friend.status]}
              </Text>
            </View>
            {friend.status === 'in_recess' && friend.zoneName && (
              <Text style={styles.zoneText}>{friend.zoneName}</Text>
            )}
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsCard}>
              {friend.privacyFriendVisibility ? (
                <>
                  {genderLabel && (
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailLabel}>Gender</Text>
                      <Text style={styles.detailValue}>{genderLabel}</Text>
                    </View>
                  )}
                  {friend.school && (
                    <View style={styles.detailRow}>
                      <Ionicons name="school-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailLabel}>School</Text>
                      <Text style={styles.detailValue}>{friend.school}</Text>
                    </View>
                  )}
                  {friend.birthday && (() => {
                    const birth = new Date(friend.birthday);
                    const now = new Date();
                    let age = now.getFullYear() - birth.getFullYear();
                    const monthDiff = now.getMonth() - birth.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
                    return age > 0 ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.detailLabel}>Age</Text>
                        <Text style={styles.detailValue}>{age}</Text>
                      </View>
                    ) : null;
                  })()}
                  <View style={styles.detailRow}>
                    <Ionicons name="code-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>Friend Code</Text>
                    <Text style={styles.detailValue}>{friend.friendCode}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.detailRow}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Details hidden by user</Text>
                </View>
              )}
            </View>
          </View>

          {/* Current Activity */}
          {friend.status === 'in_recess' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Break</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="cafe-outline" size={18} color={colors.primary} />
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {friend.recessType === 'custom' && friend.customTitle
                      ? friend.customTitle
                      : friend.recessType
                        ? friend.recessType.charAt(0).toUpperCase() + friend.recessType.slice(1)
                        : 'Break'}
                  </Text>
                </View>
                {friend.customDescription && (
                  <View style={styles.detailRow}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{friend.customDescription}</Text>
                  </View>
                )}
                {friend.zoneName && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={18} color={colors.primary} />
                    <Text style={styles.detailLabel}>Zone</Text>
                    <Text style={styles.detailValue}>{friend.zoneName}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Current Schedule Block */}
          {friend.currentScheduleBlock && friend.status !== 'in_recess' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Activity</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Ionicons
                    name={
                      friend.currentScheduleBlock.type === 'class' ? 'school-outline' :
                      friend.currentScheduleBlock.type === 'study' ? 'book-outline' :
                      friend.currentScheduleBlock.type === 'work' ? 'briefcase-outline' :
                      'time-outline'
                    }
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.detailLabel}>{friend.currentScheduleBlock.type.charAt(0).toUpperCase() + friend.currentScheduleBlock.type.slice(1)}</Text>
                  <Text style={styles.detailValue}>{friend.currentScheduleBlock.title}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {friend.currentScheduleBlock.startTime} – {friend.currentScheduleBlock.endTime}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleRemoveFriend}>
              <Ionicons name="person-remove-outline" size={20} color={colors.error} />
              <Text style={styles.actionTextDanger}>Remove Friend</Text>
            </TouchableOpacity>
            {isBlocked ? (
              <TouchableOpacity style={styles.actionButton} onPress={handleUnblockUser}>
                <Ionicons name="lock-open-outline" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Unblock User</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionButton} onPress={handleBlockUser}>
                <Ionicons name="ban-outline" size={20} color={colors.error} />
                <Text style={styles.actionTextDanger}>Block User</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.cardBg,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    profileHeader: { alignItems: 'center', marginBottom: 24 },
    avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 16 },
    avatarPlaceholder: {
      width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    avatarText: { fontSize: 36, fontWeight: '600', color: colors.white },
    displayName: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 15, fontWeight: '600' },
    zoneText: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
    detailsCard: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 16 },
    detailRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    detailLabel: { fontSize: 14, color: colors.textSecondary, flex: 1 },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.text },
    activityImage: { width: '100%', height: 200, borderRadius: 14, marginBottom: 8 },
    activityTitle: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
    actionButton: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 16,
      backgroundColor: colors.cardBg, borderRadius: 12, marginBottom: 10,
    },
    actionText: { fontSize: 16, fontWeight: '500', color: colors.primary },
    actionTextDanger: { fontSize: 16, fontWeight: '500', color: colors.error },
  });
