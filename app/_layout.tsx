import { Stack, Redirect, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../src/hooks/useAuth'
import { colors } from '../src/constants/theme'

export default function RootLayout() {
  const { session, loading } = useAuth()
  const segments = useSegments()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const inAuth = segments[0] === '(auth)'

  if (!session && !inAuth) {
    return <Redirect href="/(auth)/login" />
  }

  if (session && inAuth) {
    return <Redirect href="/(main)/turno" />
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
