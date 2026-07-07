import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface TrailMapProps {
  trail: Array<{ lat: number; lon: number; time: number }>;
}

const IIT_JODHPUR_TRAIL = [
  { lat: 26.4715, lon: 73.1134, time: 0 },
  { lat: 26.4725, lon: 73.1145, time: 0 },
  { lat: 26.4735, lon: 73.1152, time: 0 },
  { lat: 26.4745, lon: 73.1160, time: 0 },
];

export const TrailMap: React.FC<TrailMapProps> = ({ trail }) => {
  // If no actual device data is available, fallback to the IIT Jodhpur demo trail
  const activeTrail = (!trail || trail.length === 0) ? IIT_JODHPUR_TRAIL : trail;
  const isDemo = (!trail || trail.length === 0);

  const latest = activeTrail[activeTrail.length - 1];
  const start = activeTrail[0];

  const coordinates = activeTrail.map(pt => ({
    latitude: pt.lat,
    longitude: pt.lon
  }));

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: latest.lat,
          longitude: latest.lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Polyline
          coordinates={coordinates}
          strokeColor="#6366f1" // indigo-500
          strokeWidth={4}
        />
        <Marker
          coordinate={{ latitude: start.lat, longitude: start.lon }}
          title="Start"
          pinColor="blue"
        />
        <Marker
          coordinate={{ latitude: latest.lat, longitude: latest.lon }}
          title="Most Recent"
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
    marginTop: 8,
    marginBottom: 24,
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
  }
});
