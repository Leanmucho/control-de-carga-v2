import { Stack, Redirect, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { useEffect } from 'react'
import { useAuth } from '../src/hooks/useAuth'
import { colors } from '../src/constants/theme'
import { initDb } from '../src/lib/offline/db'

export default function RootLayout() {
  const { session, loading } = useAuth()

  useEffect(() => {
    try { initDb() } catch { /* SQLite no disponible en web */ }
  }, [])

  // NOTA: la cola offline NO se drena al volver al primer plano ni al
  // reconectar. La sincronización ocurre solo al cerrar el turno
  // (ver app/(main)/turno/index.tsx). Esto evita carreras mientras el
  // operador sigue cargando y simplifica el modelo offline-first.

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
