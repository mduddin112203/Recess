export const COLORS = {
  primary: '#1FB6A6',
  secondary: '#2F80ED',
  background: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#64748B',
  accent: '#A7F3D0',
  white: '#FFFFFF',
  black: '#000000',
  border: '#E2E8F0',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  cardBg: '#FFFFFF',
  shadow: '#000000',
};

export const DARK_COLORS = {
  primary: '#1FB6A6',
  secondary: '#2F80ED',
  background: '#0B0F14',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  accent: '#A7F3D0',
  white: '#FFFFFF',
  black: '#000000',
  border: '#1E293B',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  cardBg: '#121821',
  shadow: '#000000',
};

export const BREAK_TYPES = [
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#8B5CF6' },
  { id: 'walk', label: 'Walk', icon: 'walk-outline', color: '#10B981' },
  { id: 'gym', label: 'Gym', icon: 'barbell-outline', color: '#EF4444' },
  { id: 'quiet', label: 'Quiet', icon: 'book-outline', color: '#6366F1' },
  { id: 'coffee', label: 'Coffee', icon: 'cafe-outline', color: '#F59E0B' },
  { id: 'custom', label: 'Custom', icon: 'create-outline', color: '#64748B' },
] as const;

export const BLOCK_TYPES = [
  { id: 'class', label: 'Class', icon: 'school-outline', color: '#2F80ED' },
  { id: 'study', label: 'Study', icon: 'reader-outline', color: '#8B5CF6' },
  { id: 'work', label: 'Work', icon: 'briefcase-outline', color: '#F59E0B' },
  { id: 'break', label: 'Break', icon: 'cafe-outline', color: '#1FB6A6' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#64748B' },
] as const;

export const BREAK_LENGTHS = [
  { value: 10, label: '10 min', description: 'Quick reset' },
  { value: 15, label: '15 min', description: 'Short break' },
  { value: 25, label: '25 min', description: 'Standard' },
  { value: 45, label: '45 min', description: 'Deep recharge' },
] as const;

export const CAMPUS_ZONES = [
  { id: 'library', name: 'Library', building: 'Samuel C. Williams Library', address: '1 Castle Point Terrace, Hoboken, NJ 07030', lat: 40.74479, lng: -74.02533, radius_m: 100, icon: 'library-outline' },
  { id: 'student-center', name: 'Student Center', building: 'Howe Center', address: '530 River St, Hoboken, NJ 07030', lat: 40.74510, lng: -74.02480, radius_m: 80, icon: 'business-outline' },
  { id: 'gym', name: 'Gym', building: 'Schaefer Athletic Center', address: '800 Castle Point Terrace, Hoboken, NJ 07030', lat: 40.74610, lng: -74.02280, radius_m: 120, icon: 'fitness-outline' },
  { id: 'cafe', name: 'Cafe', building: 'Pierce Dining Hall', address: '618 River St, Hoboken, NJ 07030', lat: 40.74550, lng: -74.02460, radius_m: 50, icon: 'cafe-outline' },
  { id: 'quad', name: 'Quad', building: 'Martha Bayard Stevens Quad', address: 'Stevens Institute of Technology, Hoboken, NJ 07030', lat: 40.74540, lng: -74.02410, radius_m: 150, icon: 'leaf-outline' },
] as const;

export const POINTS = {
  active: 8,
  walk: 10,
  gym: 12,
  friendOverlap: 10,
  groupRecess: 15,
  dailyCaps: { active: 3, physical: 2, social: 30 },
} as const;

export const LEADERBOARD_CATEGORIES = [
  { id: 'total', label: 'Total', icon: 'trophy' },
  { id: 'active', label: 'Active', icon: 'checkmark-circle' },
  { id: 'physical', label: 'Physical', icon: 'fitness' },
  { id: 'social', label: 'Social', icon: 'people' },
] as const;

export const STATUS_COLORS = {
  free: '#10B981',
  busy: '#EF4444',
  in_recess: '#2F80ED',
} as const;

export const STATUS_LABELS = {
  free: 'Free',
  busy: 'Busy',
  in_recess: 'In Recess',
} as const;

export const GENDER_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
] as const;
