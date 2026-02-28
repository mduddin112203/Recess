import React from 'react';
import { Modal } from 'react-native';
import { ScheduleBlock, BreakHistoryEntry, ScheduledBreak } from '../types';

export type DetailItem =
  | { kind: 'block'; data: ScheduleBlock }
  | { kind: 'break'; data: BreakHistoryEntry }
  | { kind: 'scheduled'; data: ScheduledBreak; hostName?: string };

interface ScheduleDetailModalProps {
  visible: boolean;
  onClose: () => void;
  item: DetailItem | null;
}

export function ScheduleDetailModal({ visible, onClose, item }: ScheduleDetailModalProps) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} />;
}
