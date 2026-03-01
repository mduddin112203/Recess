import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { BREAK_LENGTHS } from '../utils/constants';
import { toLocalDateString, toLocalTimeString, localDateTimeFromStrings } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { scheduleBreakReminder } from '../utils/notifications';
import { AddLocationModal } from './AddLocationModal';

const TimeField = React.memo(
  React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(
    (props, ref) => <TextInput {...props} ref={ref} />
  ),
  () => true
);

interface ScheduleBreakModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function ScheduleBreakModal({ visible, onClose, onCreated }: ScheduleBreakModalProps) {
  const { user } = useAuth();
  const { scheduleBlocks, scheduledBreaks, zones, createCustomZone, loadZones } = useApp();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const now = new Date();
  const timeHourVal = useRef(String(now.getHours() % 12 || 12));
  const timeMinVal = useRef(String(now.getMinutes()).padStart(2, '0'));
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>(() => now.getHours() >= 12 ? 'PM' : 'AM');
  const timeMinRef = useRef<TextInput>(null);
  const [formKey, setFormKey] = useState(0);
  const [duration, setDuration] = useState(25);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'friends' | 'public'>('friends');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [pendingCustomLocation, setPendingCustomLocation] = useState<{
    name: string; address: string; lat: number; lng: number;
  } | null>(null);

  const buildTime = (h: string, m: string, period: 'AM' | 'PM') => {
    let hour = parseInt(h, 10) || 0;
    const min = parseInt(m, 10) || 0;
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    const d = new Date();
    d.setHours(hour, min, 0, 0);
    return d;
  };

  const PENDING_CUSTOM_ID = '__pending_custom__';

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setSelectedDate(new Date());
    const n = new Date();
    timeHourVal.current = String(n.getHours() % 12 || 12);
    timeMinVal.current = String(n.getMinutes()).padStart(2, '0');
    setTimePeriod(n.getHours() >= 12 ? 'PM' : 'AM');
    setFormKey(k => k + 1);
    setDuration(25);
    setSelectedZone(null);
    setVisibility('friends');
    setPendingCustomLocation(null);
    onClose();
  };

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const handleAddCustomLocation = (location: { name: string; address: string; lat: number; lng: number }) => {
    setPendingCustomLocation(location);
    setSelectedZone(PENDING_CUSTOM_ID);
  };

  const handleSchedule = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your break.');
      return;
    }
    if (!selectedZone || (selectedZone === PENDING_CUSTOM_ID && !pendingCustomLocation)) {
      Alert.alert('Error', 'Please select a zone.');
      return;
    }

    const startTime = buildTime(timeHourVal.current, timeMinVal.current, timePeriod);

    const breakStartDate = localDateTimeFromStrings(
      toLocalDateString(selectedDate),
      toLocalTimeString(startTime)
    );
    if (breakStartDate.getTime() < Date.now()) {
      Alert.alert('Invalid Time', 'Please select a future time for today, or pick a later date.');
      return;
    }

    const newStart = toLocalTimeString(startTime);
    const endMinutes = Math.min(startTime.getHours() * 60 + startTime.getMinutes() + duration, 1439);
    const newEnd = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
    const dateStr_ = toLocalDateString(selectedDate);
    const dow = selectedDate.getDay();

    const overlappingBlocks = scheduleBlocks.filter(b => {
      if (b.end_date && b.end_date < dateStr_) return false;
      const matchesDate = b.date === dateStr_ || b.day_of_week === dow;
      if (!matchesDate) return false;
      return b.start_time < newEnd && b.end_time > newStart;
    });
    const overlappingBreaks = scheduledBreaks.filter(sb => {
      if (sb.date !== dateStr_) return false;
      const sbEndMin = Math.min(
        parseInt(sb.start_time.split(':')[0]) * 60 + parseInt(sb.start_time.split(':')[1]) + sb.duration,
        1439
      );
      const sbEnd = `${Math.floor(sbEndMin / 60).toString().padStart(2, '0')}:${(sbEndMin % 60).toString().padStart(2, '0')}`;
      return sb.start_time < newEnd && sbEnd > newStart;
    });

    const allOverlaps = [
      ...overlappingBlocks.map(b => `"${b.title}"`),
      ...overlappingBreaks.map(b => `"${b.title}"`),
    ];
    if (allOverlaps.length > 0) {
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Schedule Conflict',
          `This overlaps with ${allOverlaps.join(', ')}. Schedule anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Schedule Anyway', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const dateStr = toLocalDateString(selectedDate);
      const timeStr = toLocalTimeString(startTime);

      let finalZoneId = selectedZone;
      if (selectedZone === PENDING_CUSTOM_ID && pendingCustomLocation) {
        const breakStart = localDateTimeFromStrings(dateStr, timeStr);
        const expiresAt = new Date(breakStart.getTime() + duration * 60000 + 300000);
        const { zoneId: newId, error: zoneErr } = await createCustomZone(pendingCustomLocation, expiresAt);
        if (zoneErr || !newId) {
          Alert.alert('Error', 'Could not create custom location. Please try again.');
          setSaving(false);
          return;
        }
        finalZoneId = newId;
      }

      const { error } = await supabase.from('scheduled_breaks').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        zone_id: finalZoneId,
        date: dateStr,
        start_time: timeStr,
        duration,
        visibility,
      });

      if (error) throw error;

      const breakStartDate = localDateTimeFromStrings(dateStr, toLocalTimeString(startTime));
      scheduleBreakReminder(title.trim(), breakStartDate).catch(console.error);

      await loadZones();

      Alert.alert('Scheduled!', 'Your break has been added to your calendar.');
      onCreated?.();
      handleClose();
    } catch (error) {
      console.error('Error scheduling break:', error);
      Alert.alert('Error', 'Could not schedule the break. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule Break</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Coffee with friends"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Add notes..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => {
              setShowDatePicker(prev => !prev);
            }}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.pickerText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarHeaderTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.calendarDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  minimumDate={new Date()}
                  accentColor={colors.primary}
                  onChange={(_, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (date) setSelectedDate(date);
                  }}
                  style={Platform.OS === 'ios' ? { height: 340, alignSelf: 'center' } : undefined}
                />
              </View>
            )}
          </View>

          {/* Start Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Time</Text>
            <View style={styles.timeInputRow}>
              <TimeField
                key={`th-${formKey}`}
                style={styles.timeInput}
                defaultValue={timeHourVal.current}
                onChangeText={(t: string) => { timeHourVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                returnKeyType="next"
                onSubmitEditing={() => timeMinRef.current?.focus()}
                placeholderTextColor={colors.textSecondary}
                placeholder="12"
              />
              <Text style={styles.timeColon}>:</Text>
              <TimeField
                key={`tm-${formKey}`}
                ref={timeMinRef}
                style={styles.timeInput}
                defaultValue={timeMinVal.current}
                onChangeText={(t: string) => { timeMinVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholderTextColor={colors.textSecondary}
                placeholder="00"
              />
              <TouchableOpacity
                style={[styles.periodButton, timePeriod === 'AM' && styles.periodButtonActive]}
                onPress={() => setTimePeriod('AM')}
              >
                <Text style={[styles.periodText, timePeriod === 'AM' && styles.periodTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, timePeriod === 'PM' && styles.periodButtonActive]}
                onPress={() => setTimePeriod('PM')}
              >
                <Text style={[styles.periodText, timePeriod === 'PM' && styles.periodTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.optionsRow}>
              {BREAK_LENGTHS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionChip, duration === opt.value && styles.optionChipActive]}
                  onPress={() => setDuration(opt.value)}
                >
                  <Text style={[styles.optionChipText, duration === opt.value && styles.optionChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zone</Text>
            <View style={styles.optionsRow}>
              {zones.map(zone => (
                <TouchableOpacity
                  key={zone.id}
                  style={[styles.optionChip, selectedZone === zone.id && styles.optionChipActive]}
                  onPress={() => setSelectedZone(zone.id)}
                >
                  <Ionicons
                    name={(zone.icon || 'location-outline') as any}
                    size={14}
                    color={selectedZone === zone.id ? colors.white : colors.text}
                  />
                  <Text style={[styles.optionChipText, selectedZone === zone.id && styles.optionChipTextActive]}>
                    {zone.name}
                  </Text>
                  {zone.type === 'custom' && selectedZone !== zone.id && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Custom</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {pendingCustomLocation && (
                <TouchableOpacity
                  style={[styles.optionChip, selectedZone === PENDING_CUSTOM_ID && styles.optionChipActive, { maxWidth: '100%' }]}
                  onPress={() => setSelectedZone(PENDING_CUSTOM_ID)}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={selectedZone === PENDING_CUSTOM_ID ? colors.white : colors.text}
                  />
                  <Text
                    style={[styles.optionChipText, selectedZone === PENDING_CUSTOM_ID && styles.optionChipTextActive, { flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {pendingCustomLocation.name}
                  </Text>
                  {selectedZone !== PENDING_CUSTOM_ID && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Custom</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.addLocationChip}
                onPress={() => setShowAddLocation(true)}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addLocationChipText}>
                  {pendingCustomLocation ? 'Change Location' : 'Custom Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AddLocationModal
            visible={showAddLocation}
            onClose={() => setShowAddLocation(false)}
            onConfirm={handleAddCustomLocation}
          />

          {/* Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionChip, visibility === 'friends' && styles.optionChipActive]}
                onPress={() => setVisibility('friends')}
              >
                <Ionicons name="people" size={14} color={visibility === 'friends' ? colors.white : colors.text} />
                <Text style={[styles.optionChipText, visibility === 'friends' && styles.optionChipTextActive]}>Friends Only</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionChip, visibility === 'public' && styles.optionChipActive]}
                onPress={() => setVisibility('public')}
              >
                <Ionicons name="globe" size={14} color={visibility === 'public' ? colors.white : colors.text} />
                <Text style={[styles.optionChipText, visibility === 'public' && styles.optionChipTextActive]}>Public</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, saving && { opacity: 0.6 }]}
            onPress={handleSchedule}
            disabled={saving}
          >
            <Ionicons name="calendar" size={20} color={colors.white} />
            <Text style={styles.submitText}>{saving ? 'Scheduling...' : 'Schedule Break'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.cardBg,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
    input: {
      backgroundColor: colors.cardBg, borderRadius: 12, padding: 14, fontSize: 16,
      color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    pickerButton: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.cardBg, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    pickerText: { fontSize: 16, fontWeight: '500', color: colors.text },
    calendarContainer: {
      marginTop: 10,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#1c2333' : '#ffffff',
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    calendarHeaderTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    calendarDoneText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    timeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeInput: {
      width: 52,
      height: 48,
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    timeColon: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    periodButton: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    periodTextActive: {
      color: '#ffffff',
    },
    optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
      backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    },
    optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionChipText: { fontSize: 14, fontWeight: '500', color: colors.text },
    optionChipTextActive: { color: colors.white },
    customBadge: {
      backgroundColor: `${colors.warning}20`,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    customBadgeText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.warning,
    },
    addLocationChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
      borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    },
    addLocationChipText: {
      fontSize: 14, fontWeight: '500', color: colors.primary,
    },
    submitButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary, borderRadius: 14, padding: 18, marginTop: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    submitText: { fontSize: 17, fontWeight: '700', color: colors.white },
  });
