import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal,
  TouchableOpacity, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCarga } from '../../../../src/hooks/useCarga'
import { addCliente } from '../../../../src/lib/queries/clientes'
import { addIncidencia } from '../../../../src/lib/queries/incidencias'
import { Button } from '../../../../src/components/ui/Button'
import { Card } from '../../../../src/components/ui/Card'
import { EstadoBadge } from '../../../../src/components/EstadoBadge'
import { Input } from '../../../../src/components/ui/Input'
import { colors, spacing, radius } from '../../../../src/constants/theme'
import { TRANSICIONES, TRANSICION_LABELS, TIPOS_INCIDENCIA } from '../../../../src/constants/estados'
import type { EstadoCarga } from '../../../../src/constants/estados'
import type { ClienteCarga } from '../../../../src/types/database'

export default function CargaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { carga, loading, avanzar, registrarLlegada, guardarNotaCarga, checkPallet, refresh } = useCarga(id)

  const [notaText, setNotaText] = useState('')
  const [showNota, setShowNota] = useState(false)
  const [showCliente, setShowCliente] = useState(false)
  const [showIncidencia, setShowIncidencia] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [incTipo, setIncTipo] = useState<string>(TIPOS_INCIDENCIA[0])
  const [incDesc, setIncDesc] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading || !carga) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const siguienteEstado = TRANSICIONES[carga.estado as EstadoCarga]
  const btnLabel = TRANSICION_LABELS[carga.estado as EstadoCarga]

  const total = carga.clientes_carga?.reduce((s, c) => s + (c.pallets?.length ?? 0), 0) ?? 0
  const cargados = carga.clientes_carga?.reduce(
    (s, c) => s + (c.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
  ) ?? 0
  const pendientes = total - cargados
  const cajas = carga.clientes_carga?.reduce(
    (s, c) => s + (c.pallets?.reduce((s2, p) => s2 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
  ) ?? 0

  async function handleAvanzar() {
    if (!siguienteEstado) return
    Alert.alert('Confirmar', btnLabel, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try { await avanzar(siguienteEstado) }
          catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'Error') }
        },
      },
    ])
  }

  async function handleCheckPallet(palletId: string) {
    try {
      await checkPallet(palletId)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo marcar el pallet')
    }
  }

  async function handleAddCliente() {
    if (!nuevoCliente.trim()) return
    setSaving(true)
    try {
      await addCliente({
        carga_id: id,
        nombre: nuevoCliente.trim(),
        orden: (carga?.clientes_carga?.length ?? 0) + 1,
      })
      setNuevoCliente('')
      setShowCliente(false)
      await refresh()
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleGuardarNota() {
    setSaving(true)
    try {
      await guardarNotaCarga(notaText)
      setShowNota(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddIncidencia() {
    if (!incDesc.trim()) return
    setSaving(true)
    try {
      await addIncidencia({ carga_id: id, tipo: incTipo, descripcion: incDesc.trim() })
      setIncDesc('')
      setShowIncidencia(false)
      await refresh()
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button label="← Volver" onPress={() => router.back()} variant="ghost" />
        <EstadoBadge estado={carga.estado as EstadoCarga} size="sm" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Info card */}
        <Card style={styles.infoCard}>
          <Text style={styles.chofer}>{carga.chofer}</Text>
          <Text style={styles.transporte}>{carga.transporte}</Text>
          <View style={styles.metaRow}>
            {carga.clarkista_nombre ? <Text style={styles.meta}>Clarkista: {carga.clarkista_nombre}</Text> : null}
            {carga.numero_remito ? <Text style={styles.meta}>Remito: {carga.numero_remito}</Text> : null}
          </View>
          <View style={styles.tiempos}>
            {!carga.hora_llegada_camion ? (
              <Button
                label="🚛 Llegó el camión"
                onPress={() => registrarLlegada().catch(() => {})}
                variant="secondary"
                style={{ flex: 1 }}
              />
            ) : (
              <Text style={styles.tiempo}>
                Llegada: {new Date(carga.hora_llegada_camion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </Card>

        {/* Stats strip */}
        {total > 0 && (
          <View style={styles.statsStrip}>
            <MiniStat label="Total" value={total} />
            <MiniStat label="Cargados" value={cargados} color={colors.success} />
            <MiniStat label="Pendientes" value={pendientes} color={pendientes > 0 ? colors.warning : colors.textFaint} />
            <MiniStat label="Cajas" value={cajas} />
          </View>
        )}

        {/* Botón de transición */}
        {siguienteEstado && (
          <Button
            label={btnLabel}
            onPress={handleAvanzar}
            variant={siguienteEstado === 'finalizado' ? 'success' : 'primary'}
            fullWidth
            style={{ marginBottom: spacing.md }}
          />
        )}

        {/* ── Clientes + Pallets inline ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clientes</Text>
          <Button
            label="+ Cliente"
            onPress={() => setShowCliente(true)}
            variant="secondary"
            style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          />
        </View>

        {(carga.clientes_carga ?? []).length === 0 ? (
          <Text style={styles.empty}>Sin clientes aún</Text>
        ) : (
          carga.clientes_carga!.map(c => (
            <ClienteSection
              key={c.id}
              cliente={c}
              cargaId={id}
              onCheckPallet={handleCheckPallet}
              onEditPallets={() => router.push({
                pathname: '/(main)/carga/[id]/pallets',
                params: { id, clienteId: c.id, clienteNombre: c.nombre },
              })}
            />
          ))
        )}

        {/* ── Incidencias ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Incidencias</Text>
          <Button
            label="+ Incidencia"
            onPress={() => setShowIncidencia(true)}
            variant="secondary"
            style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          />
        </View>
        {(carga.incidencias ?? []).length === 0 ? (
          <Text style={styles.empty}>Sin incidencias</Text>
        ) : (
          carga.incidencias!.map(inc => (
            <Card key={inc.id} style={styles.incCard}>
              <View style={styles.incRow}>
                <Text style={styles.incTipo}>{inc.tipo}</Text>
                <Text style={styles.incHora}>
                  {new Date(inc.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.incDesc}>{inc.descripcion}</Text>
            </Card>
          ))
        )}

        {/* ── Nota ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Nota</Text>
          <Button
            label={carga.notas ? 'Editar' : '+ Nota'}
            onPress={() => { setNotaText(carga.notas ?? ''); setShowNota(true) }}
            variant="secondary"
            style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          />
        </View>
        {carga.notas ? (
          <Card><Text style={styles.notaText}>{carga.notas}</Text></Card>
        ) : (
          <Text style={styles.empty}>Sin notas</Text>
        )}
      </ScrollView>

      {/* ── Modales ── */}
      <Modal visible={showCliente} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowCliente(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <View style={styles.dragHandle} />
                <Text style={styles.modalTitle}>Nuevo cliente</Text>
                <Input
                  value={nuevoCliente}
                  onChangeText={setNuevoCliente}
                  placeholder="Nombre del cliente"
                  autoCapitalize="words"
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowCliente(false)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Agregar" onPress={handleAddCliente} loading={saving} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showNota} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowNota(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <View style={styles.dragHandle} />
                <Text style={styles.modalTitle}>Nota de carga</Text>
                <TextInput
                  style={styles.textArea}
                  value={notaText}
                  onChangeText={setNotaText}
                  placeholder="Escribí una nota..."
                  placeholderTextColor={colors.textFaint}
                  multiline
                  numberOfLines={4}
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowNota(false)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Guardar" onPress={handleGuardarNota} loading={saving} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showIncidencia} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowIncidencia(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <View style={styles.dragHandle} />
                <Text style={styles.modalTitle}>Nueva incidencia</Text>
                <View style={styles.tipoRow}>
                  {TIPOS_INCIDENCIA.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tipoBtn, incTipo === t && styles.tipoBtnActive]}
                      onPress={() => setIncTipo(t)}
                    >
                      <Text style={[styles.tipoBtnText, incTipo === t && styles.tipoBtnTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Input
                  value={incDesc}
                  onChangeText={setIncDesc}
                  placeholder="Descripción"
                  containerStyle={{ marginTop: spacing.sm }}
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowIncidencia(false)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Registrar" onPress={handleAddIncidencia} loading={saving} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

// ── Componente ClienteSection ────────────────────────────────────────────────

interface ClienteSectionProps {
  cliente: ClienteCarga
  cargaId: string
  onCheckPallet: (palletId: string) => Promise<void>
  onEditPallets: () => void
}

function ClienteSection({ cliente, onCheckPallet, onEditPallets }: ClienteSectionProps) {
  const pallets = cliente.pallets ?? []
  const cargadosCount = pallets.filter(p => p.estado === 'cargado').length
  const enPiso = pallets.filter(p => p.estado !== 'cargado')
  const cargados = pallets.filter(p => p.estado === 'cargado')
  const todosCargados = pallets.length > 0 && cargadosCount === pallets.length

  return (
    <View style={cs.container}>
      {/* Header del cliente */}
      <View style={cs.header}>
        <View style={cs.headerLeft}>
          <Text style={cs.nombre}>{cliente.nombre}</Text>
          {pallets.length > 0 && (
            <Text style={[cs.counter, todosCargados && cs.counterDone]}>
              {cargadosCount}/{pallets.length} pallets
            </Text>
          )}
        </View>
        <TouchableOpacity style={cs.editBtn} onPress={onEditPallets} activeOpacity={0.7}>
          <Text style={cs.editBtnText}>
            {pallets.length === 0 ? '+ Agregar pallets' : 'Editar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pallets */}
      {pallets.length === 0 ? (
        <Text style={cs.sinPallets}>Sin pallets — tocá Agregar pallets para registrar</Text>
      ) : (
        <View style={cs.palletList}>
          {/* EN PISO */}
          {enPiso.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={cs.palletRow}
              onPress={() => onCheckPallet(p.id)}
              activeOpacity={0.7}
            >
              <View style={cs.circle} />
              <View style={cs.palletInfo}>
                <Text style={cs.palletLabel}>P{i + 1}</Text>
                <Text style={cs.palletCajas}>{p.cantidad_cajas} cajas</Text>
              </View>
              <View style={cs.badgePiso}>
                <Text style={cs.badgePisoText}>EN PISO</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* CARGADOS */}
          {cargados.map((p, i) => (
            <View key={p.id} style={[cs.palletRow, cs.palletRowDone]}>
              <View style={[cs.circle, cs.circleDone]}>
                <Text style={cs.tick}>✓</Text>
              </View>
              <View style={cs.palletInfo}>
                <Text style={[cs.palletLabel, cs.palletLabelDone]}>P{enPiso.length + i + 1}</Text>
                <Text style={[cs.palletCajas, cs.palletCajasDone]}>{p.cantidad_cajas} cajas</Text>
              </View>
              <View style={cs.badgeDone}>
                <Text style={cs.badgeDoneText}>CARGADO</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ── MiniStat ─────────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={miniStat.box}>
      <Text style={[miniStat.num, color ? { color } : null]}>{value}</Text>
      <Text style={miniStat.lbl}>{label}</Text>
    </View>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1, gap: 2 },
  nombre: { color: colors.text, fontSize: 15, fontWeight: '700' },
  counter: { color: colors.textFaint, fontSize: 12 },
  counterDone: { color: colors.success },
  editBtn: {
    backgroundColor: colors.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  sinPallets: {
    color: colors.textFaint,
    fontSize: 13,
    padding: spacing.md,
    textAlign: 'center',
  },
  palletList: { paddingVertical: 4 },
  palletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  palletRowDone: {
    backgroundColor: '#052e1620',
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
  tick: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  palletInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  palletLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  palletLabelDone: { color: '#4ade8060' },
  palletCajas: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  palletCajasDone: { color: '#4ade80' },
  badgePiso: {
    backgroundColor: '#0c1f36',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  badgePisoText: { color: '#60a5fa', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  badgeDone: {
    backgroundColor: '#052e16',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#166534',
  },
  badgeDoneText: { color: '#4ade80', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
})

const miniStat = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  num: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  lbl: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  infoCard: { marginBottom: spacing.md },
  chofer: { color: colors.text, fontSize: 22, fontWeight: '800' },
  transporte: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  meta: { color: colors.textFaint, fontSize: 13 },
  tiempos: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  tiempo: { color: colors.success, fontSize: 13 },
  statsStrip: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: { color: colors.textFaint, fontSize: 14, marginBottom: spacing.sm },
  incCard: { marginBottom: 6 },
  incRow: { flexDirection: 'row', justifyContent: 'space-between' },
  incTipo: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  incHora: { color: colors.textFaint, fontSize: 12 },
  incDesc: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  notaText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderHigh,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  textArea: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 15,
    padding: spacing.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipoBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipoBtnText: { color: colors.textMuted, fontSize: 12 },
  tipoBtnTextActive: { color: '#fff', fontWeight: '600' },
})
