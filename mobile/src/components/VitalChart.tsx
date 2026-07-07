import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface VitalChartProps {
  title: string;
  data: Array<{ time: number; [key: string]: number | null }>;
  dataKey: string;
  color: string;
  yAxisSuffix?: string;
}

export const VitalChart: React.FC<VitalChartProps> = ({ title, data, dataKey, color, yAxisSuffix = '' }) => {
  // RN-3 FIX: useWindowDimensions() re-renders when orientation changes.
  // Dimensions.get('window') is a static snapshot that becomes stale after rotation.
  const { width } = useWindowDimensions();
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.noData}>No data available</Text>
      </View>
    );
  }

  // Filter out nulls for the chart
  const validData = data.filter(d => d[dataKey] !== null);
  
  if (validData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.noData}>No valid data</Text>
      </View>
    );
  }

  const chartData = {
    labels: [], // Hide x-axis labels to avoid clutter
    datasets: [
      {
        data: validData.map(d => d[dataKey] as number),
        color: () => color,
        strokeWidth: 2,
      }
    ]
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.pointsCount}>{validData.length} pts</Text>
      </View>
      <LineChart
        data={chartData}
        width={width - 32} // 16px padding each side
        height={220}
        chartConfig={{
          backgroundColor: '#1f2937',
          backgroundGradientFrom: '#1f2937',
          backgroundGradientTo: '#1f2937',
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '1',
            strokeWidth: '1',
            stroke: color
          }
        }}
        bezier
        style={styles.chart}
        withVerticalLabels={false}
        yAxisSuffix={yAxisSuffix}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsCount: {
    color: '#9ca3af',
    fontSize: 12,
  },
  noData: {
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    marginLeft: -16, // Adjusting for chart kit's default padding
  }
});
