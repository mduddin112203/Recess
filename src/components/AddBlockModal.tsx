import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { BLOCK_TYPES } from '../utils/constants';
import { toLocalDateString, toLocalTimeString } from '../utils/dateUtils';
import { BlockType } from '../types';

const TimeField = React.memo(
  React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(
    (props, ref) => <TextInput {...props} ref={ref} />
  ),
  () => true
);

interface AddBlockModalProps {
  visible: boolean;
  onClose: () => void;
}

const DAY_OPTIONS = [
  { id: 1, short: 'M', label: 'Mon' },
  { id: 2, short: 'T', label: 'Tue' },
  { id: 3, short: 'W', label: 'Wed' },
  { id: 4, short: 'T', label: 'Thu' },
  { id: 5, short: 'F', label: 'Fri' },
  { id: 6, short: 'S', label: 'Sat' },
  { id: 0, short: 'S', label: 'Sun' },
];

export function AddBlockModal({ visible, onClose }: AddBlockModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { addScheduleBlock, addRecurringBlocks, scheduleBlocks } = useApp();

  const getDefaultStart = () => {
    const now = new Date();
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  };

  const [title, setTitle] = useState('');
  const [blockType, setBlockType] = useState<BlockType>('class');
  const [loading, setLoading] = useState(false);

  const defaultStart = getDefaultStart();
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
  const startHourVal = useRef(String(defaultStart.getHours() % 12 || 12));
  const startMinVal = useRef(String(defaultStart.getMinutes()).padStart(2, '0'));
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>(() => defaultStart.getHours() >= 12 ? 'PM' : 'AM');
  const endHourVal = useRef(String(defaultEnd.getHours() % 12 || 12));
  const endMinVal = useRef(String(defaultEnd.getMinutes()).padStart(2, '0'));
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>(() => defaultEnd.getHours() >= 12 ? 'PM' : 'AM');
  const startMinRef = useRef<TextInput>(null);
  const endMinRef = useRef<TextInput>(null);
  const [formKey, setFormKey] = useState(0);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const buildDate = (h: string, m: string, period: 'AM' | 'PM') => {
    let hour = parseInt(h, 10) || 0;
    const min = parseInt(m, 10) || 0;
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    const d = new Date();
    d.setHours(hour, min, 0, 0);
    return d;
  };



  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const selectWeekdays = () => {
    setSelectedDays([1, 2, 3, 4, 5]); // Mon-Fri
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!startHourVal.current || !endHourVal.current) {
      Alert.alert('Error', 'Please enter a valid time');
      return;
    }

    const startTime = buildDate(startHourVal.current, startMinVal.current, startPeriod);
    const endTime = buildDate(endHourVal.current, endMinVal.current, endPeriod);

    if (startTime >= endTime) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for recurring schedule');
      return;
    }

    const newStart = toLocalTimeString(startTime);
    const newEnd = toLocalTimeString(endTime);
    const targetDateStr = toLocalDateString(selectedDate);
    const targetDow = selectedDate.getDay();

    const overlapping = scheduleBlocks.filter(b => {
      if (b.end_date && b.end_date < targetDateStr) return false;
      const matchesDate = isRecurring
        ? selectedDays.includes(b.day_of_week ?? -1)
        : (b.date === targetDateStr || b.day_of_week === targetDow);
      if (!matchesDate) return false;
      return b.start_time < newEnd && b.end_time > newStart;
    });

    if (overlapping.length > 0) {
      const names = overlapping.map(b => `"${b.title}"`).join(', ');
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Schedule Conflict',
          `This overlaps with ${names}. Add anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Add Anyway', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

    setLoading(true);

    if (isRecurring && selectedDays.length > 0) {
      const { error } = await addRecurringBlocks({
        title: title.trim(),
        type: blockType,
        start_time: newStart,
        end_time: newEnd,
        days: selectedDays,
        end_date: recurringEndDate ? toLocalDateString(recurringEndDate) : null,
      });
      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const endNote = recurringEndDate ? ` until ${formatDate(recurringEndDate)}` : ' (no end date)';
        Alert.alert(
          'Schedule Added',
          `"${title.trim()}" has been added to ${selectedDays.length} days per week${endNote}.`,
          [{ text: 'Great!' }]
        );
        resetForm();
        onClose();
      }
    } else {
      const { error } = await addScheduleBlock({
        title: title.trim(),
        type: blockType,
        start_time: newStart,
        end_time: newEnd,
        date: toLocalDateString(selectedDate),
      });
      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        resetForm();
        onClose();
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setBlockType('class');
    const s = getDefaultStart();
    const e = new Date(s.getTime() + 60 * 60 * 1000);
    startHourVal.current = String(s.getHours() % 12 || 12);
    startMinVal.current = String(s.getMinutes()).padStart(2, '0');
    setStartPeriod(s.getHours() >= 12 ? 'PM' : 'AM');
    endHourVal.current = String(e.getHours() % 12 || 12);
    endMinVal.current = String(e.getMinutes()).padStart(2, '0');
    setEndPeriod(e.getHours() >= 12 ? 'PM' : 'AM');
    setSelectedDate(new Date());
    setShowDatePicker(false);
    setIsRecurring(false);
    setSelectedDays([]);
    setRecurringEndDate(null);
    setShowEndDatePicker(false);
    setFormKey(k => k + 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Schedule Block</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}

        >
          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., CS 101 Lecture"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="words"
            />
          </View>

          {/* Block Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeGrid}>
              {BLOCK_TYPES.filter(t => t.id !== 'break').map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeCard, blockType === type.id && styles.typeCardSelected]}
                  onPress={() => setBlockType(type.id as BlockType)}
                >
                  <Ionicons name={type.icon as any} size={22} color={blockType === type.id ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeLabel, blockType === type.id && styles.typeLabelSelected]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Time</Text>
            <View style={styles.timeInputRow}>
              <TimeField
                key={`sh-${formKey}`}
                style={styles.timeInput}
                defaultValue={startHourVal.current}
                onChangeText={(t: string) => { startHourVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                returnKeyType="next"
                onSubmitEditing={() => startMinRef.current?.focus()}
                placeholderTextColor={colors.textSecondary}
                placeholder="12"
              />
              <Text style={styles.timeColon}>:</Text>
              <TimeField
                key={`sm-${formKey}`}
                ref={startMinRef}
                style={styles.timeInput}
                defaultValue={startMinVal.current}
                onChangeText={(t: string) => { startMinVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholderTextColor={colors.textSecondary}
                placeholder="00"
              />
              <TouchableOpacity
                style={[styles.periodButton, startPeriod === 'AM' && styles.periodButtonActive]}
                onPress={() => setStartPeriod('AM')}
              >
                <Text style={[styles.periodText, startPeriod === 'AM' && styles.periodTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, startPeriod === 'PM' && styles.periodButtonActive]}
                onPress={() => setStartPeriod('PM')}
              >
                <Text style={[styles.periodText, startPeriod === 'PM' && styles.periodTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Time</Text>
            <View style={styles.timeInputRow}>
              <TimeField
                key={`eh-${formKey}`}
                style={styles.timeInput}
                defaultValue={endHourVal.current}
                onChangeText={(t: string) => { endHourVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                returnKeyType="next"
                onSubmitEditing={() => endMinRef.current?.focus()}
                placeholderTextColor={colors.textSecondary}
                placeholder="12"
              />
              <Text style={styles.timeColon}>:</Text>
              <TimeField
                key={`em-${formKey}`}
                ref={endMinRef}
                style={styles.timeInput}
                defaultValue={endMinVal.current}
                onChangeText={(t: string) => { endMinVal.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholderTextColor={colors.textSecondary}
                placeholder="00"
              />
              <TouchableOpacity
                style={[styles.periodButton, endPeriod === 'AM' && styles.periodButtonActive]}
                onPress={() => setEndPeriod('AM')}
              >
                <Text style={[styles.periodText, endPeriod === 'AM' && styles.periodTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, endPeriod === 'PM' && styles.periodButtonActive]}
                onPress={() => setEndPeriod('PM')}
              >
                <Text style={[styles.periodText, endPeriod === 'PM' && styles.periodTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date (only for single / non-recurring blocks) */}
          {!isRecurring && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => {
                setShowEndDatePicker(false);
                setShowDatePicker(prev => !prev);
              }}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.dateValue}>{formatDate(selectedDate)}</Text>
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
          )}

          {/* Recurring Toggle */}
          <View style={styles.inputGroup}>
            <TouchableOpacity 
              style={[styles.recurringToggle, isRecurring && styles.recurringToggleActive]}
              onPress={() => setIsRecurring(!isRecurring)}
              activeOpacity={0.7}
            >
              <View style={styles.recurringToggleLeft}>
                <Ionicons 
                  name="repeat" 
                  size={20} 
                  color={isRecurring ? colors.primary : colors.textSecondary} 
                />
                <View>
                  <Text style={[styles.recurringToggleTitle, isRecurring && { color: colors.primary }]}>
                    Repeat Weekly
                  </Text>
                  <Text style={styles.recurringToggleHint}>
                    Same time every week for the semester
                  </Text>
                </View>
              </View>
              <View style={[styles.checkbox, isRecurring && styles.checkboxActive]}>
                {isRecurring && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
            </TouchableOpacity>

            {/* Day Selection */}
            {isRecurring && (
              <View style={styles.daySection}>
                <View style={styles.daySectionHeader}>
                  <Text style={styles.dayLabel}>Select Days</Text>
                  <TouchableOpacity onPress={selectWeekdays}>
                    <Text style={styles.weekdaysButton}>Weekdays</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dayGrid}>
                  {DAY_OPTIONS.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <TouchableOpacity
                        key={day.id}
                        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                        onPress={() => toggleDay(day.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* End Date for recurring */}
            {isRecurring && (
              <View style={styles.daySection}>
                <Text style={styles.dayLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowEndDatePicker(prev => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={recurringEndDate ? 'calendar' : 'infinite-outline'} size={18} color={recurringEndDate ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.dateValue, recurringEndDate && { color: colors.primary }]}>
                    {recurringEndDate ? formatDate(recurringEndDate) : 'Repeats Forever'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {recurringEndDate && (
                  <TouchableOpacity
                    onPress={() => { setRecurringEndDate(null); setShowEndDatePicker(false); }}
                    style={styles.removeEndDateBtn}
                  >
                    <Ionicons name="close-circle" size={14} color={colors.error} />
                    <Text style={styles.removeEndDateText}>Remove End Date</Text>
                  </TouchableOpacity>
                )}
                {showEndDatePicker && Platform.OS === 'ios' && (
                  <View style={styles.calendarContainer}>
                    <View style={styles.calendarHeader}>
                      <Text style={styles.calendarHeaderTitle}>End Date</Text>
                      <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                        <Text style={styles.calendarDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={recurringEndDate || new Date(Date.now() + 150 * 24 * 60 * 60 * 1000)}
                      mode="date"
                      display="inline"
                      themeVariant={isDark ? 'dark' : 'light'}
                      minimumDate={new Date()}
                      accentColor={colors.primary}
                      onChange={(_, date) => {
                        if (date) setRecurringEndDate(date);
                      }}
                      style={{ height: 340, alignSelf: 'center' }}
                    />
                  </View>
                )}
                {showEndDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={recurringEndDate || new Date(Date.now() + 150 * 24 * 60 * 60 * 1000)}
                    mode="date"
                    display="default"
                    themeVariant={isDark ? 'dark' : 'light'}
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                      setShowEndDatePicker(false);
                      if (date) setRecurringEndDate(date);
                    }}
                  />
                )}
              </View>
            )}
          </View>

        </ScrollView>

        {/* Add Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addButton, loading && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={loading}
          >
            <Text style={styles.addButtonText}>
              {loading ? 'Adding...' : isRecurring ? 'Add to Semester Schedule' : 'Add to Schedule'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
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
    scrollView: { flex: 1 },
    content: { padding: 20 },
    inputGroup: { marginBottom: 24 },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    input: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 2,
      borderColor: colors.border,
    },
    typeCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    typeIcon: { },
    typeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    typeLabelSelected: { color: colors.primary },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateValue: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    removeEndDateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    removeEndDateText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.error,
    },
    endDatePickerContainer: {
      marginTop: 10,
    },
    endDateDoneBtn: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    endDateDoneText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 16,
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
    recurringToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    recurringToggleActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}08`,
    },
    recurringToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    recurringToggleTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    recurringToggleHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    daySection: {
      marginTop: 12,
    },
    daySectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    dayLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    weekdaysButton: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    dayGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    dayChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.cardBg,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    dayChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    dayChipTextSelected: {
      color: colors.white,
    },
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
    footer: {
      padding: 20,
      paddingBottom: 34,
      backgroundColor: colors.cardBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: { opacity: 0.7 },
    addButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
  });
