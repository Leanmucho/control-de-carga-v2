import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { Pallet } from '../types/database'

interface Props {
  pallet: Pallet
  index: number
  onCheck: () => void
  onLongPress: () => void
  key?: string | number
}

export function PalletCard({ pallet, index, onCheck, onLongPress }: Props) {
  const cargado = pallet.estado === 'cargado'

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
      style={[styles.card, cargado && styles.cardCargado]}
    >
      {/* Check zone */}
      <TouchableOpacity
        style={styles.checkZone}
        onPress={onCheck}
        disabled={cargado}
        activeOpacity={0.6}
        hitSlop={8}
      >
        <View style={[styles.circle, cargado && styles.circleDone]}>
          {cargado && <Text style={styles.tick}>✓</Text>}
        </View>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.indexLabel}>Pallet {index + 1}</Text>
        <Text style={[styles.cajas, cargado && styles.cajasDone]}>
          {pallet.cantidad_cajas} cajas
        </Text>
        {pallet.hora_carga && (
          <Text style={styles.hora}>
            {new Date(pallet.hora_carga).toLocaleTimeString('es-AR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        )}
      </View>

      {/* Estado */}
      <View style={styles.right}>
        {cargado ? (
          <View style={styles.badgeDone}>
            <Text style={styles.badgeDoneText}>CARGADO</Text>
          </View>
        ) : (
          <>
            <View style={styles.badgePiso}>
              <Text style={styles.badgePisoText}>EN PISO</Text>
            </View>
            <Text style={styles.hint}>mantené</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
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
    minHeight: 60,
  },
  cardCargado: {
    borderColor: colors.successDim,
    backgroundColor: '#0d1f0d',
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  indexLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cajas: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cajasDone: { color: colors.success },
  hora: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    paddingRight: spacing.md,
    alignItems: 'flex-end',
    gap: 4,
  },
  badgeDone: {
    backgroundColor: '#0d2c0d',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeDoneText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgePiso: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgePisoText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 9,
    letterSpacing: 0.3,
  },
})
