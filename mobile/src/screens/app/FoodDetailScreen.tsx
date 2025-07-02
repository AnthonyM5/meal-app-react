import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { NutritionCard } from '../../components/NutritionCard'
import type { Food } from '../../lib/supabase'

interface FoodDetailScreenProps {
  route: {
    params: {
      food: Food
    }
  }
}

export function FoodDetailScreen({ route }: FoodDetailScreenProps) {
  const { food } = route.params

  const macros = [
    { label: 'Protein', value: food.protein_g, unit: 'g' },
    { label: 'Carbs', value: food.carbs_g, unit: 'g' },
    { label: 'Fat', value: food.fat_g, unit: 'g' },
    { label: 'Fiber', value: food.fiber_g, unit: 'g' },
  ]

  const vitamins = [
    { label: 'Vitamin A', value: food.vitamin_a_mcg, unit: 'mcg' },
    { label: 'Vitamin C', value: food.vitamin_c_mg, unit: 'mg' },
  ].filter(item => item.value && item.value > 0)

  const minerals = [
    { label: 'Calcium', value: food.calcium_mg, unit: 'mg' },
    { label: 'Iron', value: food.iron_mg, unit: 'mg' },
  ].filter(item => item.value && item.value > 0)

  const other = [
    { label: 'Sugar', value: food.sugar_g, unit: 'g' },
    { label: 'Sodium', value: food.sodium_mg, unit: 'mg' },
    { label: 'Cholesterol', value: food.cholesterol_mg, unit: 'mg' },
  ].filter(item => item.value && item.value > 0)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{food.name}</Text>
          <View style={styles.metaContainer}>
            <Text style={styles.calories}>
              {Math.round(food.calories_per_serving)} calories per {food.serving_size}{food.serving_unit}
            </Text>
            {food.brand && food.brand !== 'USDA' && (
              <Text style={styles.brand}>{food.brand}</Text>
            )}
            {food.is_verified && (
              <Text style={styles.verified}>✓ Verified</Text>
            )}
          </View>
        </View>

        <View style={styles.nutritionContainer}>
          <NutritionCard title="Macros" nutrients={macros} />
          
          {vitamins.length > 0 && (
            <NutritionCard title="Vitamins" nutrients={vitamins} />
          )}
          
          {minerals.length > 0 && (
            <NutritionCard title="Minerals" nutrients={minerals} />
          )}
          
          {other.length > 0 && (
            <NutritionCard title="Other" nutrients={other} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  metaContainer: {
    gap: 4,
  },
  calories: {
    fontSize: 16,
    color: '#6b7280',
  },
  brand: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  verified: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  nutritionContainer: {
    padding: 16,
    gap: 16,
  },
})