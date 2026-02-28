import React from 'react';
import { Modal } from 'react-native';

interface AddBlockModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddBlockModal({ visible, onClose }: AddBlockModalProps) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} />;
}
