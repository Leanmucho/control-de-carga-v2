import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { EstadoBadge } from './EstadoBadge'
import { colors, spacing, ESTADO_COLORS } from '../constants/theme'
import type { Carga } from '../types/database'
import type { EstadoCarga } from '../constants/estados'

interface Props {
  carga: Carga
  onPress: () => void
}

export function CargaCard({ carga, onPress }: Props) {
  const totalPallets = carga.clientes_carga?.reduce(
    (sum, c) => sum + (c.pallets?.length ?? 0), 0
  ) ?? 0
  const cargados = carga.clientes_carga?.reduce(
    (sum, c) => sum + (c.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
  ) ?? 0
  const totalCajas = carga.clientes_carga?.reduce(
    (sum, c) => sum + (c.pallets?.reduce((s, p) => s + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
  ) ?? 0
  const incCount = carga.incidencias?.length ?? 0
  const estadoColor = ESTADO_COLORS[carga.estado as EstadoCarga]?.text ?? colors.textMuted

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.wrapper}>
      <View style={[styles.accent, { backgroundColor: estadoColor }]} />
      <View style={styles.body}>
        {/* Fila principal */}
        <View style={styles.mainRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.chofer} numberOfLines={1}>{carga.chofer}</Text>
            <Text style={styles.transporte} numberOfLines={1}>{carga.transporte}</Text>
          </View>
          <EstadoBadge estado={carga.estado as EstadoCarga} size="sm" />
        </View>

        {/* Fila de stats */}
        <View style={styles.statsRow}>
          <StatChip
            label="Pallets"
            value={`${cargados}/${totalPallets}`}
            highlight={cargados === totalPallets && totalPallets > 0}
          />
          <StatChip label="Cajas" value={String(totalCajas)} />
          {carga.numero_remito ? (
            <StatChip label="Remito" value={carga.numero_remito} />
          ) : null}
          {incCount > 0 ? (
            <View style={styles.incBadge}>
              <Text style={styles.incText}>⚠ {incCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, highlight && styles.chipHighlight]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.sm + 4,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleBlock: { flex: 1, paddingRight: 8 },
  chofer: { color: colors.text, fontSize: 15, fontWeight: '700' },
  transporte: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipLabel: { color: colors.textFaint, fontSize: 11 },
  chipValue: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipHighlight: { color: colors.success },
  incBadge: {
    backgroundColor: '#451a03',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  incText: { color: colors.warning, fontSize: 11, fontWeight: '700' },
})
