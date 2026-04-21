import { useEffect, useState, useCallback } from 'react'
import { getCarga, avanzarEstado, registrarLlegadaCamion, guardarNota } from '../lib/queries/cargas'
import { checkPallet as checkPalletQuery } from '../lib/queries/pallets'
import { cacheCarga, getCachedCarga } from '../lib/offline/db'
import { enqueueOp } from '../lib/offline/queue'
import type { Carga } from '../types/database'
import type { EstadoCarga } from '../constants/estados'

export function useCarga(id: string, isOnline: boolean = true) {
  const [carga, setCarga] = useState<Carga | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getCarga(id)
      setCarga(data)
      cacheCarga(data)
      setError(null)
    } catch (e: unknown) {
      const cached = getCachedCarga(id)
      if (cached) {
        setCarga(cached)
      } else {
        setError(e instanceof Error ? e.message : 'Error al cargar carga')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  async function avanzar(nuevoEstado: EstadoCarga) {
    if (!isOnline) {
      enqueueOp({ type: 'AVANZAR_ESTADO', cargaId: id, nuevoEstado })
      setCarga(prev => prev ? { ...prev, estado: nuevoEstado } : prev)
      return
    }
    await avanzarEstado(id, nuevoEstado)
    await refresh()
  }

  async function registrarLlegada() {
    const hora = new Date().toISOString()
    if (!isOnline) {
      enqueueOp({ type: 'LLEGADA_CAMION', cargaId: id })
      setCarga(prev => prev ? { ...prev, hora_llegada_camion: hora } : prev)
      return
    }
    await registrarLlegadaCamion(id)
    await refresh()
  }

  async function guardarNotaCarga(nota: string) {
    if (!isOnline) {
      enqueueOp({ type: 'GUARDAR_NOTA', cargaId: id, nota })
      setCarga(prev => prev ? { ...prev, notas: nota } : prev)
      return
    }
    await guardarNota(id, nota)
    setCarga(prev => prev ? { ...prev, notas: nota } : prev)
  }

  async function checkPallet(palletId: string) {
    const hora = new Date().toISOString()
    setCarga(prev => {
      if (!prev) return prev
      return {
        ...prev,
        clientes_carga: prev.clientes_carga?.map(c => ({
          ...c,
          pallets: c.pallets?.map(p =>
            p.id === palletId
              ? { ...p, estado: 'cargado' as const, hora_carga: hora }
              : p
          ),
        })),
      }
    })

    if (!isOnline) {
      enqueueOp({ type: 'CHECK_PALLET', palletId })
      return
    }

    try {
      await checkPalletQuery(palletId)
    } catch (e) {
      await refresh()
      throw e
    }
  }

  return { carga, loading, error, refresh, avanzar, registrarLlegada, guardarNotaCarga, checkPallet }
}
