import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Card } from './ui/Card'
import { EstadoBadge } from './EstadoBadge'
import { colors, spacing } from '../constants/theme'
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

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.info}>
            <Text style={styles.chofer}>{carga.chofer}</Text>
            <Text style={styles.transporte}>{carga.transporte}</Text>
          </View>
          <EstadoBadge estado={carga.estado as EstadoCarga} size="sm" />
        </View>

        <View style={styles.row}>
          {carga.clarkista_nombre ? (
            <Text style={styles.meta}>Clarkista: {carga.clarkista_nombre}</Text>
          ) : null}
          {carga.numero_remito ? (
            <Text style={styles.meta}>Remito: {carga.numero_remito}</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {carga.clientes_carga?.length ?? 0} clientes · {cargados}/{totalPallets} pallets
          </Text>
          {(carga.incidencias?.length ?? 0) > 0 && (
            <Text style={styles.incidencia}>
              ⚠ {carga.incidencias!.length} incidencia{carga.incidencias!.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  info: { flex: 1 },
  chofer: { color: colors.text, fontSize: 16, fontWeight: '700' },
  transporte: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  meta: { color: colors.textFaint, fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { color: colors.textMuted, fontSize: 13 },
  incidencia: { color: colors.warning, fontSize: 12, fontWeight: '600' },
})
