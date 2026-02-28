import React from 'react';
import { Modal } from 'react-native';

interface ScheduleBreakModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
}

export function ScheduleBreakModal({ visible, onClose }: ScheduleBreakModalProps) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} />;
}
