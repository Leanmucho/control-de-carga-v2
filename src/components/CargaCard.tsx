import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { EstadoBadge } from './EstadoBadge'
import { colors, spacing, radius, ESTADO_COLORS } from '../constants/theme'
import type { Carga } from '../types/database'
import type { EstadoCarga } from '../constants/estados'

interface Props {
  carga: Carga
  onPress: () => void
  key?: string | number
}

export function CargaCard({ carga, onPress }: Props) {
  const totalPallets = carga.clientes_carga?.reduce(
    (s, c) => s + (c.pallets?.length ?? 0), 0
  ) ?? 0
  const cargados = carga.clientes_carga?.reduce(
    (s, c) => s + (c.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
  ) ?? 0
  const totalCajas = carga.clientes_carga?.reduce(
    (s, c) => s + (c.pallets?.reduce((s2, p) => s2 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
  ) ?? 0
  const incCount = carga.incidencias?.length ?? 0
  const accentColor = ESTADO_COLORS[carga.estado as EstadoCarga]?.text ?? colors.textMuted
  const allLoaded = cargados === totalPallets && totalPallets > 0
  const progress = totalPallets > 0 ? cargados / totalPallets : 0

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      {/* Accent strip */}
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.titleArea}>
            <Text style={styles.chofer} numberOfLines={1}>{carga.chofer}</Text>
            <Text style={styles.transporte} numberOfLines={1}>{carga.transporte}</Text>
          </View>
          <EstadoBadge estado={carga.estado as EstadoCarga} size="sm" />
        </View>

        {/* Progress bar (only when there are pallets) */}
        {totalPallets > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[
                styles.progressFill,
                { width: `${progress * 100}%` as any, backgroundColor: allLoaded ? colors.success : colors.primary },
              ]} />
            </View>
            <Text style={[styles.progressText, allLoaded && { color: colors.success }]}>
              {cargados}/{totalPallets}
            </Text>
          </View>
        )}

        {/* Chips row */}
        <View style={styles.chipsRow}>
          {totalCajas > 0 && (
            <Chip label="Cajas" value={String(totalCajas)} />
          )}
          {carga.numero_remito ? (
            <Chip label="Remito" value={carga.numero_remito} />
          ) : null}
          {carga.clarkista_nombre ? (
            <Chip label="Clarkista" value={carga.clarkista_nombre} />
          ) : null}
          {incCount > 0 && (
            <View style={styles.incChip}>
              <Text style={styles.incText}>⚠ {incCount} incid.</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={chip.wrap}>
      <Text style={chip.label}>{label}</Text>
      <Text style={chip.value}>{value}</Text>
    </View>
  )
}

const chip = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  label: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accent: { width: 3 },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: { flex: 1, paddingRight: 8 },
  chofer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  transporte: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderMid,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  incChip: {
    backgroundColor: colors.dangerDim ?? '#3d0000',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  incText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
})
