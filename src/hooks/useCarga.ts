import { useEffect, useState, useCallback } from 'react'
import { getCarga, avanzarEstado, registrarLlegadaCamion, guardarNota } from '../lib/queries/cargas'
import type { Carga } from '../types/database'
import type { EstadoCarga } from '../constants/estados'

export function useCarga(id: string) {
  const [carga, setCarga] = useState<Carga | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getCarga(id)
      setCarga(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar carga')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  async function avanzar(nuevoEstado: EstadoCarga) {
    await avanzarEstado(id, nuevoEstado)
    await refresh()
  }

  async function registrarLlegada() {
    await registrarLlegadaCamion(id)
    await refresh()
  }

  async function guardarNotaCarga(nota: string) {
    await guardarNota(id, nota)
    setCarga(prev => prev ? { ...prev, notas: nota } : prev)
  }

  return { carga, loading, error, refresh, avanzar, registrarLlegada, guardarNotaCarga }
}
