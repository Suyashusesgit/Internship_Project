import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface VitalCardProps {
  title: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

const getStatusColor = (status: VitalCardProps['status']) => {
  switch (status) {
    case 'critical': return '#ef4444'; // red-500
    case 'warning': return '#f59e0b'; // amber-500
    case 'normal': return '#10b981'; // emerald-500
    default: return '#374151'; // gray-700
  }
};

export const VitalCard: React.FC<VitalCardProps> = ({ title, value, unit, status }) => {
  const color = getStatusColor(status);
  
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1f2937', // gray-800
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    flex: 1,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    color: '#9ca3af', // gray-400
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  unit: {
    color: '#9ca3af',
    fontSize: 16,
    marginLeft: 4,
  },
});
