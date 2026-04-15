import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { Pallet } from '../types/database'

interface Props {
  pallet: Pallet
  index: number
  onCheck: () => void
  onLongPress: () => void
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
        <Text style={styles.index}>Pallet {index + 1}</Text>
        <Text style={[styles.cajas, cargado && styles.cajasDone]}>
          {pallet.cantidad_cajas} cajas
        </Text>
        {pallet.hora_carga && (
          <Text style={styles.hora}>
            Cargado{' '}
            {new Date(pallet.hora_carga).toLocaleTimeString('es-AR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        )}
      </View>

      {/* Estado indicator */}
      <View style={styles.right}>
        {cargado ? (
          <View style={styles.estadoDone}>
            <Text style={styles.estadoDoneText}>CARGADO</Text>
          </View>
        ) : (
          <View style={styles.estadoPiso}>
            <Text style={styles.estadoPisoText}>EN PISO</Text>
          </View>
        )}
        {!cargado && (
          <Text style={styles.longPressHint}>mantené</Text>
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
    borderColor: '#14532d',
    backgroundColor: '#052e16',
  },
  checkZone: {
    width: 60,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cajasDone: { color: '#4ade80' },
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
  estadoDone: {
    backgroundColor: '#052e16',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#166534',
  },
  estadoDoneText: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  estadoPiso: {
    backgroundColor: '#0c1f36',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  estadoPisoText: {
    color: '#60a5fa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  longPressHint: {
    color: colors.textFaint,
    fontSize: 9,
    letterSpacing: 0.3,
  },
})
