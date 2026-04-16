import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SectionList, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuth } from '../../../src/hooks/useAuth'
import { useNetworkStatus } from '../../../src/hooks/useNetworkStatus'
import { getHistorialCompleto } from '../../../src/lib/queries/cargas'
import {
  saveHistorialCache, loadHistorialCache, getLastSync,
  filtrarCargas, agruparPorDia,
} from '../../../src/lib/historialCache'
import { CargaCard } from '../../../src/components/CargaCard'
import { colors, spacing, radius } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'
import type { DiaCargas } from '../../../src/lib/historialCache'

export default function HistorialScreen() {
  const router = useRouter()
  const { userId } = useAuth()
  const { isOnline } = useNetworkStatus()

  // Datos
  const [todasCargas, setTodasCargas] = useState<Carga[]>([])
  const [secciones, setSecciones] = useState<DiaCargas[]>([])
  const [loadingCache, setLoadingCache] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [errorRed, setErrorRed] = useState(false)

  // Filtros
  const [chofer, setChofer] = useState('')
  const [transporte, setTransporte] = useState('')
  const [fecha, setFecha] = useState('')
  const [cliente, setCliente] = useState('')
  const hayFiltros = !!(chofer || transporte || fecha || cliente)

  // Para no re-filtrar innecesariamente
  const filtrosRef = useRef({ chofer, transporte, fecha, cliente })
  filtrosRef.current = { chofer, transporte, fecha, cliente }

  // ── Aplicar filtros localmente cada vez que cambia algo ───────────────────
  const aplicarFiltros = useCallback((base: Carga[]) => {
    const f = filtrosRef.current
    const filtradas = filtrarCargas(base, f)
    setSecciones(agruparPorDia(filtradas))
  }, [])

  // Re-filtrar cuando cambian los filtros
  React.useEffect(() => {
    aplicarFiltros(todasCargas)
  }, [chofer, transporte, fecha, cliente, todasCargas, aplicarFiltros])

  // ── Carga lazy solo al entrar a la pantalla ───────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return

      let active = true

      async function cargar() {
        // 1. Mostrar cache inmediatamente (sin esperar red)
        setLoadingCache(true)
        const cached = await loadHistorialCache(userId!)
        const sync = await getLastSync(userId!)
        if (active) {
          setLastSync(sync)
          if (cached) {
            setTodasCargas(cached)
            aplicarFiltros(cached)
          }
          setLoadingCache(false)
        }

        // 2. Actualizar desde red en segundo plano si hay conexión
        if (isOnline) {
          setSincronizando(true)
          setErrorRed(false)
          try {
            const frescas = await getHistorialCompleto()
            if (active) {
              await saveHistorialCache(userId!, frescas)
              setTodasCargas(frescas)
              aplicarFiltros(frescas)
              setLastSync(new Date())
            }
          } catch {
            if (active) setErrorRed(true)
          } finally {
            if (active) setSincronizando(false)
          }
        } else {
          setLoadingCache(false)
        }
      }

      cargar()
      return () => { active = false }
    }, [userId, isOnline])  // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Formatear fecha con auto-slash DD/MM/YYYY ─────────────────────────────
  function onChangeFecha(raw: string) {
    // Eliminar caracteres que no sean dígitos o /
    let val = raw.replace(/[^\d/]/g, '')

    // Auto-insertar / después del día y mes
    if (val.length === 2 && fecha.length === 1) val = val + '/'
    if (val.length === 5 && fecha.length === 4) val = val + '/'
    if (val.length > 10) val = val.substring(0, 10)
    setFecha(val)
  }

  function limpiar() {
    setChofer('')
    setTransporte('')
    setFecha('')
    setCliente('')
  }

  // ── Formato del último sync ───────────────────────────────────────────────
  function syncLabel(): string {
    if (!lastSync) return ''
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 60000)
    if (diff < 1) return 'actualizado ahora'
    if (diff < 60) return `hace ${diff} min`
    return lastSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const totalMostradas = secciones.reduce((s, d) => s + d.cargas.length, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Historial</Text>
          {lastSync && (
            <Text style={styles.syncLabel}>
              {sincronizando ? '⟳ Sincronizando…' : `✓ ${syncLabel()}`}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineText}>Sin red</Text>
            </View>
          )}
          {errorRed && isOnline && (
            <View style={[styles.offlineBadge, styles.errorBadge]}>
              <Text style={styles.offlineText}>Error de sync</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        <View style={styles.filtroRow}>
          <View style={styles.filtroWrap}>
            <Text style={styles.filtroLabel}>CHOFER</Text>
            <TextInput
              style={styles.filtroInput}
              value={chofer}
              onChangeText={setChofer}
              placeholder="Buscar…"
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
            />
          </View>
          <View style={styles.filtroWrap}>
            <Text style={styles.filtroLabel}>TRANSPORTE</Text>
            <TextInput
              style={styles.filtroInput}
              value={transporte}
              onChangeText={setTransporte}
              placeholder="Patente o empresa…"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              returnKeyType="done"
            />
          </View>
        </View>
        <View style={styles.filtroRow}>
          <View style={styles.filtroWrap}>
            <Text style={styles.filtroLabel}>FECHA (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.filtroInput}
              value={fecha}
              onChangeText={onChangeFecha}
              placeholder="16/04/2026"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          <View style={styles.filtroWrap}>
            <Text style={styles.filtroLabel}>CLIENTE</Text>
            <TextInput
              style={styles.filtroInput}
              value={cliente}
              onChangeText={setCliente}
              placeholder="Nombre del cliente…"
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
            />
          </View>
        </View>
        {hayFiltros && (
          <TouchableOpacity style={styles.limpiarBtn} onPress={limpiar}>
            <Text style={styles.limpiarText}>✕ Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Contenido */}
      {loadingCache ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.cargandoText}>Cargando historial…</Text>
        </View>
      ) : secciones.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{hayFiltros ? '🔍' : '📦'}</Text>
          <Text style={styles.emptyText}>
            {hayFiltros ? 'Sin resultados para esos filtros' : 'No hay cargas registradas'}
          </Text>
          {!isOnline && !hayFiltros && (
            <Text style={styles.emptySub}>Conectate para descargar el historial</Text>
          )}
        </View>
      ) : (
        <SectionList
          sections={secciones.map(d => ({ title: d.titulo, iso: d.iso, data: d.cargas }))}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionDia}>{capitalize(section.title)}</Text>
              <Text style={styles.sectionCount}>{section.data.length} carga{section.data.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <CargaCard
              carga={item}
              onPress={() => router.push({ pathname: '/(main)/carga/[id]', params: { id: item.id } })}
            />
          )}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {totalMostradas} carga{totalMostradas !== 1 ? 's' : ''}
              {hayFiltros ? ' encontradas' : ' en total'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  syncLabel: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  offlineBadge: {
    backgroundColor: '#2a1a00',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#5a3a00',
  },
  errorBadge: {
    backgroundColor: '#2a0000',
    borderColor: '#5a0000',
  },
  offlineText: { color: colors.warning, fontSize: 11, fontWeight: '600' },

  filtros: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  filtroRow: { flexDirection: 'row', gap: 8 },
  filtroWrap: { flex: 1, gap: 3 },
  filtroLabel: {
    color: colors.textFaint,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingLeft: 2,
  },
  filtroInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  limpiarBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  limpiarText: { color: colors.textMuted, fontSize: 12 },

  list: { padding: spacing.md, paddingBottom: 40 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  sectionDia: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCount: {
    color: colors.textFaint,
    fontSize: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  resultCount: {
    color: colors.textFaint,
    fontSize: 12,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  emptyEmoji: { fontSize: 40 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: 'center' },
  cargandoText: { color: colors.textFaint, fontSize: 14, marginTop: 8 },
})
