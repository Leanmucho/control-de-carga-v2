import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { buscarCargas } from '../../../src/lib/queries/cargas'
import { CargaCard } from '../../../src/components/CargaCard'
import { colors, spacing } from '../../../src/constants/theme'
import type { Carga } from '../../../src/types/database'

export default function HistorialScreen() {
  const router = useRouter()
  const [cargas, setCargas] = useState<Carga[]>([])
  const [loading, setLoading] = useState(false)
  const [chofer, setChofer] = useState('')
  const [transporte, setTransporte] = useState('')
  const [fecha, setFecha] = useState('')
  const [cliente, setCliente] = useState('')

  const buscar = useCallback(async () => {
    setLoading(true)
    try {
      const results = await buscarCargas({
        chofer: chofer || undefined,
        transporte: transporte || undefined,
        fecha: fecha || undefined,
        cliente: cliente || undefined,
      })
      setCargas(results)
    } finally {
      setLoading(false)
    }
  }, [chofer, transporte, fecha, cliente])

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      buscar()
    }, [buscar])
  )

  function limpiar() {
    setChofer('')
    setTransporte('')
    setFecha('')
    setCliente('')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        <View style={styles.filtroRow}>
          <TextInput
            style={styles.filtroInput}
            value={chofer}
            onChangeText={setChofer}
            placeholder="Chofer"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            onSubmitEditing={buscar}
          />
          <TextInput
            style={styles.filtroInput}
            value={transporte}
            onChangeText={setTransporte}
            placeholder="Transporte"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={buscar}
          />
        </View>
        <View style={styles.filtroRow}>
          <TextInput
            style={styles.filtroInput}
            value={fecha}
            onChangeText={setFecha}
            placeholder="Fecha (YYYY-MM-DD)"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            onSubmitEditing={buscar}
          />
          <TextInput
            style={styles.filtroInput}
            value={cliente}
            onChangeText={setCliente}
            placeholder="Cliente"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            onSubmitEditing={buscar}
          />
        </View>
        <View style={styles.filtroActions}>
          <TouchableOpacity style={styles.limpiarBtn} onPress={limpiar}>
            <Text style={styles.limpiarText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buscarBtn} onPress={buscar}>
            <Text style={styles.buscarText}>🔍 Buscar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={cargas}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CargaCard
              carga={item}
              onPress={() => router.push({ pathname: '/(main)/carga/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Sin resultados</Text>
          }
          ListHeaderComponent={
            cargas.length > 0 ? (
              <Text style={styles.resultCount}>{cargas.length} resultado{cargas.length !== 1 ? 's' : ''}</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  filtros: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  filtroRow: { flexDirection: 'row', gap: spacing.sm },
  filtroInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filtroActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  limpiarBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  limpiarText: { color: colors.textMuted, fontSize: 14 },
  buscarBtn: {
    flex: 2,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  buscarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: spacing.md, paddingBottom: 32 },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: 40, fontSize: 15 },
  resultCount: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
})
