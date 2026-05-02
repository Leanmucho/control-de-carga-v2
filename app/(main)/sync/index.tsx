import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { getQueue } from '../../../src/lib/offline/queue'
import { syncOfflineQueue } from '../../../src/lib/offline/sync'
import { describeOfflineOp } from '../../../src/lib/offline/pendingDescriptions'
import { Button } from '../../../src/components/ui/Button'
import { colors, spacing, radius } from '../../../src/constants/theme'
import type { OfflineOp } from '../../../src/lib/offline/queue'

export default function SyncScreen() {
  const { isOnline } = useNetworkStatus()
  const [items, setItems] = useState<Array<{ id: string; op: OfflineOp }>>([])
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setItems(getQueue())
  }, [])

  useFocusEffect(useCallback(() => {
    refresh()
  }, [refresh]))

  async function handleSync() {
    if (!isOnline) {
      const msg = 'No hay conexión. Los cambios siguen guardados en este dispositivo.'
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sin conexión', msg)
      return
    }

    setSyncing(true)
    setLastResult(null)
    try {
      const result = await syncOfflineQueue()
      refresh()
      if (result.skipped) {
        setLastResult('Sin conexión. No se intentó sincronizar.')
      } else if (result.failed > 0) {
        setLastResult(`Sincronizados: ${result.synced}. Pendientes con error: ${result.failed}.`)
      } else {
        setLastResult(`Sincronizados: ${result.synced}.`)
      }
    } catch (e: unknown) {
      setLastResult(e instanceof Error ? e.message : 'No se pudo sincronizar.')
    } finally {
      setSyncing(false)
      refresh()
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sincronización</Text>
          <Text style={styles.subtitle}>
            {isOnline ? 'Con conexión' : 'Sin conexión'} · {items.length} pendiente{items.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Button
          label={syncing ? 'Sync...' : 'Sincronizar'}
          onPress={handleSync}
          disabled={syncing || items.length === 0}
          loading={syncing}
          variant="secondary"
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
        />
      </View>

      {lastResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{lastResult}</Text>
        </View>
      )}

      {syncing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Todo sincronizado</Text>
          <Text style={styles.emptySub}>No hay cambios pendientes en este dispositivo.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item, index) => {
            const desc = describeOfflineOp(item.op)
            return (
              <View key={item.id} style={styles.row}>
                <Text style={styles.index}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{desc.title}</Text>
                  <Text style={styles.rowDetail} numberOfLines={2}>{desc.detail}</Text>
                </View>
                <Text style={styles.type}>{item.op.type}</Text>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  resultBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  resultText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  emptySub: { color: colors.textFaint, fontSize: 13, marginTop: 4, textAlign: 'center' },
  list: { padding: spacing.md, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  index: { color: colors.textFaint, width: 24, fontSize: 12, fontWeight: '800' },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowDetail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  type: { color: colors.textFaint, fontSize: 9, fontWeight: '700' },
})
