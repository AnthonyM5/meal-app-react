import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import { useFoodActions } from '../../hooks/useFoodActions'
import { MealSection } from '../../components/MealSection'
import { GuestBanner } from '../../components/GuestBanner'
import type { Meal } from '../../lib/supabase'

export function DashboardScreen() {
  const { user, isGuest, signOut } = useAuth()
  const { getTodaysMeals } = useFoodActions()
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMeals()
  }, [])

  const loadMeals = async () => {
    if (isGuest) {
      setLoading(false)
      return
    }

    try {
      const todaysMeals = await getTodaysMeals()
      setMeals(todaysMeals)
    } catch (error) {
      console.error('Error loading meals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {isGuest && <GuestBanner />}
        
        <View style={styles.mealsContainer}>
          <MealSection
            mealType="breakfast"
            meal={meals.find(meal => meal.meal_type === 'breakfast')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="lunch"
            meal={meals.find(meal => meal.meal_type === 'lunch')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="dinner"
            meal={meals.find(meal => meal.meal_type === 'dinner')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="snack"
            meal={meals.find(meal => meal.meal_type === 'snack')}
            onUpdate={loadMeals}
          />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealsContainer: {
    padding: 16,
    gap: 16,
  },
})