import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useTheme, type ThemeColors } from '../context/ThemeContext';
import { BREAK_LENGTHS } from '../utils/constants';
import { uploadImage } from '../utils/imageUpload';
import { ImageCropperModal } from '../components/ImageCropperModal';

export function ProfileScreen({ navigation, onOpenContact }: { navigation: any; onOpenContact?: () => void }) {
  const { profile, user, signOut, updateProfile, changePassword } = useAuth();
  const { weeklyPoints } = useApp();
  const { colors, isDark } = useTheme();

  const [editing, setEditing] = useState(false);
  const nameParts = (profile?.display_name || '').split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [breakLength, setBreakLength] = useState(profile?.default_break_length || 25);
  const [friendVisibility, setFriendVisibility] = useState(profile?.privacy_friend_visibility ?? true);
  const [publicVisibility, setPublicVisibility] = useState(profile?.privacy_public_zone_visibility ?? true);
  const [sharePresence, setSharePresence] = useState(profile?.share_presence ?? true);
  const [shareSchedule, setShareSchedule] = useState(profile?.share_schedule ?? true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropperUri, setCropperUri] = useState<string | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const themePreference = profile?.theme_preference || 'system';

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePickAvatar = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    // Show cropper preview
    setCropperUri(result.assets[0].uri);
  };

  const handleCropperSave = async (croppedUri: string) => {
    setCropperUri(null);
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const path = `${user.id}/avatar.jpg`;
      const publicUrl = await uploadImage('profile-images', path, croppedUri);
      if (!publicUrl) {
        Alert.alert('Upload failed', 'Could not upload profile picture. Please try again.');
        return;
      }
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }
    const fullName = lastName.trim()
      ? `${firstName.trim()} ${lastName.trim()}`
      : firstName.trim();
    setSaving(true);
    const { error } = await updateProfile({
      display_name: fullName,
      default_break_length: breakLength,
      privacy_friend_visibility: sharePresence,
      privacy_public_zone_visibility: publicVisibility,
      share_presence: sharePresence,
      share_schedule: shareSchedule,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEditing(false);
      Alert.alert('Success', 'Profile updated!');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setChangingPassword(true);
    const { error } = await changePassword(newPassword);
    setChangingPassword(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been updated.');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  };

  const copyFriendCode = () => {
    if (!profile?.friend_code) {
      Alert.alert('Not Available', 'Your friend code is still being generated. Please try again.');
      return;
    }
    Alert.alert('Your Friend Code', `${profile.friend_code}\n\nShare this code with friends so they can add you!`, [{ text: 'OK' }]);
  };

  const handleContactSupport = () => {
    if (onOpenContact) {
      onOpenContact();
    } else {
      Linking.openURL('mailto:recessapp@yahoo.com');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handlePickAvatar}
          disabled={uploadingAvatar}
          activeOpacity={0.8}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.display_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{profile?.display_name || 'User'}</Text>
        {user?.email && <Text style={styles.email}>{user.email}</Text>}
        {profile?.friend_code ? (
          <TouchableOpacity style={styles.codeButton} onPress={copyFriendCode}>
            <Text style={styles.codeText}>{profile.friend_code}</Text>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={24} color={colors.warning} />
          <Text style={styles.statValue}>{weeklyPoints}</Text>
          <Text style={styles.statLabel}>Points This Week</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={24} color={colors.primary} />
          <Text style={styles.statValue}>{breakLength}m</Text>
          <Text style={styles.statLabel}>Default Break</Text>
        </View>
      </View>

      {/* Profile Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>First Name</Text>
          {editing ? (
            <TextInput
              style={styles.settingInput}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          ) : (
            <Text style={styles.settingValue}>{firstName}</Text>
          )}
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Last Name (optional)</Text>
          {editing ? (
            <TextInput
              style={styles.settingInput}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          ) : (
            <Text style={styles.settingValue}>{lastName || '—'}</Text>
          )}
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Default Break Length</Text>
          {editing ? (
            <View style={styles.breakLengthOptions}>
              {BREAK_LENGTHS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.breakLengthOption, breakLength === option.value && styles.breakLengthOptionSelected]}
                  onPress={() => setBreakLength(option.value)}
                >
                  <Text style={[styles.breakLengthText, breakLength === option.value && styles.breakLengthTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.settingValue}>{breakLength} minutes</Text>
          )}
        </View>

        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.toggleItem}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Share break activity with friends</Text>
            <Text style={styles.toggleHint}>Friends can see when you're on break, what type, and where</Text>
          </View>
          <Switch
            value={sharePresence}
            onValueChange={(value) => {
              setSharePresence(value);
              setFriendVisibility(value);
              if (!editing) updateProfile({ share_presence: value, privacy_friend_visibility: value });
            }}
            trackColor={{ false: colors.border, true: `${colors.primary}50` }}
            thumbColor={sharePresence ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.toggleItem}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Appear in public zones</Text>
            <Text style={styles.toggleHint}>Non-friends can see you in zone activity when your break is public</Text>
          </View>
          <Switch
            value={publicVisibility}
            onValueChange={(value) => {
              setPublicVisibility(value);
              if (!editing) updateProfile({ privacy_public_zone_visibility: value });
            }}
            trackColor={{ false: colors.border, true: `${colors.primary}50` }}
            thumbColor={publicVisibility ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={[styles.toggleItem, { borderBottomWidth: 0 }]}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Share schedule with friends</Text>
            <Text style={styles.toggleHint}>Friends can see your current class or activity from your schedule</Text>
          </View>
          <Switch
            value={shareSchedule}
            onValueChange={(value) => {
              setShareSchedule(value);
              if (!editing) updateProfile({ share_schedule: value });
            }}
            trackColor={{ false: colors.border, true: `${colors.primary}50` }}
            thumbColor={shareSchedule ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeOptions}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.themeOption,
                themePreference === option && styles.themeOptionSelected,
              ]}
              onPress={() => updateProfile({ theme_preference: option })}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  themePreference === option && styles.themeOptionTextSelected,
                ]}
              >
                {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Friend Code */}
      {profile?.friend_code && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend Code</Text>
          <TouchableOpacity style={styles.friendCodeCard} onPress={copyFriendCode} activeOpacity={0.7}>
            <View style={styles.friendCodeLeft}>
              <Ionicons name="person-add-outline" size={22} color={colors.primary} />
              <View>
                <Text style={styles.friendCodeValue}>{profile.friend_code}</Text>
                <Text style={styles.friendCodeHint}>Tap to share with friends</Text>
              </View>
            </View>
            <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {/* Change Password */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => setShowChangePassword(!showChangePassword)}
        >
          <Ionicons name="key-outline" size={22} color={colors.primary} />
          <Text style={[styles.actionText, { flex: 1 }]}>Change Password</Text>
          <Ionicons
            name={showChangePassword ? 'chevron-up' : 'chevron-forward'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {showChangePassword && (
          <View style={styles.changePasswordContainer}>
            <View style={styles.passwordInputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.passwordInput}
                placeholder="New password (min 6 characters)"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleChangePassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchIndicator}>
                <Ionicons
                  name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={newPassword === confirmPassword ? colors.success : colors.error}
                />
                <Text style={[
                  styles.matchText,
                  { color: newPassword === confirmPassword ? colors.success : colors.error },
                ]}>
                  {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.changePasswordButton,
                changingPassword && styles.saveButtonDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.changePasswordButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.actionItem} onPress={handleContactSupport}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          <Text style={styles.actionText}>Contact / Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.actionTextDanger}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Recess v1.0.0</Text>
        <Text style={styles.footerText}>Built for Mindfulness & Wellbeing</Text>
      </View>

      <ImageCropperModal
        visible={!!cropperUri}
        imageUri={cropperUri}
        aspectRatio={1}
        onSave={handleCropperSave}
        onCancel={() => setCropperUri(null)}
      />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    header: { alignItems: 'center', paddingVertical: 24 },
    avatarWrapper: { position: 'relative', marginBottom: 12 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40 },
    avatarText: { fontSize: 32, fontWeight: '600', color: colors.white },
    avatarBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
    codeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: `${colors.primary}15`,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    codeText: { fontSize: 14, fontWeight: '600', color: colors.primary, letterSpacing: 1 },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 8 },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    section: {
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
    editButton: { fontSize: 14, fontWeight: '600', color: colors.primary },
    cancelButton: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    settingItem: { marginBottom: 16 },
    settingLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
    settingValue: { fontSize: 16, color: colors.text },
    settingInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    breakLengthOptions: { flexDirection: 'row', gap: 8 },
    breakLengthOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    breakLengthOptionSelected: { backgroundColor: colors.primary },
    breakLengthText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    breakLengthTextSelected: { color: colors.white },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonDisabled: { opacity: 0.7 },
    saveButtonText: { fontSize: 16, fontWeight: '600', color: colors.white },
    toggleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleInfo: { flex: 1, marginRight: 16 },
    toggleLabel: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 4 },
    toggleHint: { fontSize: 13, color: colors.textSecondary },
    themeOptions: { flexDirection: 'row', gap: 8 },
    themeOption: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    themeOptionSelected: { backgroundColor: colors.primary },
    themeOptionText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    themeOptionTextSelected: { color: colors.white },
    friendCodeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: `${colors.primary}08`,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: `${colors.primary}20`,
    },
    friendCodeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    friendCodeValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.5,
    },
    friendCodeHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    actionText: { fontSize: 16, fontWeight: '500', color: colors.text },
    actionTextDanger: { fontSize: 16, fontWeight: '500', color: colors.error },
    changePasswordContainer: {
      paddingTop: 4,
      paddingBottom: 8,
      paddingLeft: 4,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.text,
    },
    matchIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
      paddingLeft: 2,
    },
    matchText: {
      fontSize: 12,
      fontWeight: '500',
    },
    changePasswordButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 2,
    },
    changePasswordButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
    footer: { alignItems: 'center', paddingVertical: 24 },
    footerText: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  });
}
