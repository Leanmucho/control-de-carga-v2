import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { useAuth } from '../../../src/hooks/useAuth'
import { getCargas } from '../../../src/lib/queries/cargas'
import { Button } from '../../../src/components/ui/Button'
import { CargaCard } from '../../../src/components/CargaCard'
import { colors, spacing } from '../../../src/constants/theme'
import { construirResumen, guardarResumenLocal, enviarResumenPorEmail } from '../../../src/lib/turnoResumen'
import type { Carga } from '../../../src/types/database'
import type { ResumenTurno } from '../../../src/lib/turnoResumen'

export default function TurnoScreen() {
  const { turno, loading, iniciar, finalizar } = useTurnoActivo()
  const { perfil, signOut, userId } = useAuth()
  const router = useRouter()
  const [cargas, setCargas] = useState<Carga[]>([])
  const [cargasLoading, setCargasLoading] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (turno?.id) {
        setCargasLoading(true)
        getCargas(turno.id).then(setCargas).finally(() => setCargasLoading(false))
      } else {
        setCargas([])
      }
    }, [turno?.id])
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

  async function handleFinalizarTurno() {
    if (!turno) return
    Alert.alert(
      'Finalizar turno',
      `Se cerrará el turno con ${cargas.length} carga${cargas.length !== 1 ? 's' : ''} registradas. El resumen se guardará localmente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: () => ejecutarFinalizar(),
        },
      ]
    )
  }

  async function ejecutarFinalizar() {
    if (!turno) return
    setFinalizando(true)
    let resumen: ResumenTurno | null = null
    try {
      const controlador = perfil?.nombre ?? 'Controlador'
      resumen = await construirResumen(turno.id, controlador)
      await guardarResumenLocal(resumen)
    } catch {
      // No bloqueamos la finalización si falla el resumen — lo ignoramos
    }

    try {
      await finalizar(turno.id)
    } catch (e: unknown) {
      setFinalizando(false)
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo finalizar el turno')
      return
    }

    setFinalizando(false)

    if (resumen) {
      Alert.alert(
        'Turno finalizado ✓',
        'El resumen quedó guardado en el dispositivo. ¿Querés enviarlo por email ahora?',
        [
          {
            text: 'Ahora no',
            style: 'cancel',
          },
          {
            text: 'Enviar email',
            onPress: () => ofrecerEmail(resumen!),
          },
        ]
      )
    }
  }

  async function ofrecerEmail(resumen: ResumenTurno) {
    const resultado = await enviarResumenPorEmail(resumen)
    if (resultado === 'unavailable') {
      Alert.alert(
        'Sin cliente de mail',
        'No hay una app de correo configurada en este dispositivo. El resumen quedó guardado para enviarlo más tarde.'
      )
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
          onPress={() => Alert.alert('Cerrar sesion', 'Salir?', [
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
            <View style={styles.actionsRow}>
              <Button
                label="+ Nueva Carga"
                onPress={() => router.push('/(main)/carga/nueva')}
                style={{ flex: 1 }}
              />
              <Button
                label={finalizando ? 'Guardando…' : 'Finalizar'}
                onPress={handleFinalizarTurno}
                variant="danger"
                style={{ flex: 1 }}
                disabled={finalizando}
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
              <Text style={styles.emptyText}>Sin cargas registradas aun</Text>
              <Text style={styles.emptySub}>Usa el boton de arriba para empezar</Text>
            </View>
          ) : (
            cargas.map(c => (
              <CargaCard
                key={c.id}
                carga={c}
                onPress={() => router.push({ pathname: '/(main)/carga/[id]/index', params: { id: c.id } })}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={statBox.box}>
      <Text style={[statBox.num, color ? { color } : null]}>{value}</Text>
      <Text style={statBox.lbl}>{label}</Text>
    </View>
  )
}

const statBox = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  num: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  lbl: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  appTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  topSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  noTurnoWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  noTurnoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg + 8,
    alignItems: 'center',
  },
  noTurnoEmoji: { fontSize: 52, marginBottom: spacing.md },
  noTurnoTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  noTurnoSub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCount: {
    color: colors.textFaint,
    fontSize: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, marginTop: 4 },
})
