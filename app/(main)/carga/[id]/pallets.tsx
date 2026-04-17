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
import { colors, spacing, radius } from '../../../../src/constants/theme'

const CAJAS_RAPIDAS = [20, 25, 30, 40, 50, 60]

export default function PalletsScreen() {
  const { id, clienteId, clienteNombre } = useLocalSearchParams<{
    id: string; clienteId: string; clienteNombre: string
  }>()
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const { pallets, loading, check, add, addBulk, edit, remove } = usePallets(clienteId, isOnline)

  // Modal: agregar en piso (individual o bulk)
  const [showAdd, setShowAdd] = useState(false)
  const [cajasInput, setCajasInput] = useState('')
  const [bulkCantidad, setBulkCantidad] = useState('')

  // Modal: editar
  const [editId, setEditId] = useState<string | null>(null)
  const [editCajas, setEditCajas] = useState('')

  // Modal: calculadora
  const [showCalc, setShowCalc] = useState(false)
  const [calcDisplay, setCalcDisplay] = useState('0')
  const [calcPrev, setCalcPrev] = useState('')
  const [calcOp, setCalcOp] = useState<string | null>(null)

  const totalCajas = pallets.reduce((s, p) => s + p.cantidad_cajas, 0)
  const cargados = pallets.filter(p => p.estado === 'cargado').length
  const enPiso = pallets.filter(p => p.estado !== 'cargado').length

  // ── Acciones ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const n = parseInt(cajasInput)
    if (!n || n <= 0) { Alert.alert('Error', 'Ingresá una cantidad válida'); return }

    const cant = parseInt(bulkCantidad) || 1
    try {
      if (cant > 1) {
        await addBulk(n, cant)
      } else {
        await add(n)
      }
      setCajasInput('')
      setBulkCantidad('')
      setShowAdd(false)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo agregar')
    }
  }

  async function handleCheck(palletId: string) {
    try {
      await check(palletId)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo marcar')
    }
  }

  async function handleEdit() {
    if (!editId) return
    const n = parseInt(editCajas)
    if (!n || n <= 0) { Alert.alert('Error', 'Ingresá una cantidad válida'); return }
    try {
      await edit(editId, n)
      setEditId(null)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo editar')
    }
  }

  async function handleDelete(palletId: string) {
    Alert.alert('Eliminar pallet', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await remove(palletId)
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
          }
        },
      },
    ])
  }

  function handleLongPress(p: { id: string; cantidad_cajas: number }) {
    Alert.alert(
      `Pallet · ${p.cantidad_cajas} cajas`,
      'Qué querés hacer?',
      [
        {
          text: 'Editar cajas',
          onPress: () => { setEditId(p.id); setEditCajas(String(p.cantidad_cajas)) },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => handleDelete(p.id),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    )
  }

  // ── Calculadora ─────────────────────────────────────────────────────────────

  function calcPress(val: string) {
    if (val === 'C') { setCalcDisplay('0'); setCalcPrev(''); setCalcOp(null); return }
    if (val === '⌫') { setCalcDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'); return }
    if (['+', '-', '×', '÷'].includes(val)) {
      setCalcPrev(calcDisplay); setCalcOp(val); setCalcDisplay('0'); return
    }
    if (val === '=') {
      const a = parseFloat(calcPrev), b = parseFloat(calcDisplay)
      let res = 0
      if (calcOp === '+') res = a + b
      if (calcOp === '-') res = a - b
      if (calcOp === '×') res = a * b
      if (calcOp === '÷') res = b !== 0 ? a / b : 0
      setCalcDisplay(String(Number.isInteger(res) ? res : res.toFixed(2)))
      setCalcPrev(''); setCalcOp(null); return
    }
    if (val === '.') { if (!calcDisplay.includes('.')) setCalcDisplay(d => d + '.'); return }
    setCalcDisplay(d => d === '0' ? val : d + val)
  }

  const calcBtns = [
    ['C', '⌫', '÷', '×'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '', ''],
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.clienteNombre} numberOfLines={1}>
            {decodeURIComponent(clienteNombre ?? '')}
          </Text>
          {!isOnline && <Text style={styles.offlineBadge}>● Sin conexión</Text>}
        </View>
        <TouchableOpacity onPress={() => setShowCalc(true)} style={styles.calcBtn}>
          <Text style={styles.calcBtnText}>🧮</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <StatBox value={pallets.length} label="Total" />
        <StatBox value={enPiso} label="En piso" color={enPiso > 0 ? colors.primary : colors.textFaint} />
        <StatBox value={cargados} label="Cargados" color={cargados > 0 ? colors.success : colors.textFaint} />
        <StatBox value={totalCajas} label="Cajas" />
      </View>

      {/* Lista de pallets */}
      <ScrollView contentContainerStyle={styles.list}>
        {pallets.length === 0 && !loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Sin pallets registrados</Text>
            <Text style={styles.emptySub}>Usá el botón de abajo para agregar pallets en piso</Text>
          </View>
        ) : (
          <>
            {enPiso > 0 && (
              <Text style={styles.sectionLabel}>EN PISO — {enPiso} pallet{enPiso !== 1 ? 's' : ''}</Text>
            )}
            {pallets
              .filter(p => p.estado !== 'cargado')
              .map((p, i) => (
                <PalletCard
                  key={p.id}
                  pallet={p}
                  index={i}
                  onCheck={() => handleCheck(p.id)}
                  onLongPress={() => handleLongPress(p)}
                />
              ))}

            {cargados > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: spacing.md, color: colors.successDim }]}>
                CARGADOS — {cargados} pallet{cargados !== 1 ? 's' : ''}
              </Text>
            )}
            {pallets
              .filter(p => p.estado === 'cargado')
              .map((p, i) => (
                <PalletCard
                  key={p.id}
                  pallet={p}
                  index={enPiso + i}
                  onCheck={() => {}}
                  onLongPress={() => handleLongPress(p)}
                />
              ))}
          </>
        )}
      </ScrollView>

      {/* Barra inferior */}
      <View style={styles.addBar}>
        <Text style={styles.addBarLabel}>CAJAS RÁPIDAS</Text>
        <View style={styles.rapidas}>
          {CAJAS_RAPIDAS.map(n => (
            <TouchableOpacity
              key={n}
              style={styles.rapidaBtn}
              onPress={() => add(n).catch(() => Alert.alert('Error', 'No se pudo agregar'))}
            >
              <Text style={styles.rapidaNum}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button
          label="+ Agregar pallets en piso"
          onPress={() => setShowAdd(true)}
          fullWidth
        />
      </View>

      {/* ── Modal: Agregar en piso ── */}
      <Modal visible={showAdd} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowAdd(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.sheet}>
                <View style={styles.dragHandle} />
                <Text style={styles.sheetTitle}>Agregar pallets en piso</Text>

                <View style={styles.row}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CAJAS POR PALLET</Text>
                    <TextInput
                      style={styles.numInput}
                      value={cajasInput}
                      onChangeText={setCajasInput}
                      placeholder="ej: 30"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CANTIDAD DE PALLETS</Text>
                    <TextInput
                      style={styles.numInput}
                      value={bulkCantidad}
                      onChangeText={setBulkCantidad}
                      placeholder="ej: 5"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {cajasInput && bulkCantidad && parseInt(bulkCantidad) > 1 ? (
                  <View style={styles.preview}>
                    <Text style={styles.previewText}>
                      {bulkCantidad} pallets × {cajasInput} cajas ={' '}
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {parseInt(bulkCantidad) * parseInt(cajasInput)} cajas totales
                      </Text>
                    </Text>
                  </View>
                ) : cajasInput ? (
                  <View style={styles.preview}>
                    <Text style={styles.previewText}>
                      1 pallet · <Text style={{ color: colors.primary, fontWeight: '700' }}>{cajasInput} cajas</Text>
                    </Text>
                  </View>
                ) : null}

                <View style={styles.sheetBtns}>
                  <Button
                    label="Cancelar"
                    onPress={() => { setShowAdd(false); setCajasInput(''); setBulkCantidad('') }}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Registrar en piso"
                    onPress={handleAdd}
                    style={{ flex: 2 }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal: Editar ── */}
      <Modal visible={!!editId} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setEditId(null)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.sheet}>
                <View style={styles.dragHandle} />
                <Text style={styles.sheetTitle}>Editar cantidad de cajas</Text>
                <TextInput
                  style={styles.numInputLarge}
                  value={editCajas}
                  onChangeText={setEditCajas}
                  placeholder="Cantidad de cajas"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.sheetBtns}>
                  <Button label="Cancelar" onPress={() => setEditId(null)} variant="secondary" style={{ flex: 1 }} />
                  <Button label="Guardar" onPress={handleEdit} style={{ flex: 1 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal: Calculadora ── */}
      <Modal visible={showCalc} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowCalc(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.sheet}>
                <View style={styles.dragHandle} />
                <View style={styles.calcHeader}>
                  <Text style={styles.sheetTitle}>Calculadora</Text>
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
                            styles.calcBtnItem,
                            btn === '=' && styles.calcBtnEqual,
                            ['+', '-', '×', '÷'].includes(btn) && styles.calcBtnOp,
                          ]}
                          onPress={() => calcPress(btn)}
                        >
                          <Text style={[
                            styles.calcBtnText,
                            btn === '=' && { color: '#fff' },
                            ['+', '-', '×', '÷'].includes(btn) && { color: colors.primary },
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

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={stat.box}>
      <Text style={[stat.num, color ? { color } : null]}>{value}</Text>
      <Text style={stat.lbl}>{label}</Text>
    </View>
  )
}

const stat = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.surfaceHigh },
  num: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  lbl: { color: colors.textFaint, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: spacing.sm },
  backText: { color: colors.primary, fontSize: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  clienteNombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  offlineBadge: { color: colors.warning, fontSize: 11, marginTop: 2 },
  calcBtn: { padding: spacing.sm },

  stats: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 1,
    backgroundColor: colors.border,
  },

  list: { padding: spacing.md, paddingBottom: 16 },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 2,
  },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },

  addBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  addBarLabel: {
    color: colors.textFaint,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rapidas: { flexDirection: 'row', gap: 5 },
  rapidaBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderHigh,
  },
  rapidaNum: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
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
    width: 40, height: 4,
    backgroundColor: colors.borderHigh,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sheetBtns: { flexDirection: 'row', gap: spacing.sm },

  row: { flexDirection: 'row', gap: spacing.md },
  inputGroup: { flex: 1, gap: 6 },
  inputLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  numInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 20,
    padding: spacing.sm,
    textAlign: 'center',
    minHeight: 52,
  },
  numInputLarge: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 24,
    padding: spacing.md,
    textAlign: 'center',
    minHeight: 60,
  },
  preview: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  calcHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calcClose: { color: colors.textMuted, fontSize: 20, padding: 4 },
  calcDisplay: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-end',
    minHeight: 70,
    justifyContent: 'flex-end',
  },
  calcOp: { color: colors.textFaint, fontSize: 14 },
  calcNum: { color: colors.text, fontSize: 36, fontWeight: '300' },
  calcRow: { flexDirection: 'row', gap: 4 },
  calcBtnItem: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcBtnEmpty: { flex: 1 },
  calcBtnEqual: { backgroundColor: colors.primary, borderColor: colors.primary },
  calcBtnOp: { backgroundColor: '#0c1f36', borderColor: '#1e3a5f' },
  calcBtnText: { color: colors.text, fontSize: 20, fontWeight: '500' },
})
