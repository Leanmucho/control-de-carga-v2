import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity,
  TouchableWithoutFeedback, Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePallets } from '../../../../src/hooks/usePallets'
import { useNetworkStatus } from '../../../../src/hooks/useNetworkStatus'
import { PalletCard } from '../../../../src/components/PalletCard'
import { Button } from '../../../../src/components/ui/Button'
import { colors, spacing } from '../../../../src/constants/theme'

const CAJAS_RAPIDAS = [25, 30, 40, 50]

export default function PalletsScreen() {
  const { id, clienteId, clienteNombre } = useLocalSearchParams<{
    id: string; clienteId: string; clienteNombre: string
  }>()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const { pallets, loading, check, add, addBulk, edit, remove } = usePallets(clienteId, isOnline)

  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showEdit, setShowEdit] = useState<string | null>(null)
  const [showCalc, setShowCalc] = useState(false)

  const [cajasInput, setCajasInput] = useState('')
  const [bulkCajas, setBulkCajas] = useState('')
  const [bulkCantidad, setBulkCantidad] = useState('')
  const [editCajas, setEditCajas] = useState('')
  const [calcDisplay, setCalcDisplay] = useState('0')
  const [calcPrev, setCalcPrev] = useState('')
  const [calcOp, setCalcOp] = useState<string | null>(null)

  const totalCajas = pallets.reduce((s, p) => s + p.cantidad_cajas, 0)
  const cargados = pallets.filter(p => p.estado === 'cargado').length
  const enPiso = pallets.filter(p => p.estado === 'en_piso').length

  async function handleAdd() {
    const n = parseInt(cajasInput)
    if (!n || n <= 0) { Alert.alert('Error', 'Ingresá una cantidad válida'); return }
    try { await add(n) } catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'Error') }
    setCajasInput('')
    setShowAdd(false)
  }

  async function handleBulk() {
    const c = parseInt(bulkCajas)
    const q = parseInt(bulkCantidad)
    if (!c || !q || c <= 0 || q <= 0) { Alert.alert('Error', 'Ingresá cantidades válidas'); return }
    try { await addBulk(c, q) } catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'Error') }
    setBulkCajas('')
    setBulkCantidad('')
    setShowBulk(false)
  }

  async function handleEdit() {
    if (!showEdit) return
    const n = parseInt(editCajas)
    if (!n || n <= 0) { Alert.alert('Error', 'Ingresá una cantidad válida'); return }
    try { await edit(showEdit, n) } catch {}
    setShowEdit(null)
  }

  async function handleDelete(palletId: string) {
    Alert.alert('Eliminar pallet', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => remove(palletId).catch(() => {}) },
    ])
  }

  // Calculadora
  function calcPress(val: string) {
    if (val === 'C') { setCalcDisplay('0'); setCalcPrev(''); setCalcOp(null); return }
    if (val === '⌫') {
      setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
      return
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      setCalcPrev(calcDisplay)
      setCalcOp(val)
      setCalcDisplay('0')
      return
    }
    if (val === '=') {
      const a = parseFloat(calcPrev)
      const b = parseFloat(calcDisplay)
      let res = 0
      if (calcOp === '+') res = a + b
      if (calcOp === '-') res = a - b
      if (calcOp === '×') res = a * b
      if (calcOp === '÷') res = b !== 0 ? a / b : 0
      setCalcDisplay(String(Number.isInteger(res) ? res : res.toFixed(2)))
      setCalcPrev('')
      setCalcOp(null)
      return
    }
    if (val === '.') {
      if (!calcDisplay.includes('.')) setCalcDisplay(d => d + '.')
      return
    }
    setCalcDisplay(d => d === '0' ? val : d + val)
  }

  const calcBtns = [
    ['C', '⌫', '÷', '×'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '', ''],
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Button label="← Volver" onPress={() => router.back()} variant="ghost" />
        <View style={styles.headerCenter}>
          <Text style={styles.clienteNombre}>{decodeURIComponent(clienteNombre ?? '')}</Text>
          {!isOnline && <Text style={styles.offline}>● Sin conexión</Text>}
        </View>
        <Button label="🧮" onPress={() => setShowCalc(true)} variant="ghost" />
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{pallets.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.success }]}>{cargados}</Text>
          <Text style={styles.statLabel}>Cargados</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.warning }]}>{enPiso}</Text>
          <Text style={styles.statLabel}>En piso</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{totalCajas}</Text>
          <Text style={styles.statLabel}>Cajas</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {pallets.length === 0 && !loading ? (
          <Text style={styles.empty}>Sin pallets. Agregá uno abajo.</Text>
        ) : (
          pallets.map(p => (
            <PalletCard
              key={p.id}
              pallet={p}
              onCheck={() => check(p.id).catch(() => {})}
              onEdit={() => { setShowEdit(p.id); setEditCajas(String(p.cantidad_cajas)) }}
              onDelete={() => handleDelete(p.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Botones agregar */}
      <View style={styles.addBar}>
        <View style={styles.rapidas}>
          {CAJAS_RAPIDAS.map(n => (
            <TouchableOpacity
              key={n}
              style={styles.rapidaBtn}
              onPress={() => add(n).catch(() => {})}
            >
              <Text style={styles.rapidaBtnText}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addBtns}>
          <Button label="+ Pallet" onPress={() => setShowAdd(true)} variant="secondary" style={{ flex: 1 }} />
          <Button label="× Varios" onPress={() => setShowBulk(true)} style={{ flex: 1 }} />
        </View>
      </View>

      {/* Modal: Agregar pallet individual */}
      <Modal visible={showAdd} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowAdd(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Agregar pallet</Text>
                <TextInput
                  style={styles.numInput}
                  value={cajasInput}
                  onChangeText={setCajasInput}
                  placeholder="Cantidad de cajas"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowAdd(false)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Agregar" onPress={handleAdd} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: Agregar múltiples pallets */}
      <Modal visible={showBulk} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowBulk(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Agregar varios pallets</Text>
                <TextInput
                  style={styles.numInput}
                  value={bulkCantidad}
                  onChangeText={setBulkCantidad}
                  placeholder="Cantidad de pallets"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  autoFocus
                />
                <TextInput
                  style={[styles.numInput, { marginTop: spacing.sm }]}
                  value={bulkCajas}
                  onChangeText={setBulkCajas}
                  placeholder="Cajas por pallet"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                />
                {bulkCantidad && bulkCajas ? (
                  <Text style={styles.bulkPreview}>
                    {bulkCantidad} pallets × {bulkCajas} cajas = {parseInt(bulkCantidad || '0') * parseInt(bulkCajas || '0')} cajas
                  </Text>
                ) : null}
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowBulk(false)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Agregar" onPress={handleBulk} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: Editar pallet */}
      <Modal visible={!!showEdit} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowEdit(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Editar pallet</Text>
                <TextInput
                  style={styles.numInput}
                  value={editCajas}
                  onChangeText={setEditCajas}
                  placeholder="Cantidad de cajas"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <Button label="Cancelar" onPress={() => setShowEdit(null)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Guardar" onPress={handleEdit} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Calculadora */}
      <Modal visible={showCalc} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowCalc(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.calcBox}>
                <View style={styles.calcHeader}>
                  <Text style={styles.modalTitle}>Calculadora</Text>
                  <TouchableOpacity onPress={() => setShowCalc(false)}>
                    <Text style={styles.calcClose}>✕</Text>
                  </TouchableOpacity>
                </View>
            <View style={styles.calcDisplay}>
              <Text style={styles.calcOp}>{calcPrev} {calcOp}</Text>
              <Text style={styles.calcNum}>{calcDisplay}</Text>
            </View>
            {calcBtns.map((row, ri) => (
              <View key={ri} style={styles.calcRow}>
                {row.map((btn, bi) =>
                  btn === '' ? (
                    <View key={bi} style={styles.calcBtnEmpty} />
                  ) : (
                    <TouchableOpacity
                      key={bi}
                      style={[
                        styles.calcBtn,
                        btn === '=' ? styles.calcBtnEqual : null,
                        ['+', '-', '×', '÷'].includes(btn) ? styles.calcBtnOp : null,
                      ]}
                      onPress={() => calcPress(btn)}
                    >
                      <Text style={[
                        styles.calcBtnText,
                        btn === '=' ? { color: '#fff' } : null,
                        ['+', '-', '×', '÷'].includes(btn) ? { color: colors.primary } : null,
                      ]}>
                        {btn}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  clienteNombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  offline: { color: colors.warning, fontSize: 11, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  statNum: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  scroll: { padding: spacing.md, paddingBottom: 16 },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: 40, fontSize: 15 },
  addBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  rapidas: { flexDirection: 'row', gap: spacing.sm },
  rapidaBtn: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rapidaBtnText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  addBtns: { flexDirection: 'row', gap: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  numInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 20,
    padding: spacing.sm,
    textAlign: 'center',
  },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  bulkPreview: { color: colors.primary, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  calcBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: 4,
  },
  calcHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  calcClose: { color: colors.textMuted, fontSize: 20, padding: 4 },
  calcDisplay: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'flex-end',
    marginBottom: 8,
    minHeight: 70,
    justifyContent: 'flex-end',
  },
  calcOp: { color: colors.textFaint, fontSize: 14 },
  calcNum: { color: colors.text, fontSize: 36, fontWeight: '300' },
  calcRow: { flexDirection: 'row', gap: 4 },
  calcBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  calcBtnEmpty: { flex: 1 },
  calcBtnEqual: { backgroundColor: colors.primary },
  calcBtnOp: { backgroundColor: '#1e3a5f' },
  calcBtnText: { color: colors.text, fontSize: 20, fontWeight: '500' },
})
