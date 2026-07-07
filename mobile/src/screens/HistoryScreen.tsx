import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useHistoryReadings, RangeDays } from '../hooks/useHistoryReadings';
import { VitalChart } from '../components/VitalChart';
import { TrailMap } from '../components/TrailMap';

const DEVICE_ID = 'tbtn-001';

export const HistoryScreen = () => {
  const [range, setRange] = useState<RangeDays>(1);
  const { downsampled, gpsTrail, loading, error, truncated, readings } = useHistoryReadings(DEVICE_ID, range);

  const ranges: RangeDays[] = [1, 3, 7];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Device: {DEVICE_ID}</Text>
        
        <View style={styles.rangeSelector}>
          {ranges.map(r => (
            <TouchableOpacity 
              key={r}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                {r} Day{r > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      ) : readings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>No readings found for this range.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {truncated && (
            <View style={styles.truncateBanner}>
              <Text style={styles.truncateText}>⚠️ Query capped at 2,000 documents. Showing downsampled data.</Text>
            </View>
          )}

          <VitalChart 
            title="Temperature" 
            data={downsampled.temp} 
            dataKey="temp" 
            color="#f97316" // orange-500
            yAxisSuffix="°"
          />
          <VitalChart 
            title="Heart Rate" 
            data={downsampled.bpm} 
            dataKey="bpm" 
            color="#ec4899" // pink-500
          />
          <VitalChart 
            title="Blood Oxygen" 
            data={downsampled.spo2} 
            dataKey="spo2" 
            color="#818cf8" // indigo-400
            yAxisSuffix="%"
          />

          <Text style={styles.sectionTitle}>GPS Trail</Text>
          <TrailMap trail={gpsTrail} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f3f4f6',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 16,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  rangeBtnActive: {
    backgroundColor: '#374151',
  },
  rangeText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  rangeTextActive: {
    color: '#f3f4f6',
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
  truncateBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 16,
  },
  truncateText: {
    color: '#818cf8',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6',
    marginTop: 16,
    marginBottom: 8,
  },
});
