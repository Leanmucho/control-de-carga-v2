import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTurnoActivo } from '../../../src/hooks/useTurnoActivo'
import { useAuth } from '../../../src/hooks/useAuth'
import { getCargas } from '../../../src/lib/queries/cargas'
import { Button } from '../../../src/components/ui/Button'
import { Card } from '../../../src/components/ui/Card'
import { CargaCard } from '../../../src/components/CargaCard'
import { colors, spacing } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

export default function TurnoScreen() {
  const { turno, loading, iniciar, finalizar } = useTurnoActivo()
  const { perfil, signOut } = useAuth()
  const router = useRouter()
  const [cargas, setCargas] = useState<Carga[]>([])
  const [cargasLoading, setCargasLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (turno?.id) {
        setCargasLoading(true)
        getCargas(turno.id)
          .then(setCargas)
          .finally(() => setCargasLoading(false))
      } else {
        setCargas([])
      }
    }, [turno?.id])
  )

  async function handleIniciarTurno() {
    if (!perfil) return
    try {
      await iniciar(perfil.id)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo iniciar el turno')
    }
  }

  async function handleFinalizarTurno() {
    if (!turno) return
    Alert.alert(
      'Finalizar turno',
      '¿Estás seguro? Se cerrará el turno activo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              await finalizar(turno.id)
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Error al finalizar turno')
            }
          },
        },
      ]
    )
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
        <Text style={styles.appTitle}>Control de Carga</Text>
        <Button
          label={perfil?.nombre ?? 'Salir'}
          onPress={() =>
            Alert.alert('Cerrar sesión', '¿Salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', onPress: signOut, style: 'destructive' },
            ])
          }
          variant="ghost"
          style={{ paddingHorizontal: 8 }}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!turno ? (
          <View style={styles.noTurno}>
            <Text style={styles.noTurnoEmoji}>🌙</Text>
            <Text style={styles.noTurnoText}>No hay turno activo</Text>
            <Text style={styles.noTurnoSub}>
              Iniciá un turno para comenzar a registrar cargas
            </Text>
            <Button
              label="Iniciar turno"
              onPress={handleIniciarTurno}
              style={{ marginTop: spacing.lg, paddingHorizontal: 32 }}
            />
          </View>
        ) : (
          <>
            <Card style={styles.turnoCard}>
              <View style={styles.turnoHeader}>
                <View>
                  <Text style={styles.turnoLabel}>Turno activo</Text>
                  <Text style={styles.turnoControlador}>
                    {turno.controlador?.nombre ?? perfil?.nombre}
                  </Text>
                  <Text style={styles.turnoFecha}>
                    {new Date(turno.fecha_inicio).toLocaleString('es-AR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.turnoCargas}>
                  {cargas.length} carga{cargas.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <Button
                label="Nueva carga"
                onPress={() => router.push('/(main)/carga/nueva')}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
              <Button
                label="Finalizar turno"
                onPress={handleFinalizarTurno}
                variant="danger"
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Text style={styles.sectionTitle}>Cargas del turno</Text>

            {cargasLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : cargas.length === 0 ? (
              <Text style={styles.empty}>Sin cargas aún</Text>
            ) : (
              cargas.map(c => (
                <CargaCard
                  key={c.id}
                  carga={c}
                  onPress={() => router.push({ pathname: '/(main)/carga/[id]/index', params: { id: c.id } })}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

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
  },
  appTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  scroll: { padding: spacing.md, paddingBottom: 32 },
  noTurno: { alignItems: 'center', paddingTop: 80 },
  noTurnoEmoji: { fontSize: 64, marginBottom: spacing.md },
  noTurnoText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  noTurnoSub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  turnoCard: { marginBottom: spacing.md },
  turnoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  turnoLabel: { color: colors.success, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  turnoControlador: { color: colors.text, fontSize: 18, fontWeight: '700' },
  turnoFecha: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  turnoCargas: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 0.5 },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: 32, fontSize: 15 },
})
