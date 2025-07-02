import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../hooks/useAuth'
import type { Meal, MealType } from '../lib/supabase'

interface MealSectionProps {
  mealType: MealType
  meal?: Meal
  onUpdate: () => void
}

export function MealSection({ mealType, meal, onUpdate }: MealSectionProps) {
  const { isGuest } = useAuth()

  const mealItems = meal?.meal_items || []
  const totalCalories = mealItems.reduce((sum, item) => sum + item.calories, 0)

  const getMealIcon = (type: MealType) => {
    switch (type) {
      case 'breakfast':
        return 'sunny-outline'
      case 'lunch':
        return 'partly-sunny-outline'
      case 'dinner':
        return 'moon-outline'
      case 'snack':
        return 'nutrition-outline'
    }
  }

  const getMealTitle = (type: MealType) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name={getMealIcon(mealType)} size={20} color="#374151" />
          <Text style={styles.title}>{getMealTitle(mealType)}</Text>
          {!isGuest && (
            <Text style={styles.calories}>{Math.round(totalCalories)} cal</Text>
          )}
        </View>
        {!isGuest && (
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={20} color="#2563eb" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {isGuest ? (
          <Text style={styles.guestText}>Sign in to track your meals</Text>
        ) : mealItems.length === 0 ? (
          <Text style={styles.emptyText}>No foods added yet</Text>
        ) : (
          <View style={styles.itemsList}>
            {mealItems.map((item) => (
              <View key={item.id} style={styles.mealItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.food.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} {item.unit} • {Math.round(item.calories)} cal
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  calories: {
    fontSize: 14,
    color: '#6b7280',
  },
  addButton: {
    padding: 4,
  },
  content: {
    minHeight: 40,
  },
  guestText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
  itemsList: {
    gap: 8,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  itemDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
})