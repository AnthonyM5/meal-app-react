import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../../hooks/useAuth'

export function WelcomeScreen({ navigation }: any) {
  const { signInAsGuest } = useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2563eb', '#1d4ed8']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>NutriTrack</Text>
          <Text style={styles.subtitle}>
            Track your nutrition and reach your health goals
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.ghostButton]}
              onPress={signInAsGuest}
            >
              <Text style={styles.ghostButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.guestNote}>
            Guest users can search and view nutrition information. Create an
            account to track meals and save favorites.
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 48,
    opacity: 0.9,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: 'white',
  },
  primaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },
  guestNote: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.8,
  },
})