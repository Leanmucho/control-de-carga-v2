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
    <View style={[styles.badge, { backgroundColor: c.bg }, size === 'sm' && styles.sm]}>
      <Text style={[styles.text, { color: c.text }, size === 'sm' && styles.textSm]}>
        {ESTADO_LABELS[estado]}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 13, fontWeight: '600' },
  textSm: { fontSize: 11 },
})
