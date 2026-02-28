import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { STATUS_COLORS } from '../utils/constants';
import { ZoneWithCounts, FriendWithPresence } from '../types';
import { FriendProfileModal } from '../components/FriendProfileModal';

const { width } = Dimensions.get('window');

// === Types for the detail card ===
interface BreakPerson {
  userId?: string;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  isFriend: boolean;
  breakType: string | null;
  customTitle: string | null;
  customDescription: string | null;
  status: string;
}

interface DetailCardData {
  title: string;
  zoneName: string;
  people: BreakPerson[];
  // If single person view
  person?: BreakPerson;
  // Time info for current user
  startTime?: number;
  duration?: number;
  shareLevel?: string;
}

interface PublicProfileCard {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  school: string | null;
  gender: string | null;
  friendCode: string | null;
  breakType: string | null;
  customTitle: string | null;
  customDescription: string | null;
  status: string;
  zoneName: string;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

const getZoneCoordinatesStatic = (zoneId: string, zonesList: ZoneWithCounts[]) => {
  const zone = zonesList.find(z => z.id === zoneId);
  return zone ? { latitude: zone.lat, longitude: zone.lng } : null;
};

const openInMaps = (zoneName: string, lat: number, lng: number) => {
  Linking.openURL(`maps:?q=${encodeURIComponent(zoneName)}&ll=${lat},${lng}`);
};

// Format elapsed time
const formatElapsed = (startMs: number) => {
  const mins = Math.floor((Date.now() - startMs) / 60000);
  if (mins < 1) return 'Just started';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
};

// Format remaining time
const formatRemaining = (startMs: number, durationMin: number) => {
  const endMs = startMs + durationMin * 60000;
  const remMs = endMs - Date.now();
  if (remMs <= 0) return 'Ending soon';
  const mins = Math.ceil(remMs / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m left` : `${hrs}h left`;
};

// Format time from timestamp
const formatTimeFromMs = (ms: number) => {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const BREAK_ICON_MAP: Record<string, string> = {
  social: 'people-outline',
  walk: 'walk-outline',
  gym: 'barbell-outline',
  quiet: 'book-outline',
  coffee: 'cafe-outline',
  custom: 'color-palette-outline',
};

const BREAK_LABEL_MAP: Record<string, string> = {
  social: 'Social',
  walk: 'Walk',
  gym: 'Gym',
  quiet: 'Quiet',
  coffee: 'Coffee',
  custom: 'Custom',
};

export function MapScreen() {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const { zones, friends, loadZones, currentRecess, startRecess, addFriendById } = useApp();
  const [selectedZone, setSelectedZone] = useState<ZoneWithCounts | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithPresence | null>(null);
  const [detailCard, setDetailCard] = useState<DetailCardData | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileCard | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Join Recess quick-modal state
  const [joinZone, setJoinZone] = useState<ZoneWithCounts | null>(null);
  const [joinBreakType, setJoinBreakType] = useState<string>('social');
  const [joinDuration, setJoinDuration] = useState(15);
  const [joinVisibility, setJoinVisibility] = useState<'friends' | 'public'>('friends');
  const [joinLoading, setJoinLoading] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => { loadZones(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadZones();
    setRefreshing(false);
  };

  const handleJoinRecess = async () => {
    if (!joinZone || joinLoading) return;
    setJoinLoading(true);
    try {
      const { error } = await startRecess(
        joinBreakType as any,
        joinZone.id,
        joinZone.name,
        joinDuration,
        joinVisibility,
      );
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setJoinZone(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to join recess');
    } finally {
      setJoinLoading(false);
    }
  };

  const openJoinModal = (zone: ZoneWithCounts) => {
    const counts = zone.breakTypeCounts;
    const topType = (['social', 'walk', 'gym', 'quiet', 'coffee', 'custom'] as const)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
    setJoinBreakType(topType || 'social');
    setJoinDuration(15);
    setJoinVisibility('friends');
    setJoinZone(zone);
  };

  const handleZonePress = (zone: ZoneWithCounts) => {
    setSelectedZone(selectedZone?.id === zone.id ? null : zone);
  };

  const getZoneCoordinates = (zoneId: string) => getZoneCoordinatesStatic(zoneId, zones);

  const getZoneIcon = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone?.icon || 'location-outline';
  };

  const getFriendsInZone = (zoneId: string): FriendWithPresence[] => {
    return friends.filter(f => f.zoneId === zoneId);
  };

  const getCustomBreakGroups = (zone: ZoneWithCounts): { title: string; count: number }[] => {
    const groups: Record<string, number> = {};
    const friendsHere = getFriendsInZone(zone.id);

    // Current user
    if (currentRecess && currentRecess.zoneId === zone.id && currentRecess.type === 'custom') {
      const title = currentRecess.customTitle || 'Custom';
      groups[title] = (groups[title] || 0) + 1;
    }
    // Friends
    friendsHere.filter(f => f.status === 'in_recess' && f.recessType === 'custom').forEach(f => {
      const title = f.customTitle || 'Custom';
      groups[title] = (groups[title] || 0) + 1;
    });
    // Public users
    (zone.publicUsers || []).filter(pu => pu.status === 'in_recess' && pu.recessType === 'custom').forEach(pu => {
      const title = pu.customTitle || 'Custom';
      groups[title] = (groups[title] || 0) + 1;
    });

    return Object.entries(groups).map(([title, count]) => ({ title, count }));
  };

  const getMarkerColor = (zone: ZoneWithCounts) => {
    if (zone.totalInRecess > 0) return colors.primary;
    if (zone.totalFree > 0) return STATUS_COLORS.free;
    return colors.textSecondary;
  };

  const getPeopleByBreakType = (zone: ZoneWithCounts, breakType: string): BreakPerson[] => {
    const people: BreakPerson[] = [];
    const friendsHere = getFriendsInZone(zone.id);

    // Current user
    if (currentRecess && currentRecess.zoneId === zone.id && currentRecess.type === breakType) {
      people.push({
        name: profile?.display_name || 'You',
        avatarUrl: profile?.avatar_url || null,
        isMe: true,
        isFriend: false,
        breakType: currentRecess.type,
        customTitle: currentRecess.customTitle || null,
        customDescription: currentRecess.customDescription || null,
        status: 'in_recess',
      });
    }

    // Friends
    friendsHere.filter(f => f.status === 'in_recess' && f.recessType === breakType).forEach(f => {
      people.push({
        name: f.displayName,
        avatarUrl: f.avatarUrl,
        isMe: false,
        isFriend: true,
        breakType: f.recessType,
        customTitle: f.customTitle,
        customDescription: f.customDescription || null,
        status: f.status,
      });
    });

    // Public users
    (zone.publicUsers || []).filter(pu => pu.status === 'in_recess' && pu.recessType === breakType).forEach(pu => {
      people.push({
        userId: pu.userId,
        name: pu.displayName,
        avatarUrl: pu.avatarUrl,
        isMe: false,
        isFriend: false,
        breakType: pu.recessType,
        customTitle: pu.customTitle,
        customDescription: pu.customDescription,
        status: pu.status,
      });
    });

    return people;
  };

  const showBreakTypeDetail = (zone: ZoneWithCounts, breakType: string) => {
    const people = getPeopleByBreakType(zone, breakType);
    const label = BREAK_LABEL_MAP[breakType] || breakType;
    setDetailCard({
      title: `${label} Break`,
      zoneName: zone.name,
      people,
      startTime: currentRecess?.zoneId === zone.id && currentRecess?.type === breakType ? currentRecess.startTime : undefined,
      duration: currentRecess?.zoneId === zone.id && currentRecess?.type === breakType ? currentRecess.duration : undefined,
    });
  };

  const showCustomBreakGroupDetail = (zone: ZoneWithCounts, customTitle: string) => {
    const allCustomPeople = getPeopleByBreakType(zone, 'custom');
    const people = allCustomPeople.filter(p => (p.customTitle || 'Custom') === customTitle);
    setDetailCard({
      title: customTitle,
      zoneName: zone.name,
      people,
      startTime: currentRecess?.zoneId === zone.id && currentRecess?.type === 'custom' && (currentRecess.customTitle || 'Custom') === customTitle
        ? currentRecess.startTime : undefined,
      duration: currentRecess?.zoneId === zone.id && currentRecess?.type === 'custom' && (currentRecess.customTitle || 'Custom') === customTitle
        ? currentRecess.duration : undefined,
    });
  };

  const openPublicUserProfile = useCallback((
    pu: { userId: string; displayName: string; avatarUrl: string | null; status: string; recessType: string | null; customTitle: string | null; customDescription?: string | null },
    zoneName: string
  ) => {
    setPublicProfile({
      userId: pu.userId,
      displayName: pu.displayName,
      avatarUrl: pu.avatarUrl,
      school: null,
      gender: null,
      friendCode: null,
      breakType: pu.recessType,
      customTitle: pu.customTitle,
      customDescription: pu.customDescription || null,
      status: pu.status,
      zoneName,
      friendshipStatus: 'none',
    });

    (async () => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('school, gender, friend_code')
          .eq('id', pu.userId)
          .maybeSingle();

        let friendshipStatus: PublicProfileCard['friendshipStatus'] = 'none';
        if (user?.id && pu.userId !== user.id) {
          try {
            const { data: friendship } = await supabase
              .from('friendships')
              .select('id, status, requester_id')
              .or(
                `and(requester_id.eq.${user.id},addressee_id.eq.${pu.userId}),and(requester_id.eq.${pu.userId},addressee_id.eq.${user.id})`
              )
              .maybeSingle();
            if (friendship) {
              if (friendship.status === 'accepted') {
                friendshipStatus = 'accepted';
              } else if (friendship.requester_id === user.id) {
                friendshipStatus = 'pending_sent';
              } else {
                friendshipStatus = 'pending_received';
              }
            }
          } catch (friendErr) {
            console.warn('Error checking friendship:', friendErr);
          }
        }

        setPublicProfile(prev => prev && prev.userId === pu.userId ? {
          ...prev,
          school: profileData?.school || null,
          gender: profileData?.gender || null,
          friendCode: profileData?.friend_code || null,
          friendshipStatus,
        } : prev);
      } catch (e) {
        console.error('Error enriching public profile:', e);
      }
    })();
  }, [user]);

  const handleAddFriendFromProfile = async () => {
    if (!publicProfile) return;
    setAddingFriend(true);
    const { error } = await addFriendById(publicProfile.userId);
    setAddingFriend(false);
    if (error) {
      Alert.alert('Could not add friend', error.message);
    } else {
      setPublicProfile(prev => prev ? { ...prev, friendshipStatus: 'pending_sent' } : null);
    }
  };

  const showMyRecessDetail = (zone: ZoneWithCounts) => {
    if (!currentRecess) return;
    const breakLabel = currentRecess.type === 'custom' && currentRecess.customTitle
      ? currentRecess.customTitle
      : BREAK_LABEL_MAP[currentRecess.type] || currentRecess.type;
    setDetailCard({
      title: breakLabel,
      zoneName: zone.name,
      people: [],
      person: {
        name: profile?.display_name || 'You',
        avatarUrl: profile?.avatar_url || null,
        isMe: true,
        isFriend: false,
        breakType: currentRecess.type,
        customTitle: currentRecess.customTitle || null,
        customDescription: currentRecess.customDescription || null,
        status: 'in_recess',
      },
      startTime: currentRecess.startTime,
      duration: currentRecess.duration,
      shareLevel: currentRecess.shareLevel,
    });
  };

  // === Detail Card Modal ===
  const renderDetailCard = () => {
    if (!detailCard) return null;
    const { title, zoneName, people, person, startTime, duration, shareLevel } = detailCard;
    const isSinglePerson = !!person;
    const breakType = person?.breakType || (people.length > 0 ? people[0]?.breakType : null);
    const icon = BREAK_ICON_MAP[breakType || ''] || 'fitness-outline';

    return (
      <Modal visible={!!detailCard} transparent animationType="fade" onRequestClose={() => setDetailCard(null)}>
        <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={() => setDetailCard(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.detailCard}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailIconBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name={icon as any} size={24} color={colors.white} />
              </View>
              <View style={styles.detailHeaderInfo}>
                <Text style={styles.detailTitle} numberOfLines={2}>{title}</Text>
                <View style={styles.detailZoneRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.detailZoneText} numberOfLines={1}>{zoneName}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDetailCard(null)} style={styles.detailCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.detailDivider} />

            {/* Time info (if available) */}
            {startTime && duration && (
              <View style={styles.detailTimeSection}>
                <View style={styles.detailTimeRow}>
                  <View style={styles.detailTimeItem}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.detailTimeLabel}>Started</Text>
                    <Text style={styles.detailTimeValue}>{formatTimeFromMs(startTime)}</Text>
                  </View>
                  <View style={styles.detailTimeDivider} />
                  <View style={styles.detailTimeItem}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
                    <Text style={styles.detailTimeLabel}>Duration</Text>
                    <Text style={styles.detailTimeValue}>{duration}m</Text>
                  </View>
                  <View style={styles.detailTimeDivider} />
                  <View style={styles.detailTimeItem}>
                    <Ionicons name="timer-outline" size={16} color={colors.primary} />
                    <Text style={styles.detailTimeLabel}>Ends</Text>
                    <Text style={styles.detailTimeValue}>{formatTimeFromMs(startTime + duration * 60000)}</Text>
                  </View>
                </View>
                <View style={styles.detailElapsedRow}>
                  <Text style={styles.detailElapsedText}>{formatElapsed(startTime)} · {formatRemaining(startTime, duration)}</Text>
                </View>
              </View>
            )}

            {/* Visibility badge */}
            {shareLevel && (
              <View style={styles.detailVisibilityRow}>
                <Ionicons name={shareLevel === 'public' ? 'globe-outline' : 'people'} size={14} color={colors.textSecondary} />
                <Text style={styles.detailVisibilityText}>
                  {shareLevel === 'public' ? 'Visible to everyone' : 'Friends only'}
                </Text>
              </View>
            )}

            {/* Single person view */}
            {isSinglePerson && person && (
              <View style={styles.detailPersonSection}>
                <View style={styles.detailPersonRow}>
                  <View style={[styles.detailPersonAvatar, { backgroundColor: person.isMe ? colors.primary : colors.secondary }]}>
                    {person.avatarUrl ? (
                      <Image source={{ uri: person.avatarUrl }} style={styles.detailPersonAvatarImg} />
                    ) : (
                      <Text style={styles.detailPersonAvatarText}>{person.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.detailPersonInfo}>
                    <Text style={styles.detailPersonName} numberOfLines={1}>{person.name}{person.isMe ? ' (You)' : ''}</Text>
                    <Text style={styles.detailPersonStatus}>
                      {person.status === 'in_recess' ? 'On break' : 'Available'}
                    </Text>
                  </View>
                  {person.isFriend && (
                    <View style={[styles.detailBadge, { backgroundColor: colors.secondary + '20' }]}>
                      <Text style={[styles.detailBadgeText, { color: colors.secondary }]}>Friend</Text>
                    </View>
                  )}
                  {person.isMe && (
                    <View style={[styles.detailBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.detailBadgeText, { color: colors.primary }]}>You</Text>
                    </View>
                  )}
                </View>
                {person.customDescription && (
                  <View style={styles.detailDescriptionBox}>
                    <Text style={styles.detailDescriptionText} numberOfLines={3}>{person.customDescription}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Multi-person list (break type view) */}
            {!isSinglePerson && people.length > 0 && (
              <View style={styles.detailPeopleSection}>
                <Text style={styles.detailPeopleTitle}>{people.length} {people.length === 1 ? 'person' : 'people'} on this break</Text>
                {people.map((p, idx) => {
                  const canTap = !p.isMe && !p.isFriend && !!p.userId;
                  const Wrapper = canTap ? TouchableOpacity : View;
                  return (
                    <Wrapper
                      key={idx}
                      style={styles.detailPersonRow}
                      {...(canTap ? {
                        activeOpacity: 0.7,
                        onPress: () => {
                          if (!p.userId) return;
                          const zn = detailCard?.zoneName || '';
                          setDetailCard(null);
                          setTimeout(() => {
                            openPublicUserProfile(
                              { userId: p.userId!, displayName: p.name, avatarUrl: p.avatarUrl, status: p.status, recessType: p.breakType, customTitle: p.customTitle, customDescription: p.customDescription },
                              zn
                            );
                          }, 350);
                        },
                      } : {})}
                    >
                      <View style={[styles.detailPersonAvatar, { backgroundColor: p.isMe ? colors.primary : p.isFriend ? colors.secondary : colors.textSecondary }]}>
                        {p.avatarUrl ? (
                          <Image source={{ uri: p.avatarUrl }} style={styles.detailPersonAvatarImg} />
                        ) : (
                          <Text style={styles.detailPersonAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={styles.detailPersonInfo}>
                        <Text style={styles.detailPersonName} numberOfLines={1}>
                          {p.name}{p.isMe ? ' (You)' : ''}
                        </Text>
                        {p.breakType === 'custom' && p.customTitle && (
                          <Text style={styles.detailPersonCustomTitle} numberOfLines={1}>{p.customTitle}</Text>
                        )}
                        {p.customDescription && (
                          <Text style={styles.detailPersonDescText} numberOfLines={2}>{p.customDescription}</Text>
                        )}
                      </View>
                      {p.isFriend && (
                        <View style={[styles.detailBadge, { backgroundColor: colors.secondary + '20' }]}>
                          <Text style={[styles.detailBadgeText, { color: colors.secondary }]}>Friend</Text>
                        </View>
                      )}
                      {p.isMe && (
                        <View style={[styles.detailBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.detailBadgeText, { color: colors.primary }]}>You</Text>
                        </View>
                      )}
                      {canTap && (
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      )}
                    </Wrapper>
                  );
                })}
              </View>
            )}

            {!isSinglePerson && people.length === 0 && (
              <View style={styles.detailEmptySection}>
                <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.detailEmptyText}>No one currently on this break type</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // === Public Profile Card Modal ===
  const renderPublicProfileCard = () => {
    if (!publicProfile) return null;
    const pp = publicProfile;
    const breakIcon = BREAK_ICON_MAP[pp.breakType || ''] || 'fitness-outline';
    const breakLabel = pp.breakType === 'custom' && pp.customTitle
      ? pp.customTitle
      : pp.breakType
        ? BREAK_LABEL_MAP[pp.breakType] || pp.breakType
        : null;

    return (
      <Modal visible={!!publicProfile} transparent animationType="fade" onRequestClose={() => setPublicProfile(null)}>
        <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={() => setPublicProfile(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.detailCard}>
            {/* Close button */}
            <TouchableOpacity onPress={() => setPublicProfile(null)} style={styles.profileCloseBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Avatar + Name */}
            <View style={styles.profileAvatarSection}>
              <View style={styles.profileAvatarLarge}>
                {pp.avatarUrl ? (
                  <Image source={{ uri: pp.avatarUrl }} style={styles.profileAvatarLargeImg} />
                ) : (
                  <Text style={styles.profileAvatarLargeText}>{(pp.displayName || '?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>{pp.displayName}</Text>
              {pp.school && (
                <View style={styles.profileInfoRow}>
                  <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.profileInfoText} numberOfLines={1}>{pp.school}</Text>
                </View>
              )}
              {pp.gender && (
                <View style={styles.profileInfoRow}>
                  <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.profileInfoText} numberOfLines={1}>{pp.gender}</Text>
                </View>
              )}
              {pp.friendCode && (
                <View style={styles.profileInfoRow}>
                  <Ionicons name="code-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.profileInfoText} numberOfLines={1}>{pp.friendCode}</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.detailDivider} />

            {/* Current Activity */}
            <View style={styles.profileActivitySection}>
              <View style={styles.profileActivityRow}>
                <View style={[styles.profileActivityIcon, { backgroundColor: pp.status === 'in_recess' ? colors.primary : STATUS_COLORS.free }]}>
                  <Ionicons name={pp.status === 'in_recess' ? (breakIcon as any) : 'cafe-outline'} size={18} color={colors.white} />
                </View>
                <View style={styles.profileActivityInfo}>
                  <Text style={styles.profileActivityLabel}>
                    {pp.status === 'in_recess' ? 'Currently on break' : 'Available'}
                  </Text>
                  {breakLabel && (
                    <Text style={styles.profileActivityType} numberOfLines={1}>{breakLabel}</Text>
                  )}
                </View>
              </View>
              {pp.customDescription && (
                <View style={styles.profileDescriptionBox}>
                  <Text style={styles.profileDescriptionText} numberOfLines={3}>{pp.customDescription}</Text>
                </View>
              )}
              <View style={styles.profileLocationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.profileLocationText} numberOfLines={1}>{pp.zoneName}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.detailDivider} />

            {/* Action Button */}
            <View style={styles.profileActionSection}>
              {pp.friendshipStatus === 'none' && (
                <TouchableOpacity
                  style={[styles.profileActionBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAddFriendFromProfile}
                  disabled={addingFriend}
                  activeOpacity={0.7}
                >
                  {addingFriend ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color={colors.white} />
                      <Text style={styles.profileActionBtnText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {pp.friendshipStatus === 'pending_sent' && (
                <View style={[styles.profileActionBtn, { backgroundColor: colors.border }]}>
                  <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.profileActionBtnText, { color: colors.textSecondary }]}>Request Sent</Text>
                </View>
              )}
              {pp.friendshipStatus === 'pending_received' && (
                <View style={[styles.profileActionBtn, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.white} />
                  <Text style={styles.profileActionBtnText}>Pending — Check Friends Tab</Text>
                </View>
              )}
              {pp.friendshipStatus === 'accepted' && (
                <View style={[styles.profileActionBtn, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                  <Text style={styles.profileActionBtnText}>Already Friends</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // === Zone Card ===
  const renderZoneCard = (zone: ZoneWithCounts) => {
    const isSelected = selectedZone?.id === zone.id;
    const friendsHere = getFriendsInZone(zone.id);

    return (
      <TouchableOpacity
        key={zone.id}
        style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
        onPress={() => handleZonePress(zone)}
        activeOpacity={0.7}
      >
        <View style={styles.zoneCardHeader}>
          <View style={styles.zoneCardLeft}>
            <View style={[styles.zoneMarker, { backgroundColor: getMarkerColor(zone) }]}>
              <Ionicons name={getZoneIcon(zone.id) as any} size={22} color={colors.white} />
            </View>
            <View style={styles.zoneCardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.zoneCardName} numberOfLines={1}>{zone.name}</Text>
                {zone.type === 'custom' && (
                  <View style={styles.customZoneBadge}>
                    <Text style={styles.customZoneBadgeText}>Custom</Text>
                  </View>
                )}
              </View>
              <View style={styles.zoneCardStats}>
                {zone.totalInRecess > 0 && (
                  <View style={styles.miniStat}>
                    <View style={[styles.miniDot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.miniStatText}>{zone.totalInRecess} in recess</Text>
                  </View>
                )}
                {zone.totalFree > 0 && (
                  <View style={styles.miniStat}>
                    <View style={[styles.miniDot, { backgroundColor: STATUS_COLORS.free }]} />
                    <Text style={styles.miniStatText}>{zone.totalFree} free</Text>
                  </View>
                )}
                {zone.friendsInRecess + zone.friendsFree > 0 && (
                  <View style={styles.miniStat}>
                    <View style={[styles.miniDot, { backgroundColor: colors.secondary }]} />
                    <Text style={styles.miniStatText}>
                      {zone.friendsInRecess + zone.friendsFree} friends
                    </Text>
                  </View>
                )}
                {zone.totalInRecess === 0 && zone.totalFree === 0 && (
                  <Text style={styles.emptyZoneText}>No one here yet</Text>
                )}
              </View>
            </View>
          </View>
          <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
        </View>

        {isSelected && (
          <View style={styles.zoneDetails}>
            {/* Map Widget */}
            {getZoneCoordinates(zone.id) && (
              <TouchableOpacity
                style={styles.mapWidget}
                onPress={() => {
                  const coords = getZoneCoordinates(zone.id);
                  if (coords) openInMaps(zone.name, coords.latitude, coords.longitude);
                }}
                activeOpacity={0.9}
              >
                <MapView
                  style={styles.mapView}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={{
                    latitude: getZoneCoordinates(zone.id)!.latitude,
                    longitude: getZoneCoordinates(zone.id)!.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                >
                  <Marker coordinate={getZoneCoordinates(zone.id)!} title={zone.name}>
                    <View style={[styles.mapMarker, { backgroundColor: getMarkerColor(zone) }]}>
                      <Ionicons name={getZoneIcon(zone.id) as any} size={16} color={colors.white} />
                    </View>
                  </Marker>
                </MapView>
                <View style={styles.mapOverlay}>
                  <View style={styles.openMapsButton}>
                    <Ionicons name="navigate" size={14} color={colors.white} />
                    <Text style={styles.openMapsText}>Get Directions</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Building name & address */}
            {(zone.building || zone.address) && (
              <View style={styles.locationInfoRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <View style={styles.locationInfoText}>
                  {zone.building && (
                    <Text style={styles.buildingText} numberOfLines={1}>{zone.building}</Text>
                  )}
                  {zone.address && (
                    <Text style={styles.addressText} numberOfLines={2}>{zone.address}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{zone.totalInRecess}</Text>
                <Text style={styles.statLabel}>In Recess</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{zone.totalFree}</Text>
                <Text style={styles.statLabel}>Free</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{zone.friendsInRecess + zone.friendsFree}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
            </View>

            {/* Break Types — clickable */}
            {zone.totalInRecess > 0 && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Break Types</Text>
                <View style={styles.breakdownRow}>
                  {/* Non-custom break types */}
                  {Object.entries(zone.breakTypeCounts).map(([type, count]) => {
                    if (count === 0 || type === 'custom') return null;
                    const icon = BREAK_ICON_MAP[type] || 'ellipsis-horizontal';
                    const label = BREAK_LABEL_MAP[type] || type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={styles.breakTypeItem}
                        activeOpacity={0.7}
                        onPress={() => showBreakTypeDetail(zone, type)}
                      >
                        <Ionicons name={icon as any} size={16} color={colors.text} />
                        <Text style={styles.breakTypeLabel} numberOfLines={1}>{label}</Text>
                        <Text style={styles.breakTypeCount}>{count}</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })}
                  {/* Custom breaks — each unique title gets its own group */}
                  {getCustomBreakGroups(zone).map((group) => (
                    <TouchableOpacity
                      key={`custom-${group.title}`}
                      style={styles.breakTypeItem}
                      activeOpacity={0.7}
                      onPress={() => showCustomBreakGroupDetail(zone, group.title)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.text} />
                      <Text style={styles.breakTypeLabel} numberOfLines={1}>{group.title}</Text>
                      <Text style={styles.breakTypeCount}>{group.count}</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Current user at this zone */}
            {currentRecess && currentRecess.zoneId === zone.id && (
              <View style={styles.friendsSection}>
                <Text style={styles.friendsTitle}>Your Recess</Text>
                <TouchableOpacity style={styles.friendItem} activeOpacity={0.7} onPress={() => showMyRecessDetail(zone)}>
                  <View style={[styles.friendAvatar, { backgroundColor: colors.primary }]}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.friendAvatarImg} />
                    ) : (
                      <Text style={styles.friendAvatarText}>
                        {(profile?.display_name || 'Y').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>{profile?.display_name || 'You'}</Text>
                    <Text style={[styles.friendStatus, { color: STATUS_COLORS.in_recess }]} numberOfLines={1}>
                      {currentRecess.type === 'custom' && currentRecess.customTitle
                        ? currentRecess.customTitle
                        : `${BREAK_LABEL_MAP[currentRecess.type] || currentRecess.type} recess`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Friends Here */}
            {friendsHere.length > 0 && (
              <View style={styles.friendsSection}>
                <Text style={styles.friendsTitle}>Friends Here</Text>
                {friendsHere.map((friend) => (
                  <TouchableOpacity key={friend.id} style={styles.friendItem} onPress={() => setSelectedFriend(friend)} activeOpacity={0.7}>
                    <View style={styles.friendAvatar}>
                      {friend.avatarUrl ? (
                        <Image source={{ uri: friend.avatarUrl }} style={styles.friendAvatarImg} />
                      ) : (
                        <Text style={styles.friendAvatarText}>
                          {friend.displayName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>{friend.displayName}</Text>
                      <Text style={[styles.friendStatus, { color: STATUS_COLORS[friend.status] }]} numberOfLines={1}>
                        {friend.status === 'in_recess'
                          ? friend.recessType === 'custom' && friend.customTitle
                            ? friend.customTitle
                            : `${BREAK_LABEL_MAP[friend.recessType || ''] || friend.recessType} recess`
                          : 'Available'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Public (non-friend) users — clickable to detail card */}
            {zone.publicUsers && zone.publicUsers.length > 0 && (
              <View style={styles.friendsSection}>
                <Text style={styles.friendsTitle}>Others Here</Text>
                {zone.publicUsers.map((pu) => (
                  <TouchableOpacity
                    key={pu.userId}
                    style={styles.friendItem}
                    activeOpacity={0.7}
                    onPress={() => openPublicUserProfile(pu, zone.name)}
                  >
                    <View style={[styles.friendAvatar, { backgroundColor: colors.textSecondary }]}>
                      {pu.avatarUrl ? (
                        <Image source={{ uri: pu.avatarUrl }} style={styles.friendAvatarImg} />
                      ) : (
                        <Text style={styles.friendAvatarText}>
                          {pu.displayName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>{pu.displayName}</Text>
                      <Text style={[styles.friendStatus, { color: pu.status === 'in_recess' ? STATUS_COLORS.in_recess : STATUS_COLORS.free }]}>
                        {pu.status === 'in_recess' && pu.recessType
                          ? pu.recessType === 'custom' && pu.customTitle
                            ? pu.customTitle
                            : `${BREAK_LABEL_MAP[pu.recessType] || pu.recessType} recess`
                          : 'Available'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Join Recess button — shown when people are here and user is not in recess */}
            {!currentRecess && zone.totalInRecess > 0 && (
              <TouchableOpacity
                style={styles.joinRecessButton}
                onPress={() => openJoinModal(zone)}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle" size={20} color={colors.white} />
                <Text style={styles.joinRecessButtonText}>Join Recess Here</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Campus Zones</Text>
          <TouchableOpacity onPress={loadZones} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[styles.chip, selectedZone?.id === zone.id && styles.chipSelected]}
                onPress={() => handleZonePress(zone)}
              >
                <Ionicons name={getZoneIcon(zone.id) as any} size={16} color={selectedZone?.id === zone.id ? colors.white : colors.text} />
                <Text style={[styles.chipText, selectedZone?.id === zone.id && styles.chipTextSelected]} numberOfLines={1}>
                  {zone.name}
                </Text>
                {zone.totalInRecess > 0 && (
                  <View style={styles.chipBadge}>
                    <Text style={styles.chipBadgeText}>{zone.totalInRecess}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.zoneList}
          contentContainerStyle={styles.zoneListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={32} color={colors.primary} />
            <Text style={styles.mapPlaceholderText}>Campus Map View</Text>
            <Text style={styles.mapPlaceholderHint}>Zone-based presence · No individual tracking</Text>
          </View>
          {zones.map(renderZoneCard)}
        </ScrollView>

        {/* Friend Profile Modal */}
        <FriendProfileModal
          visible={!!selectedFriend}
          onClose={() => setSelectedFriend(null)}
          friend={selectedFriend}
        />

        {/* Break Detail Card Modal */}
        {renderDetailCard()}

        {/* Public User Profile Card */}
        {renderPublicProfileCard()}

        {/* Join Recess Quick Modal */}
        <Modal visible={!!joinZone} transparent animationType="fade" onRequestClose={() => setJoinZone(null)}>
          <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={() => setJoinZone(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.joinModal}>
              {/* Header */}
              <View style={styles.joinModalHeader}>
                <View style={[styles.detailIconBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="play-circle" size={24} color={colors.white} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.joinModalTitle}>Join Recess</Text>
                  <Text style={styles.joinModalSubtitle} numberOfLines={1}>
                    at {joinZone?.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setJoinZone(null)} style={styles.detailCloseBtn}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailDivider} />

              {/* Break Type */}
              <View style={styles.joinSection}>
                <Text style={styles.joinLabel}>Break Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.joinChipsRow}>
                  {(['social', 'walk', 'gym', 'quiet', 'coffee'] as const).map(bt => (
                    <TouchableOpacity
                      key={bt}
                      style={[styles.joinChip, joinBreakType === bt && styles.joinChipSelected]}
                      onPress={() => setJoinBreakType(bt)}
                    >
                      <Ionicons name={(BREAK_ICON_MAP[bt] || 'fitness-outline') as any} size={16} color={joinBreakType === bt ? colors.white : colors.text} />
                      <Text style={[styles.joinChipText, joinBreakType === bt && styles.joinChipTextSelected]}>
                        {BREAK_LABEL_MAP[bt] || bt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Duration */}
              <View style={styles.joinSection}>
                <Text style={styles.joinLabel}>Duration</Text>
                <View style={styles.joinChipsRow}>
                  {[10, 15, 20, 30, 45, 60].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.joinChip, joinDuration === d && styles.joinChipSelected]}
                      onPress={() => setJoinDuration(d)}
                    >
                      <Text style={[styles.joinChipText, joinDuration === d && styles.joinChipTextSelected]}>
                        {d}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Visibility */}
              <View style={styles.joinSection}>
                <Text style={styles.joinLabel}>Who can see</Text>
                <View style={styles.joinChipsRow}>
                  <TouchableOpacity
                    style={[styles.joinChip, joinVisibility === 'friends' && styles.joinChipSelected]}
                    onPress={() => setJoinVisibility('friends')}
                  >
                    <Ionicons name="people" size={16} color={joinVisibility === 'friends' ? colors.white : colors.text} />
                    <Text style={[styles.joinChipText, joinVisibility === 'friends' && styles.joinChipTextSelected]}>Friends</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.joinChip, joinVisibility === 'public' && styles.joinChipSelected]}
                    onPress={() => setJoinVisibility('public')}
                  >
                    <Ionicons name="globe" size={16} color={joinVisibility === 'public' ? colors.white : colors.text} />
                    <Text style={[styles.joinChipText, joinVisibility === 'public' && styles.joinChipTextSelected]}>Public</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start button */}
              <TouchableOpacity
                style={[styles.joinStartButton, joinLoading && { opacity: 0.7 }]}
                onPress={handleJoinRecess}
                disabled={joinLoading}
                activeOpacity={0.8}
              >
                {joinLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="play" size={20} color={colors.white} />
                    <Text style={styles.joinStartButtonText}>Start Recess</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    refreshButton: { padding: 8 },
    chipsContainer: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    chipsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
    chip: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, gap: 6,
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 14, fontWeight: '500', color: colors.text },
    chipTextSelected: { color: colors.white },
    chipBadge: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 4 },
    chipBadgeText: { fontSize: 12, fontWeight: '600', color: colors.text },
    mapPlaceholder: {
      backgroundColor: colors.cardBg, borderRadius: 16, padding: 24, alignItems: 'center',
      marginBottom: 16, borderWidth: 1, borderColor: colors.border,
    },
    mapPlaceholderText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 },
    mapPlaceholderHint: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    zoneList: { flex: 1 },
    zoneListContent: { padding: 16, paddingBottom: 40 },
    zoneCard: {
      backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    zoneCardSelected: { borderColor: colors.primary, borderWidth: 2 },
    zoneCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    zoneCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    zoneMarker: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    zoneCardInfo: { flex: 1 },
    zoneCardName: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
    customZoneBadge: {
      backgroundColor: `${colors.warning}20`,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    customZoneBadgeText: { fontSize: 10, fontWeight: '600', color: colors.warning },
    zoneCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
    miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    miniDot: { width: 8, height: 8, borderRadius: 4 },
    miniStatText: { fontSize: 13, color: colors.textSecondary },
    emptyZoneText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
    zoneDetails: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
    locationInfoRow: {
      flexDirection: 'row', gap: 6,
      paddingHorizontal: 4, marginBottom: 12,
    },
    locationInfoText: { flex: 1 },
    buildingText: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
    addressText: { fontSize: 12, color: colors.textSecondary },
    statsRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
      backgroundColor: colors.background, borderRadius: 12, padding: 14, marginBottom: 14,
    },
    statItem: { alignItems: 'center', gap: 4 },
    statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    statDivider: { width: 1, height: 36, backgroundColor: colors.border },
    breakdownSection: { marginBottom: 14 },
    breakdownTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 },
    breakdownRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    breakTypeItem: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    breakTypeLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    breakTypeCount: { fontSize: 14, fontWeight: '600', color: colors.text },
    friendsSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
    friendsTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 },
    friendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    friendAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    friendAvatarText: { fontSize: 15, fontWeight: '600', color: colors.white },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 15, fontWeight: '600', color: colors.text },
    friendStatus: { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
    // Map widget styles
    mapWidget: { height: 150, borderRadius: 12, overflow: 'hidden', marginBottom: 14, position: 'relative' },
    mapView: { width: '100%', height: '100%' },
    mapMarker: {
      width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.white,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
    },
    mapOverlay: { position: 'absolute', bottom: 8, right: 8 },
    openMapsButton: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, gap: 4,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
    },
    openMapsText: { fontSize: 12, fontWeight: '600', color: colors.white },

    // === Detail Card Modal Styles ===
    detailOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    detailCard: {
      backgroundColor: colors.cardBg,
      borderRadius: 20,
      width: '100%',
      maxWidth: 380,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      gap: 14,
    },
    detailIconBadge: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailHeaderInfo: {
      flex: 1,
    },
    detailTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    detailZoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    detailZoneText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    detailCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    detailTimeSection: {
      padding: 20,
      paddingBottom: 12,
    },
    detailTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailTimeItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    detailTimeDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    detailTimeLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailTimeValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    detailElapsedRow: {
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    detailElapsedText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    detailVisibilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    detailVisibilityText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    detailPersonSection: {
      padding: 20,
      paddingTop: 12,
    },
    detailPeopleSection: {
      padding: 20,
      paddingTop: 12,
    },
    detailPeopleTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 14,
    },
    detailPersonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    detailPersonAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailPersonAvatarImg: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    detailPersonAvatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
    detailPersonInfo: {
      flex: 1,
    },
    detailPersonName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    detailPersonStatus: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    detailPersonCustomTitle: {
      fontSize: 13,
      color: colors.primary,
      marginTop: 2,
      fontStyle: 'italic',
    },
    detailPersonDescText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    detailDescriptionBox: {
      backgroundColor: colors.card + '80',
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    detailDescriptionText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    detailBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    detailBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    detailEmptySection: {
      padding: 24,
      alignItems: 'center',
      gap: 8,
    },
    detailEmptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // === Public Profile Card Styles ===
    profileCloseBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    profileAvatarSection: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    profileAvatarLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    profileAvatarLargeImg: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    profileAvatarLargeText: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.white,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    profileInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    profileInfoText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    profileActivitySection: {
      padding: 20,
    },
    profileActivityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileActivityIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileActivityInfo: {
      flex: 1,
    },
    profileActivityLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    profileActivityType: {
      fontSize: 13,
      color: colors.primary,
      marginTop: 2,
    },
    profileDescriptionBox: {
      backgroundColor: colors.card + '80',
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    profileDescriptionText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    profileLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
    },
    profileLocationText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    profileActionSection: {
      padding: 20,
      paddingTop: 12,
    },
    profileActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
    },
    profileActionBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
    // === Join Recess styles ===
    joinRecessButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 12,
    },
    joinRecessButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.white,
    },
    joinModal: {
      backgroundColor: colors.cardBg,
      borderRadius: 20,
      padding: 20,
      width: width - 40,
      maxHeight: '85%',
    },
    joinModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    joinModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    joinModalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    joinSection: {
      marginTop: 16,
    },
    joinLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    joinChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    joinChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    joinChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    joinChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    joinChipTextSelected: {
      color: colors.white,
    },
    joinStartButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      marginTop: 20,
    },
    joinStartButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.white,
    },
  });
}
