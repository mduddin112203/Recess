import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { BREAK_TYPES, BREAK_LENGTHS } from '../utils/constants';
import { BreakType } from '../types';
import { AddLocationModal } from './AddLocationModal';

interface StartRecessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function StartRecessModal({ visible, onClose }: StartRecessModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, user } = useAuth();
  const { startRecess, zones, createCustomZone } = useApp();

  const [selectedType, setSelectedType] = useState<BreakType>('social');
  const [selectedZone, setSelectedZone] = useState<string>(zones[0]?.id || '');
  const [duration, setDuration] = useState(profile?.default_break_length || 25);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareLevel, setShareLevel] = useState<'friends' | 'public'>('friends');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [pendingCustomLocation, setPendingCustomLocation] = useState<{
    name: string; address: string; lat: number; lng: number;
  } | null>(null);

  const PENDING_CUSTOM_ID = '__pending_custom__';

  const handleClose = () => {
    setSelectedType('social');
    setSelectedZone(zones[0]?.id || '');
    setDuration(profile?.default_break_length || 25);
    setCustomDuration('');
    setUseCustomDuration(false);
    setShareLevel('friends');
    setCustomTitle('');
    setCustomDescription('');
    setPendingCustomLocation(null);
    onClose();
  };

  const handleStart = async () => {
    if (selectedType === 'custom' && !customTitle.trim()) {
      Alert.alert('Error', 'Please enter a break title for custom breaks');
      return;
    }

    let finalDuration = duration;
    if (useCustomDuration && customDuration.trim()) {
      const parsed = parseInt(customDuration.trim(), 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 180) {
        Alert.alert('Error', 'Please enter a valid duration between 1 and 180 minutes');
        return;
      }
      finalDuration = parsed;
    }

    setLoading(true);

    let zoneId = selectedZone;
    let zoneName = zones.find(z => z.id === selectedZone)?.name || '';

    if (selectedZone === PENDING_CUSTOM_ID && pendingCustomLocation) {
      const expiresAt = new Date(Date.now() + finalDuration * 60000 + 300000);
      const { zoneId: newId, error: zoneErr } = await createCustomZone(pendingCustomLocation, expiresAt);
      if (zoneErr || !newId) {
        Alert.alert('Error', 'Could not create custom location. Please try again.');
        setLoading(false);
        return;
      }
      zoneId = newId;
      zoneName = pendingCustomLocation.name;
    }

    if (!zoneId || zoneId === PENDING_CUSTOM_ID) {
      Alert.alert('Error', 'Please select a zone');
      setLoading(false);
      return;
    }

    const { error } = await startRecess(selectedType, zoneId, zoneName, finalDuration, shareLevel, customTitle.trim(), customDescription.trim(), null);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      handleClose();
    }
  };

  const getZoneInfo = (zoneId: string) => {
    const zoneData = zones.find(z => z.id === zoneId);
    return {
      inRecess: zoneData?.totalInRecess || 0,
      friends: (zoneData?.friendsInRecess || 0) + (zoneData?.friendsFree || 0),
    };
  };

  const handleAddCustomLocation = (location: { name: string; address: string; lat: number; lng: number }) => {
    setPendingCustomLocation(location);
    setSelectedZone(PENDING_CUSTOM_ID);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Start Recess</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Break Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What type of break?</Text>
            <View style={styles.typeGrid}>
              {BREAK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    selectedType === type.id && styles.typeCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedType(type.id as BreakType);
                  }}
                >
                  <View style={styles.typeIcon}>
                    <Ionicons name={type.icon as any} size={24} color={selectedType === type.id ? colors.primary : colors.textSecondary} />
                  </View>
                  <Text
                    style={[
                      styles.typeLabel,
                      selectedType === type.id && styles.typeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Zone Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where are you taking a break?</Text>
            <View style={styles.zoneList}>
              {zones.map((zone) => {
                const info = getZoneInfo(zone.id);
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={[
                      styles.zoneCard,
                      selectedZone === zone.id && styles.zoneCardSelected,
                    ]}
                    onPress={() => setSelectedZone(zone.id)}
                  >
                    <View style={styles.zoneLeft}>
                      <View style={styles.zoneIcon}>
                        <Ionicons name={(zone.icon || 'location-outline') as any} size={24} color={colors.primary} />
                      </View>
                      <View style={styles.zoneInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.zoneName,
                              selectedZone === zone.id && styles.zoneNameSelected,
                              { flexShrink: 1 },
                            ]}
                            numberOfLines={1}
                          >
                            {zone.name}
                          </Text>
                          {zone.type === 'custom' && (
                            <View style={styles.customBadge}>
                              <Text style={styles.customBadgeText}>Custom</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.zoneStats}>
                          <View style={styles.zoneStat}>
                            <View style={[styles.zoneStatDot, { backgroundColor: colors.primary }]} />
                            <Text style={styles.zoneStatText}>{info.inRecess} here</Text>
                          </View>
                          {info.friends > 0 && (
                            <View style={styles.zoneStat}>
                              <View style={[styles.zoneStatDot, { backgroundColor: colors.secondary }]} />
                              <Text style={styles.zoneStatText}>{info.friends} friends</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={[
                      styles.zoneCheck,
                      selectedZone === zone.id && styles.zoneCheckSelected,
                    ]}>
                      {selectedZone === zone.id && (
                        <Ionicons name="checkmark" size={16} color={colors.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* Pending custom location (not yet saved to DB) */}
              {pendingCustomLocation && (
                <TouchableOpacity
                  style={[
                    styles.zoneCard,
                    selectedZone === PENDING_CUSTOM_ID && styles.zoneCardSelected,
                  ]}
                  onPress={() => setSelectedZone(PENDING_CUSTOM_ID)}
                >
                  <View style={styles.zoneLeft}>
                    <View style={styles.zoneIcon}>
                      <Ionicons name="location-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.zoneInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.zoneName,
                            selectedZone === PENDING_CUSTOM_ID && styles.zoneNameSelected,
                            { flexShrink: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {pendingCustomLocation.name}
                        </Text>
                        <View style={styles.customBadge}>
                          <Text style={styles.customBadgeText}>Custom</Text>
                        </View>
                      </View>
                      {/* Only show address if it differs from the name */}
                      {pendingCustomLocation.address !== pendingCustomLocation.name && (
                        <Text style={styles.zoneStatText} numberOfLines={1}>
                          {pendingCustomLocation.address}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[
                    styles.zoneCheck,
                    selectedZone === PENDING_CUSTOM_ID && styles.zoneCheckSelected,
                  ]}>
                    {selectedZone === PENDING_CUSTOM_ID && (
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              {/* Add Custom Location */}
              <TouchableOpacity
                style={styles.addLocationButton}
                onPress={() => setShowAddLocation(true)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={styles.addLocationText}>
                  {pendingCustomLocation ? 'Change Custom Location' : 'Add Custom Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AddLocationModal
            visible={showAddLocation}
            onClose={() => setShowAddLocation(false)}
            onConfirm={handleAddCustomLocation}
          />

          {/* Custom break fields (when Custom type selected) */}
          {selectedType === 'custom' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Break Title (required)</Text>
              <TextInput
                style={styles.customInput}
                placeholder="e.g., Monopoly Night"
                placeholderTextColor={colors.textSecondary}
                value={customTitle}
                onChangeText={setCustomTitle}
                autoCapitalize="words"
              />
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Description (optional)</Text>
              <TextInput
                style={[styles.customInput, styles.customInputMultiline]}
                placeholder="e.g., Dorm board games"
                placeholderTextColor={colors.textSecondary}
                value={customDescription}
                onChangeText={setCustomDescription}
                multiline
                numberOfLines={2}
              />
            </View>
          )}

          {/* Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who can see your break?</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityOption, shareLevel === 'friends' && styles.visibilityOptionSelected]}
                onPress={() => setShareLevel('friends')}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={20} color={shareLevel === 'friends' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.visibilityLabel, shareLevel === 'friends' && styles.visibilityLabelSelected]}>
                  Friends only
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityOption, shareLevel === 'public' && styles.visibilityOptionSelected]}
                onPress={() => setShareLevel('public')}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={20} color={shareLevel === 'public' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.visibilityLabel, shareLevel === 'public' && styles.visibilityLabelSelected]}>
                  Everyone nearby
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How long?</Text>
            <View style={styles.durationGrid}>
              {BREAK_LENGTHS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationCard,
                    !useCustomDuration && duration === option.value && styles.durationCardSelected,
                  ]}
                  onPress={() => { setDuration(option.value); setUseCustomDuration(false); setCustomDuration(''); }}
                >
                  <Text
                    style={[
                      styles.durationValue,
                      !useCustomDuration && duration === option.value && styles.durationValueSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.durationDesc,
                      !useCustomDuration && duration === option.value && styles.durationDescSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Custom duration input */}
            <View style={styles.customDurationRow}>
              <Text style={styles.customDurationLabel}>Or enter custom:</Text>
              <TextInput
                style={[styles.customDurationInput, useCustomDuration && styles.customDurationInputActive]}
                placeholder="mins"
                placeholderTextColor={colors.textSecondary}
                value={customDuration}
                onChangeText={(text) => {
                  setCustomDuration(text.replace(/[^0-9]/g, ''));
                  if (text.trim()) setUseCustomDuration(true);
                  else setUseCustomDuration(false);
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.customDurationUnit}>minutes</Text>
            </View>
          </View>
        </ScrollView>

        {/* Start Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.startButton, loading && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={20} color={colors.white} />
            <Text style={styles.startButtonText}>
              {loading ? 'Starting...' : 'Start Recess'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBg,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 14,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeCard: {
      width: '30%',
      flexGrow: 1,
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    typeCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    typeIcon: {
      marginBottom: 8,
    },
    typeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    typeLabelSelected: {
      color: colors.primary,
    },
    customInput: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    customInputMultiline: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    customDurationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      gap: 10,
    },
    customDurationLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    customDurationInput: {
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      width: 70,
      textAlign: 'center',
    },
    customDurationInputActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    customDurationUnit: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    visibilityRow: {
      flexDirection: 'row',
      gap: 12,
    },
    visibilityOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      padding: 14,
      borderWidth: 2,
      borderColor: colors.border,
    },
    visibilityOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    visibilityLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    visibilityLabelSelected: {
      color: colors.primary,
    },
    zoneList: {
      gap: 10,
    },
    zoneCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      padding: 14,
      borderWidth: 2,
      borderColor: colors.border,
    },
    zoneCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}08`,
    },
    zoneLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    zoneIcon: {
      marginRight: 14,
    },
    zoneInfo: {
      flex: 1,
    },
    zoneName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    zoneNameSelected: {
      color: colors.primary,
    },
    zoneStats: {
      flexDirection: 'row',
      gap: 12,
    },
    zoneStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    zoneStatDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    zoneStatText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    zoneCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    zoneCheckSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    customBadge: {
      backgroundColor: `${colors.warning}20`,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    customBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.warning,
    },
    addLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: `${colors.primary}08`,
      borderRadius: 14,
      padding: 14,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    addLocationText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    durationGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    durationCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    durationCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    durationValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    durationValueSelected: {
      color: colors.primary,
    },
    durationDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    durationDescSelected: {
      color: colors.primary,
    },
    footer: {
      padding: 20,
      paddingBottom: 34,
      backgroundColor: colors.cardBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    startButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    startButtonDisabled: {
      opacity: 0.7,
    },
    startButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.white,
    },
  });
