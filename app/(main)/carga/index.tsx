import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../../src/components/ui/Button'
import { colors, spacing } from '../../../src/constants/theme'

// This tab just redirects to the turno screen logic
// The main carga flow is triggered from the turno screen
export default function CargaIndexScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.emoji}>📦</Text>
        <Text style={styles.text}>Las cargas se gestionan desde el turno activo</Text>
        <Button
          label="Ir al turno"
          onPress={() => router.push('/(main)/turno')}
          style={{ marginTop: spacing.lg, paddingHorizontal: 32 }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  text: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
})
