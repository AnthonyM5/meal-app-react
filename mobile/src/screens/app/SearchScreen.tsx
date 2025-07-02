import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFoodSearch } from '../../hooks/useFoodSearch'
import { FoodCard } from '../../components/FoodCard'
import type { Food } from '../../lib/supabase'

export function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('')
  const { foods, loading, searchFoods } = useFoodSearch()

  const handleSearch = (text: string) => {
    setQuery(text)
    if (text.length >= 2) {
      searchFoods(text)
    }
  }

  const handleFoodPress = (food: Food) => {
    navigation.navigate('FoodDetail', { food })
  }

  const renderFood = ({ item }: { item: Food }) => (
    <FoodCard food={item} onPress={() => handleFoodPress(item)} />
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Foods</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for foods..."
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
          />
        </View>
      </View>

      <FlatList
        data={foods}
        renderItem={renderFood}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No foods found for "{query}"</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
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
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
})