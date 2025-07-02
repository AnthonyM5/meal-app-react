import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Custom storage implementation using Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key)
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value)
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Types from the web app
export interface Food {
  id: string
  name: string
  brand?: string
  serving_size: number
  serving_unit: string
  calories_per_serving: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g?: number
  sodium_mg?: number
  cholesterol_mg?: number
  vitamin_a_mcg?: number
  vitamin_c_mg?: number
  calcium_mg?: number
  iron_mg?: number
  is_verified: boolean
}

export interface Meal {
  id: string
  user_id: string
  name?: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  date: string
  notes?: string
  created_at: string
  meal_items: MealItem[]
}

export interface MealItem {
  id: string
  meal_id: string
  food_id: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  food: Food
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'