import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../src/hooks/useAuth'
import { Button } from '../../src/components/ui/Button'
import { Input } from '../../src/components/ui/Input'
import { colors, spacing, radius } from '../../src/constants/theme'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Completá email y contraseña')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (e: unknown) {
      Alert.alert('Error al iniciar sesión', e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>📦</Text>
            </View>
            <Text style={styles.title}>Control de Carga</Text>
            <Text style={styles.subtitle}>Plataforma de gestión operativa</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Iniciar sesión</Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="usuario@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
            <Button
              label="Ingresar"
              onPress={handleLogin}
              loading={loading}
              fullWidth
            />
          </View>

          <Text style={styles.footer}>Control de Carga · v1.0</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: { alignItems: 'center', gap: 8 },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoEmoji: { fontSize: 36 },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footer: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
  },
})
