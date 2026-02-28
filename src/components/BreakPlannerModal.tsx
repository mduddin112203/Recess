import React from 'react';
import { Modal } from 'react-native';

interface BreakPlannerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BreakPlannerModal({ visible, onClose }: BreakPlannerModalProps) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} />;
}
