import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal,
  TouchableOpacity, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCarga } from '../../../src/hooks/useCarga'
import { addCliente } from '../../../src/lib/queries/clientes'
import { addIncidencia } from '../../../src/lib/queries/incidencias'
import { Button } from '../../../src/components/ui/Button'
import { Card } from '../../../src/components/ui/Card'
import { EstadoBadge } from '../../../src/components/EstadoBadge'
import { Input } from '../../../src/components/ui/Input'
import { colors, spacing } from '../../../src/constants/theme'
import { TRANSICIONES, TRANSICION_LABELS, TIPOS_INCIDENCIA } from '../../../src/constants/estados'
import type { EstadoCarga } from '../../../src/constants/estados'

export default function CargaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { carga, loading, avanzar, registrarLlegada, guardarNotaCarga, refresh } = useCarga(id)

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

  async function handleAddCliente() {
    if (!nuevoCliente.trim()) return
    setSaving(true)
    try {
      await addCliente({
        carga_id: id,
        nombre: nuevoCliente.trim(),
        orden: (carga.clientes_carga?.length ?? 0) + 1,
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
        {(() => {
          const total = carga.clientes_carga?.reduce((s, c) => s + (c.pallets?.length ?? 0), 0) ?? 0
          const cargados = carga.clientes_carga?.reduce((s, c) => s + (c.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0) ?? 0
          const pendientes = total - cargados
          const cajas = carga.clientes_carga?.reduce((s, c) => s + (c.pallets?.reduce((s2, p) => s2 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0) ?? 0
          if (total === 0) return null
          return (
            <View style={styles.statsStrip}>
              <MiniStat label="Total" value={total} />
              <MiniStat label="Cargados" value={cargados} color={colors.success} />
              <MiniStat label="Pendientes" value={pendientes} color={pendientes > 0 ? colors.warning : colors.textFaint} />
              <MiniStat label="Cajas" value={cajas} />
            </View>
          )
        })()}

        {siguienteEstado && (
          <Button
            label={btnLabel}
            onPress={handleAvanzar}
            variant={siguienteEstado === 'finalizado' ? 'success' : 'primary'}
            fullWidth
            style={{ marginBottom: spacing.md }}
          />
        )}

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
          carga.clientes_carga!.map(c => {
            const cargados = c.pallets?.filter(p => p.estado === 'cargado').length ?? 0
            const total = c.pallets?.length ?? 0
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.75}
                onPress={() => router.push({
                  pathname: '/(main)/carga/[id]/pallets',
                  params: { id, clienteId: c.id, clienteNombre: c.nombre },
                })}
              >
                <Card style={styles.clienteCard}>
                  <View style={styles.clienteRow}>
                    <Text style={styles.clienteNombre}>{c.nombre}</Text>
                    <Text style={[styles.clientePallets, cargados === total && total > 0 ? styles.completo : null]}>
                      {cargados}/{total} pallets
                    </Text>
                  </View>
                  <Text style={styles.clienteHint}>Tocá para ver pallets →</Text>
                </Card>
              </TouchableOpacity>
            )
          })
        )}

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

      <Modal visible={showCliente} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowCliente(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
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

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={miniStat.box}>
      <Text style={[miniStat.num, color ? { color } : null]}>{value}</Text>
      <Text style={miniStat.lbl}>{label}</Text>
    </View>
  )
}
const miniStat = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: colors.textFaint, fontSize: 14, marginBottom: spacing.sm },
  clienteCard: { marginBottom: 6 },
  clienteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clienteNombre: { color: colors.text, fontSize: 15, fontWeight: '600' },
  clientePallets: { color: colors.textMuted, fontSize: 13 },
  completo: { color: colors.success },
  clienteHint: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  incCard: { marginBottom: 6 },
  incRow: { flexDirection: 'row', justifyContent: 'space-between' },
  incTipo: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  incHora: { color: colors.textFaint, fontSize: 12 },
  incDesc: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  notaText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, gap: spacing.md },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
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
  tipoBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  tipoBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipoBtnText: { color: colors.textMuted, fontSize: 12 },
  tipoBtnTextActive: { color: '#fff', fontWeight: '600' },
  statsStrip: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
})
