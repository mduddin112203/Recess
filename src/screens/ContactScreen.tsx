import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '../context/ThemeContext';

interface ContactScreenProps {
  onGoBack: () => void;
}

export function ContactScreen({ onGoBack }: ContactScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleEmail = () => {
    Linking.openURL('mailto:recessapp@yahoo.com').catch(() => {
      Alert.alert('Email', 'recessapp@yahoo.com\n\nCopy this email to reach us!');
    });
  };

  const handleInstagram = () => {
    Linking.openURL('https://www.instagram.com/recessappig/').catch(() => {
      Alert.alert('Instagram', 'Follow us @recessappig');
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact / Support</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/Mainlogoblue.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>Built for Mindfulness & Wellbeing</Text>

        {/* Contact Options */}
        <View style={styles.contactCard}>
          <TouchableOpacity style={styles.contactRow} onPress={handleEmail} activeOpacity={0.7}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="mail" size={22} color={colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email Us</Text>
              <Text style={styles.contactValue}>recessapp@yahoo.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.contactRow} onPress={handleInstagram} activeOpacity={0.7}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="logo-instagram" size={22} color="#E4405F" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Instagram</Text>
              <Text style={styles.contactValue}>@recessappig</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <View style={styles.noteCard}>
          <Ionicons name="heart" size={18} color={colors.primary} />
          <Text style={styles.noteText}>
            Recess is a student-built app designed to help prevent burnout through mindful breaks and social connection.
          </Text>
        </View>

        <Text style={styles.version}>Recess v1.0.0</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  textLogo: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
    fontWeight: '500',
  },
  contactCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 70,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  version: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 24,
  },
});
