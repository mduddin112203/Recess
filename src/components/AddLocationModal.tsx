import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';

interface AddLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  }) => void;
}

export function AddLocationModal({ visible, onClose, onConfirm }: AddLocationModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [address, setAddress] = useState('');
  const [locationName, setLocationName] = useState('');
  const [searching, setSearching] = useState(false);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState('');

  const handleClose = () => {
    setAddress('');
    setLocationName('');
    setGeocoded(null);
    setResolvedAddress('');
    setSearching(false);
    onClose();
  };

  const handleSearch = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter a street address.');
      return;
    }

    setSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Location permission is needed to search addresses.');
        setSearching(false);
        return;
      }

      const results = await Location.geocodeAsync(address.trim());

      if (!results || results.length === 0) {
        Alert.alert('Not Found', 'Could not find that address. Please try a more specific address.');
        setSearching(false);
        return;
      }

      const first = results[0];
      setGeocoded({ lat: first.latitude, lng: first.longitude });
      setResolvedAddress(address.trim());

      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: first.latitude,
          longitude: first.longitude,
        });
        if (reverse && reverse.length > 0) {
          const r = reverse[0];
          const streetPart = r.street || '';
          const namePart = r.name || '';
          const addressLine =
            namePart && streetPart && namePart.includes(streetPart)
              ? namePart
              : streetPart && namePart && streetPart.includes(namePart)
                ? streetPart
                : namePart || streetPart;
          const parts = [addressLine, r.city, r.region].filter(Boolean);
          if (parts.length > 0) {
            setResolvedAddress(parts.join(', '));
          }
        }
      } catch {
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Failed to search for the address. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!geocoded) return;

    const name = locationName.trim() || resolvedAddress || address.trim();
    onConfirm({
      name,
      address: resolvedAddress || address.trim(),
      lat: geocoded.lat,
      lng: geocoded.lng,
    });
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Custom Location</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Address Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Street Address</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.addressInput}
                placeholder="e.g., 1 Castle Point Terrace, Hoboken NJ"
                placeholderTextColor={colors.textSecondary}
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                style={[styles.searchButton, searching && styles.searchButtonDisabled]}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="search" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Map Preview (shown after geocoding) */}
          {geocoded && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Confirm Location</Text>
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.mapView}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={{
                      latitude: geocoded.lat,
                      longitude: geocoded.lng,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    region={{
                      latitude: geocoded.lat,
                      longitude: geocoded.lng,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker
                      coordinate={{ latitude: geocoded.lat, longitude: geocoded.lng }}
                      title={locationName || resolvedAddress}
                    >
                      <View style={styles.mapMarker}>
                        <Ionicons name="location" size={18} color={colors.white} />
                      </View>
                    </Marker>
                  </MapView>
                </View>
                <View style={styles.resolvedAddressRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.resolvedAddressText} numberOfLines={2}>
                    {resolvedAddress}
                  </Text>
                </View>
              </View>

              {/* Optional Name */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location Name (optional)</Text>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Give it a friendly name"
                  placeholderTextColor={colors.textSecondary}
                  value={locationName}
                  onChangeText={setLocationName}
                  autoCapitalize="words"
                />
                <Text style={styles.hintText}>
                  Defaults to the address if left blank
                </Text>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.confirmText}>Use This Location</Text>
              </TouchableOpacity>
            </>
          )}

          {!geocoded && (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>
                Enter a street address above to find your location
              </Text>
              <Text style={styles.emptyHint}>
                Custom locations are temporary and removed after your break ends
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBg,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 10,
    },
    addressInput: {
      flex: 1,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchButtonDisabled: {
      opacity: 0.7,
    },
    mapContainer: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapView: {
      height: 180,
      width: '100%',
    },
    mapMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    resolvedAddressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 4,
    },
    resolvedAddressText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    nameInput: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hintText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    confirmButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 3,
    },
    confirmText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.white,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      fontWeight: '500',
    },
    emptyHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.7,
    },
  });
