import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { Pallet } from '../types/database'

interface Props {
  pallet: Pallet
  onCheck: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PalletCard({ pallet, onCheck, onEdit, onDelete }: Props) {
  const cargado = pallet.estado === 'cargado'

  return (
    <View style={[styles.card, cargado && styles.cardCargado]}>
      <TouchableOpacity
        style={[styles.checkBtn, cargado && styles.checkBtnCargado]}
        onPress={onCheck}
        disabled={cargado}
        activeOpacity={0.7}
      >
        <Text style={[styles.checkIcon, cargado && styles.checkIconCargado]}>
          {cargado ? '✓' : '○'}
        </Text>
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={[styles.cajas, cargado && styles.cajasCargadas]}>
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

      {!cargado && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Text style={styles.actionText}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: colors.danger }]}>✕</Text>
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
  },
  cardCargado: {
    borderColor: '#166534',
    backgroundColor: '#052e16',
  },
  checkBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  checkBtnCargado: { backgroundColor: '#15803d' },
  checkIcon: { fontSize: 22, color: colors.textFaint },
  checkIconCargado: { color: '#fff', fontWeight: '700' },
  info: { flex: 1, paddingHorizontal: spacing.sm },
  cajas: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cajasCargadas: { color: '#4ade80' },
  hora: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', paddingRight: 8, gap: 4 },
  actionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 16, color: colors.textMuted },
})
