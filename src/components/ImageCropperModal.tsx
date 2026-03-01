import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as ImageManipulator from 'expo-image-manipulator';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ImageCropperModalProps {
  visible: boolean;
  imageUri: string | null;
  aspectRatio?: number; // width / height, e.g. 1 for square
  onSave: (croppedUri: string) => void;
  onCancel: () => void;
}

export function ImageCropperModal({
  visible,
  imageUri,
  aspectRatio = 1,
  onSave,
  onCancel,
}: ImageCropperModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [processing, setProcessing] = useState(false);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);

  const previewSize = SCREEN_WIDTH - 80;
  const previewHeight = previewSize / aspectRatio;

  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => setImageDims({ width: w, height: h }),
        () => setImageDims(null)
      );
    } else {
      setImageDims(null);
    }
  }, [imageUri]);

  const handleSave = async () => {
    if (!imageUri) return;
    setProcessing(true);
    try {
      const actions: ImageManipulator.Action[] = [];

      if (imageDims) {
        const srcW = imageDims.width;
        const srcH = imageDims.height;
        const srcRatio = srcW / srcH;

        if (Math.abs(srcRatio - aspectRatio) > 0.01) {
          let cropW: number;
          let cropH: number;

          if (srcRatio > aspectRatio) {
            cropH = srcH;
            cropW = Math.round(srcH * aspectRatio);
          } else {
            cropW = srcW;
            cropH = Math.round(srcW / aspectRatio);
          }

          const originX = Math.round((srcW - cropW) / 2);
          const originY = Math.round((srcH - cropH) / 2);

          actions.push({
            crop: {
              originX,
              originY,
              width: cropW,
              height: cropH,
            },
          });
        }
      }

      const targetWidth = aspectRatio >= 1 ? 800 : Math.round(800 * aspectRatio);
      actions.push({ resize: { width: targetWidth } });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onSave(result.uri);
    } catch (error) {
      console.error('Error cropping image:', error);
      // Fallback: use original image
      onSave(imageUri);
    } finally {
      setProcessing(false);
    }
  };

  if (!imageUri) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop & Preview</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={processing}>
            {processing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color={colors.primary} />
                <Text style={[styles.headerButtonText, { color: colors.primary }]}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewContainer}>
          <View style={[styles.previewFrame, { width: previewSize, height: previewHeight }]}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.previewImage, { width: previewSize, height: previewHeight }]}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.previewHint}>
            {aspectRatio === 1 ? 'Square crop — centered automatically' : 'Crop preview — centered automatically'}
          </Text>
          <Text style={styles.previewSubhint}>
            The image will be cropped to fit this frame
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.cardBg,
    },
    headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80 },
    headerButtonText: { fontSize: 16, fontWeight: '500', color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    previewFrame: {
      borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
      elevation: 4,
    },
    previewImage: { borderRadius: 14 },
    previewHint: { marginTop: 16, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    previewSubhint: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  });
