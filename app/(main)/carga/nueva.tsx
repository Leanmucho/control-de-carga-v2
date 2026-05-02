import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { crearCarga } from '../../../src/lib/queries/cargas'
import { cacheCarga } from '../../../src/lib/offline/db'
import { enqueueOp } from '../../../src/lib/offline/queue'
import { genUuid } from '../../../src/lib/uuid'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { colors, spacing } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'

export default function NuevaCargaScreen() {
  const router = useRouter()
  const { turno } = useTurnoActivo()
  const { isOnline } = useNetworkStatus()
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

    // Generamos el UUID local — el mismo que va a usar Postgres cuando sincronicemos.
    const localId = genUuid()
    const now = new Date().toISOString()
    const payload = {
      id: localId,
      turno_id: turno.id,
      chofer: chofer.trim(),
      transporte: transporte.trim(),
      numero_remito: remito.trim() || undefined,
      clarkista_nombre: clarkista.trim() || undefined,
    }

    // Cacheamos enseguida para que el detalle funcione apenas navegamos.
    const cargaLocal: Carga = {
      id: localId,
      turno_id: turno.id,
      chofer: payload.chofer,
      transporte: payload.transporte,
      numero_remito: payload.numero_remito ?? '',
      clarkista_id: null,
      clarkista_nombre: payload.clarkista_nombre ?? '',
      estado: 'en_piso',
      hora_llegada_camion: null,
      hora_inicio_carga: null,
      hora_fin_carga: null,
      notas: '',
      created_at: now,
      clientes_carga: [],
      incidencias: [],
    }
    cacheCarga(cargaLocal)

    if (!isOnline) {
      // Sin red: encolar y navegar. Cuando vuelva la red el sync ejecuta el INSERT
      // con este mismo `id`, así que la carga del servidor queda con el mismo UUID.
      enqueueOp({ type: 'CREATE_CARGA', payload, localId })
      setLoading(false)
      router.replace(`/(main)/carga/${localId}`)
      return
    }

    try {
      const carga = await crearCarga(payload)
      cacheCarga(carga)
      router.replace(`/(main)/carga/${carga.id}`)
    } catch {
      // Falló online (red intermitente) — encolar igual y navegar al cache local.
      enqueueOp({ type: 'CREATE_CARGA', payload, localId })
      router.replace(`/(main)/carga/${localId}`)
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
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>● Sin red — la carga se sincroniza al reconectarse</Text>
            </View>
          )}

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
  offlineBanner: {
    backgroundColor: colors.warning + '22',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
})
