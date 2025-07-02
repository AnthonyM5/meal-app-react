import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import type { Food } from '../lib/supabase'

interface FoodCardProps {
  food: Food
  onPress: () => void
}

export function FoodCard({ food, onPress }: FoodCardProps) {
  const getSourceBadge = () => {
    if (food.brand === 'USDA') return { label: 'USDA', color: '#2563eb' }
    if (food.is_verified) return { label: 'Verified', color: '#059669' }
    return null
  }

  const sourceBadge = getSourceBadge()

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {food.name}
        </Text>
        <View style={styles.badges}>
          {food.brand && food.brand !== 'USDA' && (
            <View style={[styles.badge, styles.brandBadge]}>
              <Text style={styles.brandBadgeText}>{food.brand}</Text>
            </View>
          )}
          {sourceBadge && (
            <View style={[styles.badge, { backgroundColor: sourceBadge.color }]}>
              <Text style={styles.badgeText}>{sourceBadge.label}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.serving}>
        {Math.round(food.calories_per_serving)} cal per {food.serving_size}{food.serving_unit}
      </Text>

      <View style={styles.macros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(food.protein_g)}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(food.carbs_g)}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(food.fat_g)}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(food.fiber_g)}g</Text>
          <Text style={styles.macroLabel}>Fiber</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  brandBadge: {
    backgroundColor: '#f3f4f6',
  },
  brandBadgeText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  badgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  serving: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 2,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  macroLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
})