import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { crearCarga } from '../../../src/lib/queries/cargas'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { colors, spacing } from '../../../src/constants/theme'

export default function NuevaCargaScreen() {
  const router = useRouter()
  const { turno } = useTurnoActivo()
  const [chofer, setChofer] = useState('')
  const [transporte, setTransporte] = useState('')
  const [remito, setRemito] = useState('')
  const [clarkista, setClarkista] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCrear() {
    if (!chofer.trim()) { Alert.alert('Error', 'El nombre del chofer es obligatorio'); return }
    if (!transporte.trim()) { Alert.alert('Error', 'El transporte es obligatorio'); return }
    if (!turno) { Alert.alert('Error', 'No hay turno activo'); return }

    setLoading(true)
    try {
      const carga = await crearCarga({
        turno_id: turno.id,
        chofer: chofer.trim(),
        transporte: transporte.trim(),
        numero_remito: remito.trim() || undefined,
        clarkista_nombre: clarkista.trim() || undefined,
      })
      router.replace(`/(main)/carga/${carga.id}`)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear la carga')
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
        <View style={styles.header}>
          <Button label="← Volver" onPress={() => router.back()} variant="ghost" />
          <Text style={styles.title}>Nueva Carga</Text>
          <View style={{ width: 72 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Input
            label="Chofer *"
            value={chofer}
            onChangeText={setChofer}
            placeholder="Nombre del chofer"
            autoCapitalize="words"
          />
          <Input
            label="Transporte *"
            value={transporte}
            onChangeText={setTransporte}
            placeholder="Empresa / patente"
            autoCapitalize="characters"
            containerStyle={{ marginTop: spacing.md }}
          />
          <Input
            label="Número de remito"
            value={remito}
            onChangeText={setRemito}
            placeholder="Opcional"
            keyboardType="numeric"
            containerStyle={{ marginTop: spacing.md }}
          />
          <Input
            label="Clarkista"
            value={clarkista}
            onChangeText={setClarkista}
            placeholder="Nombre del clarkista"
            autoCapitalize="words"
            containerStyle={{ marginTop: spacing.md }}
          />

          <Button
            label="Crear carga"
            onPress={handleCrear}
            loading={loading}
            fullWidth
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  scroll: { padding: spacing.md, paddingBottom: 40 },
})
