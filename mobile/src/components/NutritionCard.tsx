import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'

interface NutrientItem {
  label: string
  value: number | undefined
  unit: string
}

interface NutritionCardProps {
  title: string
  nutrients: NutrientItem[]
}

export function NutritionCard({ title, nutrients }: NutritionCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.nutrientsList}>
        {nutrients.map((nutrient, index) => (
          <View key={index} style={styles.nutrientRow}>
            <Text style={styles.nutrientLabel}>{nutrient.label}</Text>
            <Text style={styles.nutrientValue}>
              {Math.round((nutrient.value || 0) * 100) / 100} {nutrient.unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  nutrientsList: {
    gap: 8,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nutrientLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  nutrientValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
})