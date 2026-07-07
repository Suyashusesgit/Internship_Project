import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLiveReading } from '../hooks/useLiveReading';
import { VitalCard } from '../components/VitalCard';
import { GpsMap } from '../components/GpsMap';

const DEVICE_ID = 'tbtn-001';

export const DashboardScreen = () => {
  const { latest, loading, error, secondsAgo } = useLiveReading(DEVICE_ID);

  const getStatus = (value: number | null, type: 'temp' | 'bpm' | 'spo2') => {
    if (value === null) return 'normal';
    if (type === 'temp') {
      if (value > 39.5 || value < 37.0) return 'critical';
      if (value > 39.0 || value < 37.5) return 'warning';
      return 'normal';
    }
    if (type === 'bpm') {
      if (value > 160 || value < 50) return 'critical';
      if (value > 140 || value < 60) return 'warning';
      return 'normal';
    }
    if (type === 'spo2') {
      if (value < 90) return 'critical';
      if (value < 95) return 'warning';
      return 'normal';
    }
    return 'normal';
  };

  if (loading && !latest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Connecting to Firebase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isStale = secondsAgo !== null && secondsAgo > 120;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Vitals</Text>
          <Text style={styles.subtitle}>Army Dog Health Telemetry</Text>
          <Text style={styles.subtitle}>Device: {DEVICE_ID}</Text>
        </View>

        {isStale && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>⚠️ Device offline or out of range. Showing last known values.</Text>
          </View>
        )}

        <View style={styles.row}>
          <VitalCard
            title="Temperature"
            value={latest?.temp?.toFixed(1) ?? '--'}
            unit="°C"
            status={getStatus(latest?.temp ?? null, 'temp')}
          />
          <VitalCard
            title="Heart Rate"
            value={latest?.bpm ?? '--'}
            unit="BPM"
            status={getStatus(latest?.bpm ?? null, 'bpm')}
          />
        </View>
        
        <View style={styles.row}>
          <VitalCard
            title="Blood Oxygen"
            value={latest?.spo2 ?? '--'}
            unit="SpO₂%"
            status={getStatus(latest?.spo2 ?? null, 'spo2')}
          />
        </View>

        <Text style={styles.sectionTitle}>GPS Location</Text>
        <GpsMap lat={latest?.lat ?? null} lon={latest?.lon ?? null} />

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // gray-900
  },
  scrollContent: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  errorText: {
    color: '#ef4444',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f3f4f6', // gray-100
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6',
    marginTop: 24,
    marginBottom: 8,
  },
  staleBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 16,
  },
  staleText: {
    color: '#f59e0b',
    fontSize: 14,
  },
});
