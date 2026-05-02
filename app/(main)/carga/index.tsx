import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { getCargas, eliminarCarga } from '../../../src/lib/queries/cargas'
import { cacheCargas, getCachedCargas, deleteCachedCarga } from '../../../src/lib/offline/db'
import { enqueueOp, getPendingCargaIds, getPendingCount } from '../../../src/lib/offline/queue'
import { syncOfflineQueue } from '../../../src/lib/offline/sync'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { CargaCard } from '../../../src/components/CargaCard'
import { Button } from '../../../src/components/ui/Button'
import { colors, spacing } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'

export default function CargasScreen() {
  const { turno, loading: turnoLoading } = useTurnoActivo()
  const { isOnline } = useNetworkStatus()
  const router = useRouter()
  const [cargas, setCargas] = useState<Carga[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [pendingCount, setPendingCount] = useState(0)

  const cargarDatos = useCallback(async (silent = false) => {
    if (!turno?.id) { setCargas([]); return }
    // Hidratar desde cache primero — incluye cargas creadas offline.
    const cached = getCachedCargas(turno.id)
    if (cached.length > 0) setCargas(cached)
    if (!silent && cached.length === 0) setLoading(true)

    setPendingIds(getPendingCargaIds())
    setPendingCount(getPendingCount())

    if (!isOnline) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      const data = await getCargas(turno.id)
      // Mergear: las cargas que solo existen localmente (pendientes de sync)
      // no están en `data`, las preservamos del cache.
      const remoteIds = new Set(data.map(c => c.id))
      const localOnly = cached.filter(c => !remoteIds.has(c.id))
      const merged = [...localOnly, ...data]
      setCargas(merged)
      // Pasamos los IDs pendientes para que cacheCargas NO los borre del SQLite
      // (de lo contrario perderíamos cargas creadas offline al refrescar online).
      cacheCargas(data, getPendingCargaIds())
    } catch {
      // mantener cache
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [turno?.id, isOnline])

  useFocusEffect(
    useCallback(() => { cargarDatos() }, [cargarDatos])
  )

  async function handleRefresh() {
    setRefreshing(true)
    await cargarDatos(true)
  }

  async function handleSyncPendientes() {
    if (!isOnline) {
      const msg = 'No hay conexión. Podés seguir trabajando; sincronizá cuando vuelva internet.'
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sin conexión', msg)
      return
    }

    setSyncing(true)
    try {
      const result = await syncOfflineQueue()
      if (result.skipped) {
        const msg = 'No hay conexión. Los cambios siguen guardados en este dispositivo.'
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sin conexión', msg)
        return
      }
      if (result.failed > 0) {
        const msg = `Se sincronizaron ${result.synced}, pero quedaron ${result.failed} cambio(s) pendiente(s). Reintentá con buena conexión.`
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sincronización incompleta', msg)
      }
      await cargarDatos(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo sincronizar'
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg)
    } finally {
      setPendingIds(getPendingCargaIds())
      setPendingCount(getPendingCount())
      setSyncing(false)
    }
  }

  function handleDeleteCarga(cargaId: string, chofer: string) {
    const doDelete = async () => {
      setCargas(prev => prev.filter(c => c.id !== cargaId))
      deleteCachedCarga(cargaId)
      if (!isOnline) {
        enqueueOp({ type: 'DELETE_CARGA', cargaId })
        return
      }
      try {
        await eliminarCarga(cargaId)
      } catch (e: unknown) {
        // Encolar y avisar — no revertimos para no marear al usuario.
        enqueueOp({ type: 'DELETE_CARGA', cargaId })
        const msg = e instanceof Error ? e.message : 'No se pudo eliminar — quedó pendiente de sincronizar'
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Aviso', msg)
      }
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar la carga de ${chofer}?`)) doDelete()
    } else {
      Alert.alert('Eliminar carga', `¿Eliminar la carga de ${chofer}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ])
    }
  }

  if (turnoLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!turno) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Cargas</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🚛</Text>
          <Text style={styles.emptyTitle}>Sin turno activo</Text>
          <Text style={styles.emptySub}>Iniciá un turno para registrar cargas</Text>
          <Button
            label="Ir al turno"
            onPress={() => router.push('/(main)/turno')}
            style={{ marginTop: spacing.lg, paddingHorizontal: 32 }}
            variant="secondary"
          />
        </View>
      </SafeAreaView>
    )
  }

  const totalPallets = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce((s2, cl) => s2 + (cl.pallets?.length ?? 0), 0) ?? 0), 0
  )
  const totalCargados = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce(
      (s2, cl) => s2 + (cl.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
    ) ?? 0), 0
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cargas</Text>
          {cargas.length > 0 && (
            <Text style={styles.subtitle}>
              {cargas.length} carga{cargas.length !== 1 ? 's' : ''} · {totalCargados}/{totalPallets} pallets
              {!isOnline ? '  ● Sin red' : ''}
            </Text>
          )}
        </View>
        <Button
          label="+ Nueva"
          onPress={() => router.push('/(main)/carga/nueva')}
          style={{ paddingHorizontal: 14, paddingVertical: 6 }}
          variant="secondary"
        />
      </View>

      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>
              {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar
            </Text>
            <Button
              label={syncing ? 'Sincronizando...' : 'Sincronizar'}
              onPress={handleSyncPendientes}
              variant="secondary"
              disabled={syncing}
              style={styles.syncButton}
            />
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {cargas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🚛</Text>
              <Text style={styles.emptyTitle}>Sin cargas registradas</Text>
              <Text style={styles.emptySub}>Usá el botón + Nueva para agregar una</Text>
            </View>
          ) : (
            cargas.map(c => (
              <View key={c.id}>
                {pendingIds.has(c.id) && (
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingTagText}>● PENDIENTE DE SINCRONIZAR</Text>
                  </View>
                )}
                <CargaCard
                  carga={c}
                  onPress={() => router.push({
                    pathname: '/(main)/carga/[id]',
                    params: { id: c.id },
                  })}
                  onDelete={() => handleDeleteCarga(c.id, c.chofer)}
                />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 1,
  },
  list: { padding: spacing.md, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, marginTop: 4, textAlign: 'center' },
  pendingBanner: {
    backgroundColor: colors.warning + '22',
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '55',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  pendingText: { color: colors.warning, fontSize: 12, fontWeight: '600', flex: 1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncButton: { paddingHorizontal: 10, paddingVertical: 4 },
  pendingTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warning + '22',
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  pendingTagText: { color: colors.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
})
