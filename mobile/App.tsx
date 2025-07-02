import 'react-native-url-polyfill/auto'
import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthProvider } from './src/contexts/AuthContext'
import { AuthNavigator } from './src/navigation/AuthNavigator'
import { AppNavigator } from './src/navigation/AppNavigator'
import { useAuth } from './src/hooks/useAuth'
import { LoadingScreen } from './src/screens/LoadingScreen'

const Stack = createNativeStackNavigator()

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}