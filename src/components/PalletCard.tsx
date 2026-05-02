import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { Pallet } from '../types/database'

interface Props {
  pallet: Pallet
  index: number
  onCheck: () => void
  onLongPress: () => void
  onDelete: () => void
  canCheck?: boolean
  key?: string | number
}

export function PalletCard({ pallet, index, onCheck, onLongPress, onDelete, canCheck = true }: Props) {
  const cargado = pallet.estado === 'cargado'
  const checkDisabled = cargado || !canCheck

  return (
    <View style={[styles.card, cargado && styles.cardCargado]}>

      {/* Zona check — lado izquierdo, full height, 64px */}
      <TouchableOpacity
        style={[styles.checkZone, cargado && styles.checkZoneDone, checkDisabled && !cargado && styles.checkZoneDisabled]}
        onPress={onCheck}
        onLongPress={onLongPress}
        delayLongPress={400}
        disabled={checkDisabled}
        activeOpacity={0.5}
      >
        <View style={[styles.circle, cargado && styles.circleDone, checkDisabled && !cargado && styles.circleDisabled]}>
          {cargado && <Text style={styles.tick}>✓</Text>}
        </View>
      </TouchableOpacity>

      {/* Info — centro */}
      <TouchableOpacity
        style={styles.info}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
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
        {!cargado && canCheck && (
          <Text style={styles.hint}>Tocá el círculo para marcar · mantenés para editar</Text>
        )}
      </TouchableOpacity>

      {/* Zona derecha: badge + delete */}
      <View style={styles.right}>
        {cargado ? (
          <View style={styles.badgeDone}>
            <Text style={styles.badgeDoneText}>✓ CARGADO</Text>
          </View>
        ) : (
          <>
            <View style={styles.badgePiso}>
              <Text style={styles.badgePisoText}>EN PISO</Text>
            </View>
            {/* Zona eliminar — full height, separada con borde */}
            <TouchableOpacity
              style={styles.deleteZone}
              onPress={onDelete}
              activeOpacity={0.6}
            >
              <Text style={styles.deleteIcon}>🗑</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    overflow: 'hidden',
    minHeight: 72,
  },
  cardCargado: {
    borderColor: colors.successDim,
    backgroundColor: '#0d1f0d',
  },

  // ── Check zone ──────────────────────────────────────────────────────────────
  checkZone: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  checkZoneDone: {
    backgroundColor: '#0a1f0a',
    borderRightColor: colors.successDim,
  },
  checkZoneDisabled: {
    opacity: 0.5,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.borderHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  circleDisabled: {
    borderColor: colors.border,
  },
  tick: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 19,
  },

  // ── Info ────────────────────────────────────────────────────────────────────
  info: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    justifyContent: 'center',
  },
  indexLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cajas: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cajasDone: { color: colors.success },
  hora: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Right side ──────────────────────────────────────────────────────────────
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  badgeDone: {
    backgroundColor: '#0d2c0d',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: spacing.md,
    alignSelf: 'center',
  },
  badgeDoneText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgePiso: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
    marginRight: spacing.sm,
  },
  badgePisoText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Delete zone — full height, 56px, separated by border ───────────────────
  deleteZone: {
    width: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#5f1d1d',
    backgroundColor: '#1a0505',
  },
  deleteIcon: {
    fontSize: 20,
  },
})
