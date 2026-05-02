import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { getPendingCount } from '../lib/offline/queue'
import { colors, spacing } from '../constants/theme'

export function OfflineSyncBanner() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [pending, setPending] = React.useState(0)

  React.useEffect(() => {
    const refresh = () => setPending(getPendingCount())
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  if (isOnline && pending === 0) return null

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/(main)/sync')}
      style={[styles.wrap, !isOnline && styles.offline]}
    >
      <Text style={styles.text}>
        {!isOnline ? 'Sin conexión' : 'Con conexión'}
        {pending > 0 ? ` · ${pending} pendiente${pending !== 1 ? 's' : ''}` : ''}
      </Text>
      {pending > 0 && <Text style={styles.link}>Sincronizar</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.warning + '22',
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '55',
  },
  offline: {
    backgroundColor: colors.dangerDim,
    borderBottomColor: '#7f1d1d',
  },
  text: { color: colors.text, fontSize: 12, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 12, fontWeight: '800' },
})
