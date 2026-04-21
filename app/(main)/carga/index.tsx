import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { getCargas, eliminarCarga } from '../../../src/lib/queries/cargas'
import { cacheCargas, getCachedCargas, deleteCachedCarga } from '../../../src/lib/offline/db'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { CargaCard } from '../../../src/components/CargaCard'
import { Button } from '../../../src/components/ui/Button'
import { colors, spacing, radius } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'

export default function CargasScreen() {
  const { turno, loading: turnoLoading } = useTurnoActivo()
  const { isOnline } = useNetworkStatus()
  const router = useRouter()
  const [cargas, setCargas] = useState<Carga[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const cargarDatos = useCallback(async (silent = false) => {
    if (!turno?.id) { setCargas([]); return }
    if (!silent) setLoading(true)
    try {
      const data = await getCargas(turno.id)
      setCargas(data)
      cacheCargas(data)
    } catch {
      const cached = getCachedCargas(turno.id)
      if (cached.length > 0) setCargas(cached)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [turno?.id])

  useFocusEffect(
    useCallback(() => { cargarDatos() }, [cargarDatos])
  )

  async function handleRefresh() {
    setRefreshing(true)
    await cargarDatos(true)
  }

  function handleDeleteCarga(cargaId: string, chofer: string) {
    const doDelete = async () => {
      setCargas(prev => prev.filter(c => c.id !== cargaId))
      deleteCachedCarga(cargaId)
      try {
        await eliminarCarga(cargaId)
      } catch (e: unknown) {
        await cargarDatos(true)
        const msg = e instanceof Error ? e.message : 'No se pudo eliminar'
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg)
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
              <CargaCard
                key={c.id}
                carga={c}
                onPress={() => router.push({
                  pathname: '/(main)/carga/[id]',
                  params: { id: c.id },
                })}
                onDelete={() => handleDeleteCarga(c.id, c.chofer)}
              />
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
})
