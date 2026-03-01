import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { getDeviceTimezone } from '../utils/dateUtils';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  changePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, isMounted);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        console.log('Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          if (event === 'SIGNED_UP') {
            setLoading(true);
            await fetchProfileWithRetry(session.user.id, isMounted);
          } else if (event === 'SIGNED_IN') {
            setLoading(true);
            await fetchProfile(session.user.id, isMounted);
          } else if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
            fetchProfile(session.user.id, isMounted);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, isMounted: boolean = true) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }

      if (!isMounted) return;

      if (data) {
        setProfile(data);

        const deviceTz = getDeviceTimezone();
        if (!data.timezone || data.timezone !== deviceTz) {
          supabase
            .from('profiles')
            .update({ timezone: deviceTz } as any)
            .eq('id', userId)
            .then(() => {});
        }
      } else if (error?.code === 'PGRST116' || !profile) {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const fetchProfileWithRetry = async (userId: string, isMounted: boolean = true) => {
    const delays = [300, 700, 1500];
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (!isMounted) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        if (!isMounted) return;
        setProfile(data);
        const deviceTz = getDeviceTimezone();
        if (!data.timezone || data.timezone !== deviceTz) {
          supabase
            .from('profiles')
            .update({ timezone: deviceTz } as any)
            .eq('id', userId)
            .then(() => {});
        }
        setLoading(false);
        return;
      }
    }
    if (isMounted) {
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('already registered') ||
            msg.includes('already been registered') ||
            msg.includes('user already exists') ||
            msg.includes('user_already_exists') ||
            (error as any).code === 'user_already_exists') {
          return { error: new Error('An account with this email already exists. Please sign in instead.') };
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('unable to connect')) {
          return { error: new Error('Unable to connect. Please check your internet connection.') };
        }
        return { error };
      }

      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        return { error: new Error('An account with this email already exists. Please sign in instead.') };
      }

      if (data?.user && !data.session) {
        return { error: null, needsEmailConfirmation: true };
      }

      return { error: null };
    } catch (error) {
      const msg = (error as Error)?.message?.toLowerCase() || '';
      if (msg.includes('network') || msg.includes('fetch')) {
        return { error: new Error('Unable to connect. Please check your internet connection.') };
      }
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          return { error: new Error('Incorrect email or password. Please try again.') };
        }
        if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
          return { error: new Error('Please confirm your email before signing in. Check your inbox for a confirmation link.') };
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('unable to connect')) {
          return { error: new Error('Unable to connect. Please check your internet connection.') };
        }
        return { error };
      }
      return { error: null };
    } catch (error) {
      const msg = (error as Error)?.message?.toLowerCase() || '';
      if (msg.includes('network') || msg.includes('fetch')) {
        return { error: new Error('Unable to connect. Please check your internet connection.') };
      }
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = makeRedirectUri({
        scheme: 'recess',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error };

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          const url = result.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          if (url.includes('#')) {
            const hashParams = new URLSearchParams(url.split('#')[1]);
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
          
          if (!accessToken && url.includes('?')) {
            const queryParams = new URLSearchParams(url.split('?')[1]);
            accessToken = queryParams.get('access_token');
            refreshToken = queryParams.get('refresh_token');
          }

          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) return { error: sessionError };
          }
        } else if (result.type === 'cancel') {
          return { error: new Error('Sign in was cancelled') };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const changePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('same_password') || msg.includes('same password') || msg.includes('should be different')) {
          return { error: new Error('New password must be different from your current password.') };
        }
        if (msg.includes('weak') || msg.includes('too short')) {
          return { error: new Error('Password is too weak. Please use at least 6 characters.') };
        }
        if (msg.includes('network') || msg.includes('fetch')) {
          return { error: new Error('Unable to connect. Please check your internet connection.') };
        }
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const generateFriendCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RCS-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existing) {
        const { error } = await (supabase
          .from('profiles') as any)
          .update(updates)
          .eq('id', user.id);

        if (!error) {
          setProfile(prev => prev ? { ...prev, ...updates } as any : prev);
          await refreshProfile();
        }
        return { error };
      } else {
        const upsertData = {
          id: user.id,
          friend_code: generateFriendCode(),
          ...updates,
        };
        const { error } = await (supabase
          .from('profiles') as any)
          .upsert(upsertData, { onConflict: 'id' });

        if (error) {
          if (error.code === '23503') {
            console.error('Stale session detected — signing out');
            Alert.alert(
              'Session Expired',
              'Your session is no longer valid. Please sign up or sign in again.',
              [{ text: 'OK', onPress: () => signOut() }]
            );
          }
          return { error };
        }

        await supabase.from('presence')
          .upsert(
            { user_id: user.id, status: 'free', share_level: 'friends' },
            { onConflict: 'user_id' }
          );
        await refreshProfile();
        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
