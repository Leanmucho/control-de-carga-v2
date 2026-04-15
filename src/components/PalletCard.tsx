import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { Pallet } from '../types/database'

interface Props {
  pallet: Pallet
  index?: number
  onCheck: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PalletCard({ pallet, index, onCheck, onEdit, onDelete }: Props) {
  const cargado = pallet.estado === 'cargado'

  return (
    <View style={[styles.card, cargado && styles.cardCargado]}>
      <TouchableOpacity
        style={styles.checkZone}
        onPress={onCheck}
        disabled={cargado}
        activeOpacity={0.65}
      >
        <View style={[styles.circle, cargado && styles.circleDone]}>
          {cargado && <Text style={styles.tick}>✓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.info}>
        {index !== undefined && (
          <Text style={styles.index}>Pallet {index + 1}</Text>
        )}
        <Text style={[styles.cajas, cargado && styles.cajasDone]}>
          {pallet.cantidad_cajas} cajas
        </Text>
        {pallet.hora_carga && (
          <Text style={styles.hora}>
            Cargado a las{' '}
            {new Date(pallet.hora_carga).toLocaleTimeString('es-AR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        )}
      </View>

      {!cargado && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn} hitSlop={8}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionText}>✎</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn} hitSlop={8}>
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <Text style={[styles.actionText, styles.actionTextDanger]}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    overflow: 'hidden',
    minHeight: 56,
  },
  cardCargado: {
    borderColor: '#14532d',
    backgroundColor: '#052e16',
  },
  checkZone: {
    width: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  tick: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  index: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cajas: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cajasDone: { color: '#4ade80' },
  hora: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    paddingRight: spacing.sm,
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconDanger: {
    backgroundColor: '#2d0a0a',
    borderColor: '#7f1d1d',
  },
  actionText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  actionTextDanger: { color: '#f87171' },
})
