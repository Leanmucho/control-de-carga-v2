import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator,
  Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { useAuth } from '../../../src/hooks/useAuth'
import { getCargas } from '../../../src/lib/queries/cargas'
import { syncOfflineQueue } from '../../../src/lib/offline/sync'
import { getQueue } from '../../../src/lib/offline/queue'
import { cacheCargas, getCachedCargas } from '../../../src/lib/offline/db'
import { Button } from '../../../src/components/ui/Button'
import { CargaCard } from '../../../src/components/CargaCard'
import { colors, spacing, radius } from '../../../src/constants/theme'
import {
  construirResumen, guardarResumenLocal,
  compartirComoExcel, enviarResumenConAdjunto,
} from '../../../src/lib/turnoResumen'
import { getCargaWarnings } from '../../../src/lib/cargaMetrics'
import type { Carga } from '../../../src/types/database'
import type { ResumenTurno } from '../../../src/lib/turnoResumen'

export default function TurnoScreen() {
  const { turno, loading, iniciar, finalizar } = useTurnoActivo()
  const { isOnline } = useNetworkStatus()
  const { perfil, signOut, userId } = useAuth()
  const router = useRouter()

  const [cargas, setCargas] = useState<Carga[]>([])
  const [cargasLoading, setCargasLoading] = useState(false)
  const [construyendo, setConstruyendo] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [pendientes, setPendientes] = useState(0)

  // Modal de cierre
  const [showModal, setShowModal] = useState(false)
  const [resumen, setResumen] = useState<ResumenTurno | null>(null)
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  function handleVolverDesdeCierre() {
    if (enviando || cerrando || sincronizando) return
    setShowModal(false)
  }

  function confirmarConAvisos(titulo: string, avisos: string[]): Promise<boolean> {
    if (avisos.length === 0) return Promise.resolve(true)
    const msg = avisos.slice(0, 8).join('\n')
    if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${msg}`))
    return new Promise(resolve => {
      Alert.alert(titulo, msg, [
        { text: 'Revisar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', style: 'destructive', onPress: () => resolve(true) },
      ])
    })
  }

  useFocusEffect(
    useCallback(() => {
      if (turno?.id) {
        const cached = getCachedCargas(turno.id)
        if (cached.length > 0) setCargas(cached)
        setPendientes(getQueue().length)
        if (!isOnline) {
          setCargasLoading(false)
          return
        }
        setCargasLoading(cached.length === 0)
        getCargas(turno.id)
          .then(data => {
            setCargas(data)
            cacheCargas(data)
          })
          .catch(() => {
            if (cached.length > 0) setCargas(cached)
          })
          .finally(() => setCargasLoading(false))
      } else {
        setCargas([])
        setPendientes(getQueue().length)
      }
    }, [turno?.id, isOnline])
  )

  const totalPallets = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce((s2, cl) => s2 + (cl.pallets?.length ?? 0), 0) ?? 0), 0
  )
  const totalCajas = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce(
      (s2, cl) => s2 + (cl.pallets?.reduce((s3, p) => s3 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
    ) ?? 0), 0
  )
  const totalInc = cargas.reduce((s, c) => s + (c.incidencias?.length ?? 0), 0)

  async function handleIniciarTurno() {
    const id = perfil?.id ?? userId
    if (!id) { Alert.alert('Error', 'No hay sesión activa'); return }
    try { await iniciar(id) }
    catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo iniciar el turno') }
  }

  // Paso 1: abrir modal con resumen precalculado
  // Sincronizamos la cola offline ANTES de construir el resumen para que
  // refleje todo lo cargado durante el turno. Si no hay red, avisamos.
  async function handleFinalizarTurno() {
    if (!turno) return
    const pendientes = getQueue().length
    if (pendientes > 0 && !isOnline) {
      const msg = `Hay ${pendientes} cambios sin sincronizar y no hay conexión. Conectate a internet para cerrar el turno y enviar el resumen.`
      if (Platform.OS === 'web') window.alert(msg)
      else Alert.alert('Sin conexión', msg)
      return
    }
    setConstruyendo(true)
    try {
      if (pendientes > 0) {
        setSincronizando(true)
        try {
          const result = await syncOfflineQueue()
          setPendientes(getQueue().length)
          if (result.skipped) {
            const msg = 'No hay conexión. Los cambios siguen guardados en este dispositivo.'
            if (Platform.OS === 'web') window.alert(msg)
            else Alert.alert('Sin conexión', msg)
            return
          }
          if (result.failed > 0) {
            const msg = `No se pudieron sincronizar ${result.failed} cambios. Reintentá con buena conexión.`
            if (Platform.OS === 'web') window.alert(msg)
            else Alert.alert('Sincronización incompleta', msg)
            return
          }
        } finally {
          setSincronizando(false)
        }
      }
      const avisosTurno = cargas.flatMap(c => {
        const avisos = getCargaWarnings(c).map(w => `${c.chofer}: ${w}`)
        if (c.estado !== 'finalizado') avisos.unshift(`${c.chofer}: carga no finalizada.`)
        return avisos
      })
      if (!(await confirmarConAvisos('Cerrar turno con avisos', avisosTurno))) return
      const controlador = perfil?.nombre ?? 'Controlador'
      const r = await construirResumen(turno.id, controlador)
      await guardarResumenLocal(r)
      setResumen(r)
      setShowModal(true)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo preparar el resumen')
    } finally {
      setConstruyendo(false)
    }
  }

  async function handleSincronizarPendientes() {
    if (pendientes === 0 || sincronizando) return
    if (!isOnline) {
      const msg = 'No hay conexión. Podés seguir trabajando; sincronizá cuando vuelva internet.'
      if (Platform.OS === 'web') window.alert(msg)
      else Alert.alert('Sin conexión', msg)
      return
    }

    setSincronizando(true)
    try {
      const result = await syncOfflineQueue()
      setPendientes(getQueue().length)
      if (result.skipped) {
        const msg = 'No hay conexión. Los cambios siguen guardados en este dispositivo.'
        if (Platform.OS === 'web') window.alert(msg)
        else Alert.alert('Sin conexión', msg)
        return
      }
      if (result.failed > 0) {
        const msg = `Se sincronizaron ${result.synced}, pero quedaron ${result.failed} cambio(s) pendiente(s). Reintentá con buena conexión.`
        if (Platform.OS === 'web') window.alert(msg)
        else Alert.alert('Sincronización incompleta', msg)
        return
      }
      if (turno?.id) {
        const data = await getCargas(turno.id)
        setCargas(data)
        cacheCargas(data)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo sincronizar'
      if (Platform.OS === 'web') window.alert(msg)
      else Alert.alert('Error', msg)
    } finally {
      setPendientes(getQueue().length)
      setSincronizando(false)
    }
  }

  // Paso 2a: enviar mail + cerrar turno + sign out
  async function handleEnviarYCerrar() {
    if (!turno || !resumen) return
    if (!email.trim() || !email.includes('@')) {
      if (Platform.OS === 'web') {
        window.alert('Ingresá un email válido para enviar el resumen.')
      } else {
        Alert.alert('Email inválido', 'Ingresá un email válido para enviar el resumen.')
      }
      return
    }
    setEnviando(true)
    try {
      await enviarResumenConAdjunto(resumen, email.trim())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Revisá tu conexión. El turno se cerrará igual.'
      if (Platform.OS === 'web') {
        window.alert(`No se pudo enviar el email: ${msg}`)
      } else {
        Alert.alert('No se pudo enviar el email', msg)
      }
    } finally {
      setEnviando(false)
    }
    await cerrarTurnoYSalir()
  }

  // Paso 2b: solo cerrar sin enviar
  function handleSoloCerrar() {
    if (!turno) return
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrás el turno sin enviar el resumen por email?')) {
        cerrarTurnoYSalir()
      }
      return
    }
    Alert.alert(
      'Cerrar sin enviar',
      '¿Cerrás el turno sin enviar el resumen por email?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar igual', style: 'destructive', onPress: cerrarTurnoYSalir },
      ]
    )
  }

  async function cerrarTurnoYSalir() {
    if (!turno) return
    setCerrando(true)
    try {
      // Drenar cualquier op pendiente que haya quedado (ej. ediciones
      // hechas mientras el modal de resumen estaba abierto).
      if (getQueue().length > 0) {
        setSincronizando(true)
        try {
          const result = await syncOfflineQueue()
          setPendientes(getQueue().length)
          if (result.skipped || result.failed > 0) {
            throw new Error('Quedan cambios pendientes. Sincronizá con internet antes de cerrar el turno.')
          }
        } finally {
          setSincronizando(false)
        }
      }
      await finalizar(turno.id)
      setShowModal(false)
      await signOut()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo cerrar el turno'
      if (Platform.OS === 'web') {
        window.alert(`Error: ${msg}`)
      } else {
        Alert.alert('Error', msg)
      }
    } finally {
      setCerrando(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appTitle}>Control de Carga</Text>
          {turno && (
            <Text style={styles.topSub}>
              {new Date(turno.fecha_inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
          )}
        </View>
        <Button
          label={perfil?.nombre ?? 'Salir'}
          onPress={() => Alert.alert('Cerrar sesión', '¿Salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', onPress: signOut, style: 'destructive' },
          ])}
          variant="ghost"
          style={{ paddingHorizontal: 8 }}
        />
      </View>

      {!turno ? (
        <View style={styles.noTurnoWrap}>
          <View style={styles.noTurnoCard}>
            <Text style={styles.noTurnoEmoji}>📦</Text>
            <Text style={styles.noTurnoTitle}>Iniciar nuevo turno</Text>
            <Text style={styles.noTurnoSub}>Registra las cargas del turno de trabajo.</Text>
            <Button
              label="Iniciar Turno"
              onPress={handleIniciarTurno}
              fullWidth
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {cargas.length > 0 && (
            <View style={styles.statsRow}>
              <StatBox value={cargas.length} label="Cargas" />
              <StatBox value={totalPallets} label="Pallets" />
              <StatBox value={totalCajas} label="Cajas" />
              <StatBox value={totalInc} label="Incid." color={totalInc > 0 ? colors.danger : undefined} />
            </View>
          )}

          <View style={styles.actionsCard}>
            {pendientes > 0 && (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingText}>
                  {pendientes} cambio{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''}
                </Text>
                <Button
                  label={sincronizando ? 'Sincronizando...' : 'Sincronizar'}
                  onPress={handleSincronizarPendientes}
                  variant="secondary"
                  disabled={sincronizando || construyendo}
                  style={styles.pendingButton}
                />
              </View>
            )}
            <View style={styles.actionsRow}>
              <Button
                label="+ Nueva Carga"
                onPress={() => router.push('/(main)/carga/nueva')}
                style={{ flex: 1 }}
              />
              <Button
                label={sincronizando ? 'Sincronizando…' : construyendo ? 'Preparando…' : 'Finalizar'}
                onPress={handleFinalizarTurno}
                variant="danger"
                style={{ flex: 1 }}
                disabled={construyendo || sincronizando}
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cargas del turno</Text>
            {cargas.length > 0 && <Text style={styles.sectionCount}>{cargas.length}</Text>}
          </View>

          {cargasLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : cargas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🚛</Text>
              <Text style={styles.emptyText}>Sin cargas registradas aún</Text>
              <Text style={styles.emptySub}>Usá el botón de arriba para empezar</Text>
            </View>
          ) : (
            cargas.map(c => (
              <CargaCard
                key={c.id}
                carga={c}
                onPress={() => router.push({ pathname: '/(main)/carga/[id]', params: { id: c.id } })}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Modal de cierre de turno ── */}
      <Modal visible={showModal} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={modal.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={modal.scroll} keyboardShouldPersistTaps="handled">

              {/* Header */}
              <View style={modal.header}>
                <TouchableOpacity
                  style={[modal.backBtn, (enviando || cerrando || sincronizando) && modal.backBtnDisabled]}
                  onPress={handleVolverDesdeCierre}
                  activeOpacity={0.75}
                  disabled={enviando || cerrando || sincronizando}
                >
                  <Text style={modal.backIcon}>←</Text>
                  <Text style={modal.backText}>Volver</Text>
                </TouchableOpacity>
                <Text style={modal.titulo}>Resumen del Turno</Text>
                <Text style={modal.subtitulo}>
                  {resumen && new Date(resumen.fecha_inicio).toLocaleString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </Text>
              </View>

              {/* Stats */}
              {resumen && (
                <View style={modal.statsGrid}>
                  <ResumenStat label="Cargas" value={resumen.totales.cargas} />
                  <ResumenStat label="Pallets" value={`${resumen.totales.pallets_cargados}/${resumen.totales.pallets}`} />
                  <ResumenStat label="Cajas" value={resumen.totales.cajas} />
                  <ResumenStat
                    label="Incidencias"
                    value={resumen.totales.incidencias}
                    color={resumen.totales.incidencias > 0 ? colors.warning : colors.success}
                  />
                </View>
              )}

              {/* Detalle por carga */}
              {resumen && resumen.cargas.length > 0 && (
                <View style={modal.section}>
                  <Text style={modal.sectionTitle}>Detalle por carga</Text>
                  {resumen.cargas.map((c) => (
                    <View key={c.numero} style={modal.cargaRow}>
                      <View style={modal.cargaLeft}>
                        <Text style={modal.cargaNum}>#{c.numero}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={modal.cargaChofer}>{c.chofer}</Text>
                          <Text style={modal.cargaMeta}>{c.transporte}{c.numero_remito ? ` · Rem. ${c.numero_remito}` : ''}</Text>
                          {c.clientes.length > 0 && (
                            <Text style={modal.cargaClientes}>
                              {c.clientes.map(cl => cl.nombre).join(', ')}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={modal.cargaRight}>
                        <Text style={modal.cargaPallets}>{c.pallets_cargados}/{c.total_pallets}</Text>
                        <Text style={modal.cargaPalletsLabel}>pallets</Text>
                        <Text style={modal.cargaCajas}>{c.total_cajas} caj.</Text>
                        {c.incidencias.length > 0 && (
                          <Text style={modal.cargaInc}>⚠ {c.incidencias.length}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Email */}
              <View style={modal.section}>
                <Text style={modal.sectionTitle}>Enviar resumen por email</Text>
                <Text style={modal.emailHint}>
                  Se enviará el resumen completo con el archivo Excel adjunto.
                </Text>
                <TextInput
                  style={modal.emailInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nombre@empresa.com"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Botón descargar Excel */}
              {resumen && (
                <TouchableOpacity
                  style={modal.excelBtn}
                  onPress={() => compartirComoExcel(resumen).catch(() => {})}
                  activeOpacity={0.75}
                >
                  <Text style={modal.excelBtnText}>📊 Descargar Excel / CSV</Text>
                </TouchableOpacity>
              )}

              {/* Acciones principales */}
              <View style={modal.actions}>
                <Button
                  label={sincronizando ? 'Sincronizando…' : enviando ? 'Enviando…' : '📧 Enviar y Cerrar Turno'}
                  onPress={handleEnviarYCerrar}
                  fullWidth
                  disabled={enviando || cerrando || sincronizando}
                  loading={enviando || sincronizando}
                  style={{ marginBottom: spacing.sm }}
                />
                <Button
                  label={sincronizando ? 'Sincronizando…' : cerrando ? 'Cerrando…' : 'Cerrar sin enviar'}
                  onPress={handleSoloCerrar}
                  variant="secondary"
                  fullWidth
                  disabled={enviando || cerrando || sincronizando}
                />
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={statBox.box}>
      <Text style={[statBox.num, color ? { color } : null]}>{value}</Text>
      <Text style={statBox.lbl}>{label}</Text>
    </View>
  )
}

function ResumenStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={modal.statBox}>
      <Text style={[modal.statNum, color ? { color } : null]}>{value}</Text>
      <Text style={modal.statLbl}>{label}</Text>
    </View>
  )
}

// ── Estilos pantalla principal ────────────────────────────────────────────────

const statBox = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
  },
  num: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, lineHeight: 32 },
  lbl: { color: colors.textFaint, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  appTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  topSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  noTurnoWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  noTurnoCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg + 8, alignItems: 'center',
  },
  noTurnoEmoji: { fontSize: 52, marginBottom: spacing.md },
  noTurnoTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  noTurnoSub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  actionsCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.md,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '55',
  },
  pendingText: { color: colors.warning, fontSize: 12, fontWeight: '700', flex: 1 },
  pendingButton: { paddingHorizontal: 10, paddingVertical: 5 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: {
    color: colors.textFaint, fontSize: 12, backgroundColor: colors.surface,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, marginTop: 4 },
})

// ── Estilos del modal de cierre ───────────────────────────────────────────────

const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 48 },

  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: 72,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    top: spacing.lg,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  backBtnDisabled: { opacity: 0.4 },
  backIcon: { color: colors.primary, fontSize: 18, fontWeight: '800', lineHeight: 20 },
  backText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitulo: { color: colors.textMuted, fontSize: 14, marginTop: 4, textTransform: 'capitalize' },

  statsGrid: {
    flexDirection: 'row', gap: 6, marginBottom: spacing.md,
  },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  statNum: { color: colors.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLbl: { color: colors.textFaint, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },

  section: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },

  cargaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cargaLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  cargaNum: {
    color: colors.textFaint, fontSize: 12, fontWeight: '700',
    width: 26, marginTop: 1,
  },
  cargaChofer: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cargaMeta: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  cargaClientes: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  cargaRight: { alignItems: 'flex-end', gap: 2 },
  cargaPallets: { color: colors.success, fontSize: 16, fontWeight: '800' },
  cargaPalletsLabel: { color: colors.textFaint, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 },
  cargaCajas: { color: colors.textMuted, fontSize: 11 },
  cargaInc: { color: colors.warning, fontSize: 11, fontWeight: '700' },

  emailHint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.sm },
  emailInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, color: colors.text, fontSize: 15,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },

  excelBtn: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, alignItems: 'center', marginBottom: spacing.md,
  },
  excelBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  actions: { gap: spacing.sm },
})
