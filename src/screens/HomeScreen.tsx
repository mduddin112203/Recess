import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { BLOCK_TYPES } from '../utils/constants';
import { calculateBurnoutRisk, calculateBurnoutRiskWithAI, formatTime, formatDuration } from '../utils/burnoutEngine';
import { generateBreakSuggestion } from '../lib/grok';
import { StartRecessModal } from '../components/StartRecessModal';
import { AddBlockModal } from '../components/AddBlockModal';
import { BreakPlannerModal } from '../components/BreakPlannerModal';
import { ScheduleBreakModal } from '../components/ScheduleBreakModal';
import { ScheduleDetailModal, DetailItem } from '../components/ScheduleDetailModal';
import { BurnoutRisk, ScheduledBreak } from '../types';
import { toLocalDateString } from '../utils/dateUtils';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

interface HomeScreenProps {
  onOpenProfile?: () => void;
}

export function HomeScreen({ onOpenProfile }: HomeScreenProps) {
  const { profile } = useAuth();
  const { 
    scheduleBlocks, 
    currentRecess, 
    endRecess, 
    deleteScheduleBlock, 
    weeklyPoints,
    todayBreaksCount,
    loadScheduleBlocks,
    breakHistory,
    loadBreakHistory,
    scheduledBreaks,
    loadScheduledBreaks,
    deleteScheduledBreak,
    friends,
    sendBreakInvitation,
    breakInvitations,
    respondToInvitation,
    loadBreakInvitations,
    zones,
  } = useApp();
  const { colors } = useTheme();
  
  const [showStartRecess, setShowStartRecess] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [showBreakPlanner, setShowBreakPlanner] = useState(false);
  const [showScheduleBreak, setShowScheduleBreak] = useState(false);
  const [inviteBreakId, setInviteBreakId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [burnoutRisk, setBurnoutRisk] = useState<BurnoutRisk>({ level: 'low', reason: 'Loading...' });
  const [breakTip, setBreakTip] = useState<string | null>(null);
  const burnoutCallRef = useRef(0);
  const lastBlocksHashRef = useRef('');
  
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const currentWeekStart = getWeekStart(today);
  const viewingWeekStart = new Date(currentWeekStart);
  viewingWeekStart.setDate(viewingWeekStart.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(viewingWeekStart);
  
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDay = selectedDate.getDay();

  useEffect(() => {
    const dateStr = toLocalDateString(selectedDate);
    loadBreakHistory(dateStr);
  }, [selectedDate, loadBreakHistory]);

  useEffect(() => {
    const todayBlocks = getBlocksForDay();
    const blocksHash = JSON.stringify(todayBlocks.map(b => `${b.start_time}-${b.end_time}`));
    if (blocksHash === lastBlocksHashRef.current) return;
    lastBlocksHashRef.current = blocksHash;

    const quickRisk = calculateBurnoutRisk(todayBlocks);
    setBurnoutRisk(quickRisk);

    const callId = ++burnoutCallRef.current;
    const timer = setTimeout(async () => {
      if (callId !== burnoutCallRef.current) return;
      try {
        const aiRisk = await calculateBurnoutRiskWithAI(todayBlocks);
        if (callId === burnoutCallRef.current) {
          setBurnoutRisk(aiRisk);
        }
      } catch {}
    }, 500);

    return () => clearTimeout(timer);
  }, [scheduleBlocks]);

  useEffect(() => {
    if (!currentRecess) {
      setBreakTip(null);
      return;
    }
    let cancelled = false;
    generateBreakSuggestion(currentRecess.type, currentRecess.duration)
      .then(tip => { if (!cancelled) setBreakTip(tip); })
      .catch(() => { if (!cancelled) setBreakTip(null); });
    return () => { cancelled = true; };
  }, [currentRecess?.type]);

  useEffect(() => {
    if (!currentRecess) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - currentRecess.startTime;
      const remaining = currentRecess.duration * 60 - Math.floor(elapsed / 1000);
      
      if (remaining <= 0) {
        handleEndRecess();
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentRecess]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadScheduleBlocks(),
      loadScheduledBreaks(),
      loadBreakHistory(toLocalDateString(selectedDate)),
      loadBreakInvitations(),
    ]);
    setRefreshing(false);
  }, [loadScheduleBlocks, loadScheduledBreaks, loadBreakHistory, loadBreakInvitations, selectedDate]);

  const handleEndRecess = async () => {
    const { pointsAwarded } = await endRecess();
    if (pointsAwarded > 0) {
      Alert.alert(
        'Recess Complete',
        `Great job taking a break! You earned ${pointsAwarded} points.`,
        [{ text: 'Nice!' }]
      );
    }
  };

  const getBlocksForDay = (forDate?: Date) => {
    const d = forDate || new Date();
    const dateStr = toLocalDateString(d);
    const dow = d.getDay();

    return scheduleBlocks
      .filter((b) => {
        if (b.day_of_week != null) {
          if (b.day_of_week !== dow) return false;
          if (b.end_date && dateStr > b.end_date) return false;
          return true;
        }
        return b.date === dateStr;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getScheduledBreaksForDate = (date: Date): ScheduledBreak[] => {
    const dateStr = toLocalDateString(date);
    return scheduledBreaks
      .filter(b => b.date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const displayBlocks = getBlocksForDay(selectedDate);
  const displayScheduledBreaks = getScheduledBreaksForDate(selectedDate);
  const nonBreakBlocks = displayBlocks.filter((b) => b.type !== 'break');

  const getRiskColor = () => {
    switch (burnoutRisk.level) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.success;
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  const getBlockTypeInfo = (type: string) => {
    return BLOCK_TYPES.find((t) => t.id === type) || BLOCK_TYPES[4];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/Mainlogoblue.png')} style={styles.headerLogoImg} resizeMode="contain" />
        </View>
        <TouchableOpacity 
          style={styles.headerProfile} 
          onPress={onOpenProfile}
          activeOpacity={0.7}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.headerProfileImage} />
          ) : (
            <Text style={styles.headerProfileText}>
              {profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Hey, {profile?.display_name?.split(' ')[0] || 'there'}!
          </Text>
          <Text style={styles.welcomeSubtext}>Let's keep burnout away today.</Text>
        </View>

        {/* Burnout Risk Card */}
        <View style={[styles.riskCard, { borderColor: getRiskColor() }]}>
          <View style={styles.riskHeader}>
            <View style={[styles.riskIndicator, { backgroundColor: getRiskColor() }]}>
              <Ionicons
                name={burnoutRisk.level === 'high' ? 'warning' : burnoutRisk.level === 'medium' ? 'alert-circle' : 'checkmark-circle'}
                size={20}
                color={colors.white}
              />
            </View>
            <View style={styles.riskInfo}>
              <Text style={[styles.riskLevel, { color: getRiskColor() }]}>
                {burnoutRisk.level.toUpperCase()} RISK
              </Text>
              <Text style={styles.riskReason} numberOfLines={3}>{burnoutRisk.reason}</Text>
            </View>
          </View>
        </View>

        {/* Active Recess Timer */}
        {currentRecess && timeRemaining !== null && (
          <View style={styles.recessCard}>
            <View style={styles.recessHeader}>
              <View style={styles.recessPulse} />
              <Text style={styles.recessLabel}>Recess in Progress</Text>
            </View>
            <Text style={styles.recessTimer}>{formatDuration(timeRemaining)}</Text>
            <Text style={styles.recessInfo} numberOfLines={1}>
              {currentRecess.type.charAt(0).toUpperCase() + currentRecess.type.slice(1)} · {currentRecess.zoneName}
            </Text>
            {breakTip && (
              <View style={styles.breakTipRow}>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
                <Text style={styles.breakTipText} numberOfLines={2}>{breakTip}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.endEarlyButton} onPress={handleEndRecess}>
              <Ionicons name="stop" size={18} color={colors.white} />
              <Text style={styles.endEarlyText}>End Early</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Start Recess Button */}
        {!currentRecess && (
          <TouchableOpacity
            style={styles.startRecessButton}
            onPress={() => setShowStartRecess(true)}
            activeOpacity={0.8}
          >
            <View style={styles.startRecessIcon}>
              <Ionicons name="play" size={24} color={colors.white} />
            </View>
            <View style={styles.startRecessContent}>
              <Text style={styles.startRecessText}>Start Recess</Text>
              <Text style={styles.startRecessHint}>Take a break, you deserve it</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.white} />
          </TouchableOpacity>
        )}

        {/* Schedule Break Button */}
        {!currentRecess && (
          <TouchableOpacity
            style={styles.scheduleBreakButton}
            onPress={() => setShowScheduleBreak(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.scheduleBreakText}>Schedule a Break</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Weekly Points */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsLeft}>
            <Ionicons name="trophy" size={24} color={colors.warning} />
            <View style={styles.pointsInfo}>
              <Text style={styles.pointsValue}>{weeklyPoints}</Text>
              <Text style={styles.pointsLabel}>points this week</Text>
            </View>
          </View>
          <View style={styles.pointsDivider} />
          <View style={styles.pointsRight}>
            <Text style={styles.streakValue}>{todayBreaksCount}</Text>
            <Text style={styles.streakLabel}>breaks today</Text>
          </View>
        </View>

        {/* Calendar View Toggle */}
        <View style={styles.calendarToggleRow}>
          <TouchableOpacity
            style={[styles.calendarToggleBtn, calendarView === 'week' && styles.calendarToggleBtnActive]}
            onPress={() => setCalendarView('week')}
            activeOpacity={0.7}
          >
            <Text style={[styles.calendarToggleText, calendarView === 'week' && styles.calendarToggleTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.calendarToggleBtn, calendarView === 'month' && styles.calendarToggleBtnActive]}
            onPress={() => setCalendarView('month')}
            activeOpacity={0.7}
          >
            <Text style={[styles.calendarToggleText, calendarView === 'month' && styles.calendarToggleTextActive]}>Month</Text>
          </TouchableOpacity>
        </View>

        {calendarView === 'week' ? (
        <View style={styles.weekCalendarContainer}>
          {/* Week Header with Navigation */}
          <View style={styles.weekHeader}>
            <TouchableOpacity 
              onPress={() => setWeekOffset(prev => prev - 1)} 
              style={styles.weekNavButton}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setWeekOffset(0); setSelectedDate(today); }}
              activeOpacity={0.7}
            >
              <Text style={styles.weekLabel}>
                {weekOffset === 0 ? 'This Week' : 
                 weekOffset === 1 ? 'Next Week' : 
                 weekOffset === -1 ? 'Last Week' : 
                 `${MONTH_NAMES[weekDays[0].getMonth()]} ${weekDays[0].getDate()} - ${MONTH_NAMES[weekDays[6].getMonth()]} ${weekDays[6].getDate()}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setWeekOffset(prev => prev + 1)} 
              style={styles.weekNavButton}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Day Cells */}
          <View style={styles.weekDaysRow}>
            {weekDays.map((day, idx) => {
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isToday = day.toDateString() === today.toDateString();
              const dayBlocks = getBlocksForDay(day);
              const dayScheduled = getScheduledBreaksForDate(day);
              const totalCount = dayBlocks.length + dayScheduled.length;
              const hasBlocks = totalCount > 0;
              const blockCount = totalCount;
              
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.weekDayCell,
                    isSelected && styles.weekDayCellSelected,
                    isToday && !isSelected && styles.weekDayCellToday,
                  ]}
                  onPress={() => setSelectedDate(new Date(day))}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.weekDayLabel,
                    isSelected && styles.weekDayLabelSelected,
                    isToday && !isSelected && styles.weekDayLabelToday,
                  ]}>
                    {DAY_LABELS[day.getDay()]}
                  </Text>
                  <Text style={[
                    styles.weekDayDate,
                    isSelected && styles.weekDayDateSelected,
                    isToday && !isSelected && styles.weekDayDateToday,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {hasBlocks && (
                    <View style={styles.weekDayDots}>
                      {blockCount <= 3 ? (
                        Array.from({ length: Math.min(blockCount, 3) }).map((_, i) => (
                          <View key={i} style={[
                            styles.weekDayDot,
                            isSelected && styles.weekDayDotSelected,
                          ]} />
                        ))
                      ) : (
                        <Text style={[
                          styles.weekDayDotCount,
                          isSelected && styles.weekDayDotCountSelected,
                        ]}>{blockCount}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        ) : (
        /* Month Calendar */
        (() => {
          const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
          const year = viewMonth.getFullYear();
          const month = viewMonth.getMonth();
          const firstDayOfMonth = new Date(year, month, 1);
          const lastDayOfMonth = new Date(year, month + 1, 0);
          const startDow = firstDayOfMonth.getDay();
          const daysInMonth = lastDayOfMonth.getDate();

          // Build grid: 6 rows x 7 cols
          const cells: (Date | null)[] = [];
          for (let i = 0; i < startDow; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
          while (cells.length % 7 !== 0) cells.push(null);

          const weeks: (Date | null)[][] = [];
          for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

          return (
            <View style={styles.weekCalendarContainer}>
              {/* Month Header */}
              <View style={styles.weekHeader}>
                <TouchableOpacity onPress={() => setMonthOffset(p => p - 1)} style={styles.weekNavButton} activeOpacity={0.6}>
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setMonthOffset(0); setSelectedDate(today); }} activeOpacity={0.7}>
                  <Text style={styles.weekLabel}>
                    {MONTH_NAMES[month]} {year}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMonthOffset(p => p + 1)} style={styles.weekNavButton} activeOpacity={0.6}>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Day-of-week headers */}
              <View style={styles.monthDowRow}>
                {DAY_LABELS.map(label => (
                  <Text key={label} style={styles.monthDowLabel}>{label}</Text>
                ))}
              </View>

              {/* Month grid */}
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.monthWeekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={styles.monthDayCell} />;
                    const isSelected = day.toDateString() === selectedDate.toDateString();
                    const isTodayCell = day.toDateString() === today.toDateString();
                    const dayBlocks = getBlocksForDay(day);
                    const dayScheduled = getScheduledBreaksForDate(day);
                    const hasItems = dayBlocks.length + dayScheduled.length > 0;

                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          styles.monthDayCell,
                          isSelected && styles.monthDayCellSelected,
                          isTodayCell && !isSelected && styles.monthDayCellToday,
                        ]}
                        onPress={() => setSelectedDate(new Date(day))}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.monthDayText,
                          isSelected && styles.monthDayTextSelected,
                          isTodayCell && !isSelected && styles.monthDayTextToday,
                        ]}>
                          {day.getDate()}
                        </Text>
                        {hasItems && (
                          <View style={[styles.monthDayDot, isSelected && styles.monthDayDotSelected]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })()
        )}

        {/* Schedule */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleTitleRow}>
            <Text style={styles.sectionTitle}>
              {selectedDate.toDateString() === today.toDateString() 
                ? "Today's Schedule" 
                : `${DAY_LABELS[selectedDay]}, ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getDate()}`}
            </Text>
            <TouchableOpacity
              style={styles.addBlockButton}
              onPress={() => setShowAddBlock(true)}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addBlockText}>Add</Text>
            </TouchableOpacity>
          </View>

          {displayBlocks.length === 0 && displayScheduledBreaks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No schedule yet</Text>
              <Text style={styles.emptyText}>
                Add your classes and study blocks to get personalized break recommendations.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowAddBlock(true)}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.emptyButtonText}>Add your first block</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.blocksList}>
              {displayBlocks.map((block, index) => {
                const typeInfo = getBlockTypeInfo(block.type);
                const isBreak = block.type === 'break';
                const isRecurring = block.day_of_week != null;
                
                return (
                  <View key={block.id} style={styles.blockWrapper}>
                    {index > 0 && <View style={styles.timelineConnector} />}
                    
                    <TouchableOpacity
                      style={[styles.blockCard, isBreak && styles.breakCard]}
                      onPress={() => setDetailItem({ kind: 'block', data: block })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.blockDot, isBreak && styles.breakDot]} />
                      <View style={styles.blockTime}>
                        <Text style={styles.blockTimeText}>{formatTime(block.start_time)}</Text>
                        <Text style={styles.blockTimeDash}>-</Text>
                        <Text style={styles.blockTimeText}>{formatTime(block.end_time)}</Text>
                      </View>
                      <View style={styles.blockInfo}>
                        <View style={styles.blockTitleRow}>
                          <Ionicons name={typeInfo.icon as any} size={14} color={isBreak ? colors.primary : colors.textSecondary} />
                          <Text style={[styles.blockTitle, isBreak && styles.breakTitle]} numberOfLines={1}> {block.title}</Text>
                        </View>
                        <View style={styles.blockBadgeRow}>
                          <View style={[styles.blockBadge, isBreak && styles.breakBadge]}>
                            <Text style={[styles.blockBadgeText, isBreak && styles.breakBadgeText]}>
                              {typeInfo.label}
                            </Text>
                          </View>
                          {isRecurring && (
                            <View style={styles.recurringBadge}>
                              <Ionicons name="repeat" size={10} color={colors.secondary} />
                              <Text style={styles.recurringBadgeText}>Weekly</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBlockButton}
                        onPress={() => deleteScheduleBlock(block.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Scheduled Breaks for this day */}
          {displayScheduledBreaks.length > 0 && (
            <View style={styles.scheduledBreaksSection}>
              <Text style={styles.scheduledBreaksSectionTitle}>Scheduled Breaks</Text>
              {displayScheduledBreaks.map((sb) => {
                const zoneName = zones.find(z => z.id === sb.zone_id)?.name || '';
                // Get attendees for this break
                const sbInvitations = breakInvitations.filter(inv => inv.break_id === sb.id);
                const acceptedNames = sbInvitations
                  .filter(inv => inv.status === 'accepted')
                  .map(inv => {
                    const invitee = friends.find(fr => fr.id === inv.invitee_id);
                    if (invitee) return invitee.displayName;
                    if (inv.invitee_id === profile?.id) return null;
                    return 'Someone';
                  })
                  .filter((name): name is string => !!name);
                const pendingCount = sbInvitations.filter(inv => inv.status === 'pending').length;
                const isInvitedBreak = !!profile?.id && sb.user_id !== profile.id;
                const hostName = isInvitedBreak
                  ? friends.find(f => f.id === sb.user_id)?.displayName
                    || sbInvitations.find(inv => inv.inviter_id === sb.user_id)?.inviterName
                    || 'Someone'
                  : null;
                return (
                  <TouchableOpacity
                    key={sb.id}
                    style={styles.scheduledBreakCard}
                    onPress={() => setDetailItem({ kind: 'scheduled', data: sb, hostName: hostName || undefined })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.scheduledBreakDot, isInvitedBreak && { backgroundColor: colors.secondary }]} />
                    <View style={styles.blockTime}>
                      <Text style={styles.blockTimeText}>{formatTime(sb.start_time)}</Text>
                      <Text style={styles.blockTimeDash}>{sb.duration}m</Text>
                    </View>
                    <View style={styles.blockInfo}>
                      <View style={styles.blockTitleRow}>
                        <Ionicons name={isInvitedBreak ? 'people' : 'calendar'} size={14} color={colors.secondary} />
                        <Text style={[styles.blockTitle, { color: colors.secondary }]} numberOfLines={1}>
                          {' '}{sb.title}{isInvitedBreak ? ' (Invited)' : ''}
                        </Text>
                      </View>
                      {isInvitedBreak && hostName && (
                        <Text style={styles.scheduledBreakHostText}>
                          Hosted by {hostName}
                        </Text>
                      )}
                      <View style={styles.blockBadgeRow}>
                        {zoneName ? (
                          <View style={styles.scheduledBreakBadge}>
                            <Ionicons name="location-outline" size={10} color={colors.secondary} />
                            <Text style={styles.scheduledBreakBadgeText} numberOfLines={1}>{zoneName}</Text>
                          </View>
                        ) : null}
                        <View style={styles.scheduledBreakBadge}>
                          <Ionicons name={sb.visibility === 'public' ? 'globe-outline' : 'people-outline'} size={10} color={colors.secondary} />
                          <Text style={styles.scheduledBreakBadgeText}>
                            {sb.visibility === 'public' ? 'Public' : 'Friends'}
                          </Text>
                        </View>
                      </View>
                      {(acceptedNames.length > 0 || pendingCount > 0) && (
                        <View style={styles.attendeesRow}>
                          <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.attendeesText} numberOfLines={2}>
                            {acceptedNames.length > 0 ? acceptedNames.join(', ') : ''}
                            {acceptedNames.length > 0 && pendingCount > 0 ? ' · ' : ''}
                            {pendingCount > 0 ? `${pendingCount} pending` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!isInvitedBreak && (
                      <TouchableOpacity
                        style={styles.inviteButton}
                        onPress={() => setInviteBreakId(sb.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="person-add-outline" size={18} color={colors.secondary} />
                      </TouchableOpacity>
                    )}
                    {!isInvitedBreak && (
                      <TouchableOpacity
                        style={styles.deleteBlockButton}
                        onPress={() => deleteScheduledBreak(sb.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Completed Breaks History */}
          {breakHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>Completed Breaks</Text>
              {breakHistory.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.historyCard}
                  onPress={() => setDetailItem({ kind: 'break', data: entry })}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyDot} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {entry.custom_title || `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} break`}
                    </Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      {entry.zone_name ? `${entry.zone_name} · ` : ''}
                      {entry.duration_minutes} min · {entry.points_awarded} pts
                    </Text>
                  </View>
                  <View style={styles.historyBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.historyBadgeText}>Done</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pending Break Invitations */}
          {(() => {
            const pending = breakInvitations.filter(inv => inv.invitee_id === profile?.id && inv.status === 'pending');
            if (pending.length === 0) return null;
            return (
              <View style={styles.invitationsSection}>
                <Text style={styles.invitationsSectionTitle}>Break Invitations</Text>
                {pending.map((inv) => {
                  const inviterFriend = friends.find(f => f.id === inv.inviter_id);
                  const inviterName = inviterFriend?.displayName || inv.inviterName || 'Someone';
                  const relatedBreak = scheduledBreaks.find(b => b.id === inv.break_id);
                  const zoneName = relatedBreak?.zone_id
                    ? zones.find(z => z.id === relatedBreak.zone_id)?.name
                    : null;
                  return (
                    <View key={inv.id} style={styles.invitationCard}>
                      {/* Inviter avatar */}
                      <View style={styles.invitationAvatar}>
                        {inviterFriend?.avatarUrl ? (
                          <Image source={{ uri: inviterFriend.avatarUrl }} style={styles.invitationAvatarImg} />
                        ) : (
                          <Text style={styles.invitationAvatarText}>{inviterName.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={styles.invitationInfo}>
                        <Text style={styles.invitationTitle} numberOfLines={1}>
                          {relatedBreak?.title || inv.breakTitle || 'Break'}
                        </Text>
                        <Text style={styles.invitationMeta} numberOfLines={1}>
                          {inviterName} invited you
                        </Text>
                        <View style={styles.invitationDetailRow}>
                          {relatedBreak && (
                            <>
                              <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                              <Text style={styles.invitationDetailText}>
                                {formatTime(relatedBreak.start_time)} · {relatedBreak.duration}m
                              </Text>
                            </>
                          )}
                          {zoneName && (
                            <>
                              <Ionicons name="location-outline" size={11} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                              <Text style={styles.invitationDetailText} numberOfLines={1}>{zoneName}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.invitationAcceptBtn}
                        onPress={() => respondToInvitation(inv.id, true)}
                      >
                        <Ionicons name="checkmark" size={18} color={colors.white} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.invitationDeclineBtn}
                        onPress={() => respondToInvitation(inv.id, false)}
                      >
                        <Ionicons name="close" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Generate Break Plan */}
          {nonBreakBlocks.length >= 2 && (
            <TouchableOpacity
              style={styles.breakPlanButton}
              onPress={() => setShowBreakPlanner(true)}
            >
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <Text style={styles.breakPlanButtonText}>Generate Break Plan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Modals */}
        <StartRecessModal visible={showStartRecess} onClose={() => setShowStartRecess(false)} />
        <AddBlockModal visible={showAddBlock} onClose={() => setShowAddBlock(false)} />
        <BreakPlannerModal visible={showBreakPlanner} onClose={() => setShowBreakPlanner(false)} />
        <ScheduleBreakModal visible={showScheduleBreak} onClose={() => setShowScheduleBreak(false)} onCreated={loadScheduledBreaks} />
        <ScheduleDetailModal visible={!!detailItem} onClose={() => setDetailItem(null)} item={detailItem} />

        {/* Invite Friends to Break Modal */}
        <Modal visible={!!inviteBreakId} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInviteBreakId(null)}>
          <View style={styles.inviteModalContainer}>
            <View style={styles.inviteModalHeader}>
              <Text style={styles.inviteModalTitle}>Invite Friends</Text>
              <TouchableOpacity onPress={() => setInviteBreakId(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.inviteModalContent}>
              {friends.length === 0 ? (
                <View style={styles.inviteEmptyState}>
                  <Ionicons name="people-outline" size={48} color={colors.border} />
                  <Text style={styles.inviteEmptyText}>No friends to invite yet</Text>
                </View>
              ) : (
                friends.map((friend) => {
                  const alreadyInvited = breakInvitations.some(
                    inv => inv.break_id === inviteBreakId && inv.invitee_id === friend.id
                  );
                  return (
                    <View key={friend.id} style={styles.inviteFriendRow}>
                      <View style={styles.inviteFriendAvatar}>
                        {friend.avatarUrl ? (
                          <Image source={{ uri: friend.avatarUrl }} style={styles.inviteFriendAvatarImg} />
                        ) : (
                          <Text style={styles.inviteFriendAvatarText}>{friend.displayName.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.inviteFriendName} numberOfLines={1}>{friend.displayName}</Text>
                      {alreadyInvited ? (
                        <View style={styles.invitedBadge}>
                          <Ionicons name="checkmark" size={14} color={colors.success} />
                          <Text style={styles.invitedBadgeText}>Invited</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.inviteSendBtn}
                          onPress={async () => {
                            if (inviteBreakId) {
                              const { error } = await sendBreakInvitation(inviteBreakId, friend.id);
                              if (error) {
                                Alert.alert('Error', error.message);
                              } else {
                                await loadBreakInvitations();
                              }
                            }
                          }}
                        >
                          <Text style={styles.inviteSendBtnText}>Invite</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImg: {
    width: 64,
    height: 64,
    marginRight: 8,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerProfile: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerProfileImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  welcomeSection: {
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  riskCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskInfo: { flex: 1 },
  riskLevel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  riskReason: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  recessCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  recessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recessPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  recessLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  recessTimer: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  recessInfo: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  breakTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  breakTipText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  endEarlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  endEarlyText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  startRecessButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startRecessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  startRecessContent: { flex: 1 },
  startRecessText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  startRecessHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  scheduleBreakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${colors.primary}12`,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: `${colors.primary}30`,
  },
  scheduleBreakText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  historySection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}08`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${colors.success}20`,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 10,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyPhoto: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  pointsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsInfo: { gap: 2 },
  pointsValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  pointsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pointsDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  pointsRight: { alignItems: 'center' },
  streakValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  streakLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  weekCalendarContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  weekNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 68,
  },
  weekDayCellSelected: {
    backgroundColor: colors.primary,
  },
  weekDayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  weekDayLabelSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  weekDayLabelToday: {
    color: colors.primary,
  },
  weekDayDate: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  weekDayDateSelected: {
    color: colors.white,
  },
  weekDayDateToday: {
    color: colors.primary,
  },
  weekDayDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    alignItems: 'center',
  },
  weekDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  weekDayDotSelected: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  weekDayDotCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  weekDayDotCountSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  scheduleSection: {
    marginTop: 4,
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addBlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: `${colors.primary}10`,
  },
  addBlockText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
  blocksList: { gap: 0 },
  blockWrapper: { position: 'relative' },
  timelineConnector: {
    position: 'absolute',
    left: 28,
    top: -8,
    width: 2,
    height: 16,
    backgroundColor: colors.border,
  },
  blockCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakCard: {
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  blockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textSecondary,
    marginRight: 14,
  },
  breakDot: {
    backgroundColor: colors.primary,
  },
  blockTime: {
    marginRight: 14,
    alignItems: 'center',
  },
  blockTimeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  blockTimeDash: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  blockInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  breakTitle: { color: colors.primary },
  blockBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  blockBadge: {
    backgroundColor: colors.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  breakBadge: {
    backgroundColor: `${colors.primary}15`,
  },
  blockBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  breakBadgeText: { color: colors.primary },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.secondary}10`,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  recurringBadgeText: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '600',
  },
  deleteBlockButton: { padding: 4 },
  scheduledBreaksSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  scheduledBreaksSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 10,
  },
  scheduledBreakCard: {
    backgroundColor: `${colors.secondary}08`,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${colors.secondary}20`,
  },
  scheduledBreakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    marginRight: 14,
  },
  scheduledBreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.secondary}10`,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  scheduledBreakBadgeText: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '600',
  },
  scheduledBreakHostText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  attendeesText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  inviteButton: {
    padding: 6,
    marginRight: 4,
  },
  invitationsSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  invitationsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: 10,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.warning}08`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: `${colors.warning}20`,
  },
  invitationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  invitationAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  invitationAvatarText: { fontSize: 16, fontWeight: '600', color: colors.white },
  invitationInfo: { flex: 1 },
  invitationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  invitationMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  invitationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  invitationDetailText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  invitationAcceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  invitationDeclineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  inviteModalContainer: { flex: 1, backgroundColor: colors.background },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  inviteModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  inviteModalContent: { padding: 16, paddingBottom: 40 },
  inviteEmptyState: { alignItems: 'center', paddingVertical: 40 },
  inviteEmptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
  inviteFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  inviteFriendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  inviteFriendAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  inviteFriendAvatarText: { fontSize: 16, fontWeight: '600', color: colors.white },
  inviteFriendName: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  invitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: `${colors.success}15`,
  },
  invitedBadgeText: { fontSize: 13, fontWeight: '600', color: colors.success },
  inviteSendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  inviteSendBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  breakPlanButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  breakPlanButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  // Calendar toggle
  calendarToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 3,
    marginBottom: 10,
  },
  calendarToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 17,
  },
  calendarToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  calendarToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  calendarToggleTextActive: {
    color: colors.white,
  },
  // Month view
  monthDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  monthDowLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  monthWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  monthDayCell: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  monthDayCellSelected: {
    backgroundColor: colors.primary,
  },
  monthDayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  monthDayText: {
    fontSize: 14,
    color: colors.text,
  },
  monthDayTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  monthDayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  monthDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  monthDayDotSelected: {
    backgroundColor: colors.white,
  },
});
