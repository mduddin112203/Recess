import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const passwordValid = password.length >= 6;
  const passwordRef = useRef<TextInput>(null);

  const handleAuth = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (!emailValid) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Missing Password', 'Please enter your password.');
      return;
    }
    if (!passwordValid) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    if (isLogin) {
      const { error } = await signIn(email.trim(), password);
      setLoading(false);
      if (error) Alert.alert('Sign In Failed', error.message);
    } else {
      const result = await signUp(email.trim(), password);
      setLoading(false);
      if (result.error) {
        const msg = result.error.message || '';
        if (msg.toLowerCase().includes('already exists')) {
          Alert.alert('Account Exists', msg, [
            { text: 'Sign In Instead', onPress: () => setIsLogin(true) },
          ]);
        } else {
          Alert.alert('Sign Up Failed', msg);
        }
      } else if (result.needsEmailConfirmation) {
        Alert.alert(
          'Check Your Email',
          'We sent a confirmation link to your email. Please verify before signing in.',
          [{ text: 'OK', onPress: () => setIsLogin(true) }]
        );
      }
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmailTouched(false);
    setShowPassword(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/Mainlogoblue.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>
            Mindful breaks. Social connection.{'\n'}Burnout prevention.
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isLogin ? 'Sign in to continue' : 'Start your wellness journey'}
          </Text>

          {/* Email */}
          <View style={[
            styles.inputRow,
            emailTouched && email.trim().length > 0 && !emailValid && styles.inputRowError,
          ]}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailTouched(true)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {emailTouched && email.trim().length > 0 && (
              <Ionicons
                name={emailValid ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={emailValid ? colors.success : colors.error}
              />
            )}
          </View>

          {/* Password */}
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder={isLogin ? 'Password' : 'Password (min 6 chars)'}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={isLogin ? 'password' : 'new-password'}
              returnKeyType="done"
              onSubmitEditing={handleAuth}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Password strength for signup */}
          {!isLogin && password.length > 0 && (
            <Text style={[
              styles.inlineHint,
              { color: passwordValid ? colors.success : colors.error },
            ]}>
              {passwordValid
                ? 'Password looks good'
                : `${6 - password.length} more character${6 - password.length !== 1 ? 's' : ''} needed`}
            </Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle */}
          <TouchableOpacity style={styles.toggleRow} onPress={toggleMode}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleBold}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerPill}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
            <Text style={styles.footerText}>Secure & Private</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 32,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logoImage: {
      width: 140,
      height: 140,
      marginBottom: 10,
    },
    tagline: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    formCard: {
      backgroundColor: isDark ? colors.cardBg : '#ffffff',
      borderRadius: 20,
      padding: 24,
      borderWidth: isDark ? 0 : 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 2,
    },
    formTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    formSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? colors.background : '#f5f6f8',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    inputRowError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    inlineHint: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: -6,
      marginBottom: 8,
      marginLeft: 2,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.65,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.white,
    },
    toggleRow: {
      alignItems: 'center',
      marginTop: 16,
    },
    toggleText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    toggleBold: {
      fontWeight: '700',
      color: colors.primary,
    },
    footer: {
      alignItems: 'center',
      marginTop: 24,
    },
    footerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${colors.primary}12`,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 16,
    },
    footerText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
