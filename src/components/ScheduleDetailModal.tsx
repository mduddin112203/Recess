import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ScheduleBlock, BreakHistoryEntry, ScheduledBreak } from '../types';
import { BLOCK_TYPES } from '../utils/constants';
import { useApp } from '../context/AppContext';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DetailItem =
  | { kind: 'block'; data: ScheduleBlock }
  | { kind: 'break'; data: BreakHistoryEntry }
  | { kind: 'scheduled'; data: ScheduledBreak; hostName?: string };

interface ScheduleDetailModalProps {
  visible: boolean;
  onClose: () => void;
  item: DetailItem | null;
}

function formatTime12(time24: string): string {
  const parts = time24.split(':').map(Number);
  const h = isNaN(parts[0]) ? 0 : Math.min(parts[0], 23);
  const m = isNaN(parts[1]) ? 0 : parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDurationMinutes(mins: number): string {
  if (isNaN(mins) || mins <= 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hour = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${month} ${day}, ${hour}:${min} ${ampm}`;
}

export function ScheduleDetailModal({ visible, onClose, item }: ScheduleDetailModalProps) {
  const { colors } = useTheme();
  const { zones } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!item) return null;

  const renderBlock = (block: ScheduleBlock) => {
    const typeInfo = BLOCK_TYPES.find(bt => bt.value === block.type);
    const isRecurring = block.day_of_week != null;

    return (
      <>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: typeInfo?.color || colors.primary }]}>  
            <Ionicons name={(typeInfo?.icon as any) || 'time-outline'} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={2}>{block.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{typeInfo?.label || block.type}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {formatTime12(block.start_time)} – {formatTime12(block.end_time)}
          </Text>
        </View>

        {isRecurring ? (
          <>
            <View style={styles.detailRow}>
              <Ionicons name="repeat" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                Every {DAY_LABELS[block.day_of_week!]}
              </Text>
            </View>
            {block.end_date && (
              <View style={styles.detailRow}>
                <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.detailText}>Ends: {block.end_date}</Text>
              </View>
            )}
          </>
        ) : block.date ? (
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.detailText}>{block.date}</Text>
          </View>
        ) : null}

        {/* Duration */}
        {(() => {
          const sp = block.start_time.split(':').map(Number);
          const ep = block.end_time.split(':').map(Number);
          const startMin = (isNaN(sp[0]) ? 0 : sp[0]) * 60 + (isNaN(sp[1]) ? 0 : sp[1]);
          const endMin = (isNaN(ep[0]) ? 0 : ep[0]) * 60 + (isNaN(ep[1]) ? 0 : ep[1]);
          const dur = Math.max(endMin - startMin, 0);
          return (
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>Duration: {formatDurationMinutes(dur)}</Text>
            </View>
          );
        })()}
      </>
    );
  };

  const renderBreakHistory = (entry: BreakHistoryEntry) => {
    const zone = zones.find(z => z.id === entry.zone_id);
    const breakLabel = entry.custom_title || entry.type.charAt(0).toUpperCase() + entry.type.slice(1) + ' Break';

    return (
      <>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={2}>{breakLabel}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Completed Break</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="play-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>Started: {formatDateTime(entry.started_at)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="stop-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>Ended: {formatDateTime(entry.ended_at)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>Duration: {formatDurationMinutes(entry.duration_minutes)}</Text>
        </View>

        {(zone || entry.zone_name) && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{zone?.name || entry.zone_name}</Text>
          </View>
        )}

        {(zone || entry.zone_name) && (
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => {
              if (zone) {
                Linking.openURL(`maps:?q=${encodeURIComponent(zone.name)}&ll=${zone.lat},${zone.lng}`);
              } else if (entry.zone_name) {
                Linking.openURL(`maps:?q=${encodeURIComponent(entry.zone_name)}`);
              }
            }}
          >
            <Ionicons name="navigate" size={16} color={colors.white} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
          <Text style={styles.detailText}>{entry.points_awarded} points earned</Text>
        </View>

      </>
    );
  };

  const renderScheduledBreak = (sb: ScheduledBreak, hostName?: string) => {
    const zone = zones.find(z => z.id === sb.zone_id);
    const startParts = sb.start_time.split(':').map(Number);
    const sh = isNaN(startParts[0]) ? 0 : startParts[0];
    const sm = isNaN(startParts[1]) ? 0 : startParts[1];
    const endMinutes = Math.min(sh * 60 + sm + sb.duration, 1439);
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    return (
      <>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="calendar" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={2}>{sb.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {hostName ? `Hosted by ${hostName}` : 'Scheduled Break'}
            </Text>
          </View>
        </View>

        {sb.description && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={4}>{sb.description}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>{sb.date}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {formatTime12(sb.start_time)} – {formatTime12(endTime)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>Duration: {formatDurationMinutes(sb.duration)}</Text>
        </View>

        {zone && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{zone.name}</Text>
          </View>
        )}

        {zone && (
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => {
              Linking.openURL(`maps:?q=${encodeURIComponent(zone.name)}&ll=${zone.lat},${zone.lng}`);
            }}
          >
            <Ionicons name="navigate" size={16} color={colors.white} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.detailText}>Visibility: {sb.visibility}</Text>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            {item.kind === 'block' && renderBlock(item.data)}
            {item.kind === 'break' && renderBreakHistory(item.data)}
            {item.kind === 'scheduled' && renderScheduledBreak(item.data, item.hostName)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  scrollContent: {
    flexGrow: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  detailText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
});
