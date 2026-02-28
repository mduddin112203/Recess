import React from 'react';
import { Modal } from 'react-native';

interface StartRecessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function StartRecessModal({ visible, onClose }: StartRecessModalProps) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} />;
}
