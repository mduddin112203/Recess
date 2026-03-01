import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, AppState } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { Ionicons } from '@expo/vector-icons';

type TabName = 'Home' | 'Map' | 'Friends' | 'Board';

function TabBar({ activeTab, onTabPress }: { activeTab: TabName; onTabPress: (tab: TabName) => void }) {
  const { colors } = useTheme();
  const tabs: { name: TabName; icon: any; iconOutline: any }[] = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
    { name: 'Map', icon: 'map', iconOutline: 'map-outline' },
    { name: 'Friends', icon: 'people', iconOutline: 'people-outline' },
    { name: 'Board', icon: 'trophy', iconOutline: 'trophy-outline' },
  ];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.tabBarSafe, { backgroundColor: colors.cardBg }]}>
      <View style={[styles.tabBar, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.iconOutline}
                size={22}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.tabLabel, { color: colors.textSecondary }, isActive && { color: colors.primary, fontWeight: '600' }]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function MainApp() {
  const { colors } = useTheme();
  const {
    loadZones, loadFriends, loadBreakInvitations, loadScheduleBlocks,
    loadScheduledBreaks, loadBreakHistory, loadWeeklyPoints,
  } = useApp();
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [showProfile, setShowProfile] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const prevTab = useRef<TabName>('Home');

  // Refresh relevant data when switching tabs
  const handleTabPress = (tab: TabName) => {
    setActiveTab(tab);
    if (tab !== prevTab.current) {
      prevTab.current = tab;
      switch (tab) {
        case 'Home':
          loadScheduleBlocks();
          loadScheduledBreaks();
          loadBreakInvitations();
          break;
        case 'Map':
          loadZones();
          break;
        case 'Friends':
          loadFriends();
          loadBreakInvitations();
          break;
        case 'Board':
          loadWeeklyPoints();
          break;
      }
    }
  };

  // Refresh data when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadFriends();
        loadZones();
        loadBreakInvitations();
      }
    });
    return () => sub.remove();
  }, []);

  if (showContact) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ContactScreen onGoBack={() => setShowContact(false)} />
      </SafeAreaView>
    );
  }

  if (showProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.screenHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowProfile(false)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.screenHeaderTitle, { color: colors.text }]}>Profile & Settings</Text>
          <View style={styles.backButton} />
        </View>
        <ProfileScreen
          navigation={{ goBack: () => setShowProfile(false) } as any}
          onOpenContact={() => { setShowProfile(false); setShowContact(true); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenContainer}>
        {activeTab === 'Home' && <HomeScreen onOpenProfile={() => setShowProfile(true)} />}
        {activeTab === 'Map' && <MapScreen />}
        {activeTab === 'Friends' && <FriendsScreen />}
        {activeTab === 'Board' && <LeaderboardScreen />}
      </View>
      <TabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

function isProfileComplete(profile: any): boolean {
  if (!profile) return false;
  // Primary check: explicit onboarding_completed flag
  if (profile.onboarding_completed === true) return true;
  // Fallback for accounts created before the flag existed:
  // If the profile has a real display_name (not empty, not just an email prefix),
  // and a school or gender set, consider onboarding done.
  if (
    profile.display_name &&
    profile.display_name.length > 0 &&
    (profile.school || profile.gender)
  ) {
    return true;
  }
  return false;
}

function RootNavigator() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();

  // Derive onboarding state from profile completeness (no AsyncStorage)
  const onboardingDone = isProfileComplete(profile);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <Image 
          source={require('./assets/Mainlogoblue.png')} 
          style={styles.loadingLogo} 
          resizeMode="contain" 
        />
        <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>Mindful breaks for students</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <AuthScreen />
      </>
    );
  }

  if (!onboardingDone) {
    return (
      <>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <OnboardingScreen onComplete={() => refreshProfile()} />
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <MainApp />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 180,
    height: 180,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 14,
  },
  screenContainer: {
    flex: 1,
  },
  tabBarSafe: {
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
