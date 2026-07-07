import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface GpsMapProps {
  lat: number | null;
  lon: number | null;
}

export const GpsMap: React.FC<GpsMapProps> = ({ lat, lon }) => {
  // RN-4 FIX: Use a ref + animateToRegion() instead of a controlled `region` prop.
  //
  // Problem: passing `region` makes MapView a fully-controlled component — every
  // Firestore snapshot (every 15 s) creates a new region object, which React
  // bridges to the native map engine as a re-render even when the coordinates
  // haven't actually changed.
  //
  // Fix: set `initialRegion` once, then drive subsequent position updates via
  // the native animateToRegion() API from a useEffect. The map animation runs
  // entirely on the native side with no React render cycle involvement.
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (lat === null || lon === null) return;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      300 // 300 ms smooth pan
    );
  }, [lat, lon]);

  if (lat === null || lon === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Waiting for GPS Lock...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        // No `region` prop — map is uncontrolled after initial mount.
        // Position updates are driven by animateToRegion() in the useEffect above.
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lon }}
          title="T-BTN Dog Tracker"
          description="Live Location"
          pinColor="red"
        />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
});
