import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DateField = React.memo(
  React.forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(
    (props, ref) => <TextInput {...props} ref={ref} />
  ),
  () => true
);
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BREAK_LENGTHS, GENDER_OPTIONS } from '../utils/constants';
import { toLocalDateString, getDeviceTimezone } from '../utils/dateUtils';

interface OnboardingScreenProps {
  onComplete?: () => void;
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 24,
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    iconContainer: {
      marginBottom: 20,
    },
    logo: {
      width: 100,
      height: 100,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    form: {
      marginBottom: 32,
    },
    inputGroup: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    input: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    breakOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    breakOption: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 14,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    breakOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    breakOptionValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    breakOptionValueSelected: {
      color: colors.primary,
    },
    breakOptionDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    breakOptionDescSelected: {
      color: colors.primary,
    },
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dropdownTriggerText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    dropdownTriggerPlaceholder: {
      color: colors.textSecondary,
      fontWeight: '400',
    },
    dropdownList: {
      maxHeight: 200,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    dropdownItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemText: {
      fontSize: 15,
      color: colors.text,
    },

    bdayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bdayInput: {
      width: 52,
      height: 48,
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    bdayYearInput: {
      width: 72,
    },
    bdaySlash: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    ageBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginLeft: 4,
    },
    ageBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    optionalLabel: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    privacySection: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleInfo: {
      flex: 1,
      marginRight: 16,
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    toggleHint: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    completeButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    completeButtonDisabled: {
      opacity: 0.7,
    },
    completeButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.white,
    },
    signOutRow: {
      alignItems: 'flex-end',
      marginBottom: -20,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    signOutText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.error,
    },
  });
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { user, profile, updateProfile, refreshProfile, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [breakLength, setBreakLength] = useState(profile?.default_break_length || 25);
  const [sharePresence, setSharePresence] = useState(true);
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [shareSchedule, setShareSchedule] = useState(true);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState('');
  const bdayMonth = useRef('');
  const bdayDay = useRef('');
  const bdayYear = useRef('');
  const bdayDayRef = useRef<TextInput>(null);
  const bdayYearRef = useRef<TextInput>(null);
  const [computedAge, setComputedAge] = useState<number | null>(null);

  const recalcAge = () => {
    const bday = buildBirthday();
    setComputedAge(bday ? getAge(bday) : null);
  };
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);

  const [school, setSchool] = useState(profile?.school || '');

  const buildBirthday = (): Date | null => {
    const m = parseInt(bdayMonth.current, 10);
    const d = parseInt(bdayDay.current, 10);
    const y = parseInt(bdayYear.current, 10);
    if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) return null;
    const date = new Date(y, m - 1, d);
    if (date.getMonth() !== m - 1) return null;
    return date;
  };

  const getAge = (bday: Date) => {
    const today = new Date();
    let age = today.getFullYear() - bday.getFullYear();
    const m = today.getMonth() - bday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
    return age;
  };

  const handleComplete = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }
    const fullName = lastName.trim()
      ? `${firstName.trim()} ${lastName.trim()}`
      : firstName.trim();

    setLoading(true);
    try {
      const { error } = await updateProfile({
        display_name: fullName,
        default_break_length: breakLength,
        privacy_friend_visibility: sharePresence,
        privacy_public_zone_visibility: publicVisibility,
        share_presence: sharePresence,
        share_schedule: shareSchedule,
        gender: gender || null,
        birthday: (() => { const bd = buildBirthday(); return bd ? toLocalDateString(bd) : null; })(),
        school: school.trim() || null,
        timezone: getDeviceTimezone(),
        onboarding_completed: true,
      } as any);

      if (error) {
        console.error('Profile update error:', error);
        Alert.alert('Error', 'Could not save profile. Please try again.');
      } else {
        await refreshProfile();
        onComplete?.();
      }
    } catch (err) {
      console.error('handleComplete error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const genderLabel = gender ? GENDER_OPTIONS.find((o) => o.id === gender)?.label ?? 'Select gender' : 'Select gender';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Sign Out button */}
        <View style={styles.signOutRow}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
              ]);
            }}
            style={styles.signOutButton}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/Mainlogoblue.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Let's set up your profile to help prevent burnout and stay connected.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your first name"
              placeholderTextColor={colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Last Name <Text style={styles.optionalLabel}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your last name"
              placeholderTextColor={colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Gender dropdown */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dropdownTriggerText,
                  !gender && styles.dropdownTriggerPlaceholder,
                ]}
              >
                {genderLabel}
              </Text>
              <Ionicons
                name={showGenderDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {showGenderDropdown && (
              <View style={styles.dropdownList}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setGender(option.id);
                      setShowGenderDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Birthday */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Birthday</Text>
            <View style={styles.bdayRow}>
              <DateField
                style={styles.bdayInput}
                defaultValue=""
                onChangeText={(t: string) => { bdayMonth.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                onSubmitEditing={() => bdayDayRef.current?.focus()}
              />
              <Text style={styles.bdaySlash}>/</Text>
              <DateField
                ref={bdayDayRef}
                style={styles.bdayInput}
                defaultValue=""
                onChangeText={(t: string) => { bdayDay.current = t; }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="DD"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                onSubmitEditing={() => bdayYearRef.current?.focus()}
              />
              <Text style={styles.bdaySlash}>/</Text>
              <DateField
                ref={bdayYearRef}
                style={[styles.bdayInput, styles.bdayYearInput]}
                defaultValue=""
                onChangeText={(t: string) => { bdayYear.current = t; if (t.length === 4) recalcAge(); }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="YYYY"
                placeholderTextColor={colors.textSecondary}
              />
              {computedAge !== null && (
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>{computedAge} yrs</Text>
                </View>
              )}
            </View>
          </View>

          {/* School */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              School <Text style={styles.optionalLabel}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your school or university"
              placeholderTextColor={colors.textSecondary}
              value={school}
              onChangeText={setSchool}
              autoCapitalize="words"
            />
          </View>

          {/* Break Length */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default break length</Text>
            <View style={styles.breakOptions}>
              {BREAK_LENGTHS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.breakOption,
                    breakLength === option.value && styles.breakOptionSelected,
                  ]}
                  onPress={() => setBreakLength(option.value)}
                >
                  <Text
                    style={[
                      styles.breakOptionValue,
                      breakLength === option.value && styles.breakOptionValueSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.breakOptionDesc,
                      breakLength === option.value && styles.breakOptionDescSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Privacy Settings */}
          <View style={styles.privacySection}>
            <Text style={styles.label}>Privacy settings</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Share break activity with friends</Text>
                <Text style={styles.toggleHint}>Friends can see when you're on break, what type, and where</Text>
              </View>
              <Switch
                value={sharePresence}
                onValueChange={setSharePresence}
                trackColor={{ false: colors.border, true: `${colors.primary}50` }}
                thumbColor={sharePresence ? colors.primary : colors.textSecondary}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Appear in public zones</Text>
                <Text style={styles.toggleHint}>Non-friends can see you in zone activity when your break is public</Text>
              </View>
              <Switch
                value={publicVisibility}
                onValueChange={setPublicVisibility}
                trackColor={{ false: colors.border, true: `${colors.primary}50` }}
                thumbColor={publicVisibility ? colors.primary : colors.textSecondary}
              />
            </View>

            <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Share schedule with friends</Text>
                <Text style={styles.toggleHint}>Friends can see your current class or activity from your schedule</Text>
              </View>
              <Switch
                value={shareSchedule}
                onValueChange={setShareSchedule}
                trackColor={{ false: colors.border, true: `${colors.primary}50` }}
                thumbColor={shareSchedule ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.completeButton, loading && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.completeButtonText}>
            {loading ? 'Setting up...' : "Let's Go!"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
