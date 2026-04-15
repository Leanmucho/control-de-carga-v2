import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ESTADO_COLORS } from '../constants/theme'
import { ESTADO_LABELS } from '../constants/estados'
import type { EstadoCarga } from '../constants/estados'

interface Props {
  estado: EstadoCarga
  size?: 'sm' | 'md'
}

export function EstadoBadge({ estado, size = 'md' }: Props) {
  const c = ESTADO_COLORS[estado] ?? { bg: '#1e293b', text: '#94a3b8' }
  return (
    <View style={[
      styles.badge,
      { backgroundColor: c.bg, borderColor: c.text },
      size === 'sm' && styles.sm,
    ]}>
      <View style={[styles.dot, { backgroundColor: c.text }]} />
      <Text style={[styles.text, { color: c.text }, size === 'sm' && styles.textSm]}>
        {ESTADO_LABELS[estado]}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    opacity: 0.95,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  textSm: { fontSize: 11 },
})
