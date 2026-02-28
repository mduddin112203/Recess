import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { BLOCK_TYPES } from '../utils/constants';
import { generateBreakPlan, formatTime } from '../utils/burnoutEngine';
import { toLocalDateString, getLocalDayOfWeek } from '../utils/dateUtils';

interface BreakPlannerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BreakPlannerModal({ visible, onClose }: BreakPlannerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { scheduleBlocks, addScheduleBlock, loadScheduleBlocks } = useApp();

  const [suggestedBreaks, setSuggestedBreaks] = useState<Array<{ title: string; type: string; start_time: string; end_time: string; date: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      const breaks = generateBreakPlan(scheduleBlocks);
      setSuggestedBreaks(breaks);
    }
  }, [visible, scheduleBlocks]);

  const handleAcceptPlan = async () => {
    if (suggestedBreaks.length === 0) {
      onClose();
      return;
    }

    setLoading(true);
    let success = true;

    for (const breakBlock of suggestedBreaks) {
      const { error } = await addScheduleBlock({ ...breakBlock, type: breakBlock.type as any });
      if (error) {
        success = false;
        console.error('Error adding break:', error);
      }
    }

    await loadScheduleBlocks();
    setLoading(false);

    if (success) {
      Alert.alert(
        'Plan Accepted',
        `${suggestedBreaks.length} break${suggestedBreaks.length > 1 ? 's' : ''} added to your schedule.`,
        [{ text: 'Great!' }]
      );
    } else {
      Alert.alert('Error', 'Some breaks could not be added. Please try again.');
    }

    onClose();
  };

  const getTodayBlocks = () => {
    const today = toLocalDateString();
    const todayDow = getLocalDayOfWeek();
    return scheduleBlocks
      .filter((b) => {
        if (b.end_date && b.end_date < today) return false;
        return b.date === today || (b.day_of_week != null && b.day_of_week === todayDow);
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getBlockTypeInfo = (type: string) => {
    return BLOCK_TYPES.find((t) => t.id === type) || BLOCK_TYPES[4];
  };

  const todayBlocks = getTodayBlocks();

  const previewBlocks = [
    ...todayBlocks.map(b => ({ ...b, isSuggested: false })),
    ...suggestedBreaks.map((b, i) => ({
      ...b,
      id: `suggested-${i}`,
      user_id: '',
      created_at: '',
      isSuggested: true
    })),
  ].sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Break Plan</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
            <View style={styles.introContent}>
              <Text style={styles.introTitle}>
                {suggestedBreaks.length > 0
                  ? `${suggestedBreaks.length} break${suggestedBreaks.length > 1 ? 's' : ''} suggested`
                  : 'No breaks needed'}
              </Text>
              <Text style={styles.introText}>
                {suggestedBreaks.length > 0
                  ? 'Based on your schedule, we recommend adding recovery breaks to prevent burnout.'
                  : 'Your schedule already has good balance! Consider adding breaks if you feel overwhelmed.'}
              </Text>
            </View>
          </View>

          {suggestedBreaks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preview</Text>
              <View style={styles.timeline}>
                {previewBlocks.map((block, index) => {
                  const typeInfo = getBlockTypeInfo(block.type);
                  const isSuggested = (block as any).isSuggested;
                  const isBreak = block.type === 'break';

                  return (
                    <View key={block.id} style={styles.blockWrapper}>
                      {index > 0 && <View style={styles.connector} />}

                      <View style={[
                        styles.blockCard,
                        isBreak && styles.breakCard,
                        isSuggested && styles.suggestedCard,
                      ]}>
                        <View style={[
                          styles.blockDot,
                          isBreak && styles.breakDot,
                          isSuggested && styles.suggestedDot,
                        ]} />
                        <View style={styles.blockTime}>
                          <Text style={styles.blockTimeText}>
                            {formatTime(block.start_time)}
                          </Text>
                          <Text style={styles.blockTimeSeparator}>–</Text>
                          <Text style={styles.blockTimeText}>
                            {formatTime(block.end_time)}
                          </Text>
                        </View>
                        <View style={styles.blockInfo}>
                          <Text style={[
                            styles.blockTitle,
                            isSuggested && styles.suggestedTitle,
                          ]}>
                            {block.title}
                          </Text>
                          {isSuggested && (
                            <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {suggestedBreaks.length > 0 && (
            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>Benefits of taking breaks</Text>
              <View style={styles.benefit}>
                <Ionicons name="bulb-outline" size={20} color={colors.primary} />
                <Text style={styles.benefitText}>Improved focus and retention</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="battery-charging" size={20} color={colors.success} />
                <Text style={styles.benefitText}>Reduced mental fatigue</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="happy" size={20} color={colors.warning} />
                <Text style={styles.benefitText}>Better mood and wellbeing</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {suggestedBreaks.length > 0 ? (
            <TouchableOpacity
              style={[styles.acceptButton, loading && styles.acceptButtonDisabled]}
              onPress={handleAcceptPlan}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.acceptButtonText}>
                {loading ? 'Adding...' : 'Accept Plan'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
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
    introCard: {
      backgroundColor: `${colors.primary}10`,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 24,
    },
    introContent: {
      flex: 1,
    },
    introTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    introText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 14,
    },
    timeline: {
      gap: 0,
    },
    blockWrapper: {
      position: 'relative',
    },
    connector: {
      position: 'absolute',
      left: 13,
      top: -8,
      width: 2,
      height: 16,
      backgroundColor: colors.border,
    },
    blockCard: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    breakCard: {
      backgroundColor: `${colors.primary}08`,
    },
    suggestedCard: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    blockDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textSecondary,
      marginRight: 12,
    },
    breakDot: {
      backgroundColor: colors.primary,
    },
    suggestedDot: {
      backgroundColor: colors.primary,
    },
    blockTime: {
      marginRight: 12,
      alignItems: 'center',
    },
    blockTimeText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    blockTimeSeparator: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    blockInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    blockTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    suggestedTitle: {
      color: colors.primary,
      fontWeight: '600',
    },
    newBadge: {
      backgroundColor: colors.primary,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
    },
    newBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
    },
    benefitsCard: {
      backgroundColor: colors.cardBg,
      borderRadius: 14,
      padding: 16,
    },
    benefitsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    benefitText: {
      fontSize: 14,
      color: colors.text,
    },
    footer: {
      padding: 20,
      paddingBottom: 34,
      backgroundColor: colors.cardBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    acceptButton: {
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
    acceptButtonDisabled: {
      opacity: 0.7,
    },
    acceptButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.white,
    },
    closeButton: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });
