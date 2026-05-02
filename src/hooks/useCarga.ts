import { useEffect, useState, useCallback } from 'react'
import { getCarga, avanzarEstado, registrarLlegadaCamion, guardarNota } from '../lib/queries/cargas'
import { addCliente as addClienteRemote, deleteCliente as deleteClienteRemote } from '../lib/queries/clientes'
import { addIncidencia as addIncidenciaRemote } from '../lib/queries/incidencias'
import { checkPallet as checkPalletQuery } from '../lib/queries/pallets'
import {
  cacheCarga, getCachedCarga,
  cacheCliente, deleteCachedCliente,
  cacheIncidencia,
} from '../lib/offline/db'
import { enqueueOp } from '../lib/offline/queue'
import { genUuid } from '../lib/uuid'
import type { Carga, ClienteCarga, Incidencia } from '../types/database'
import type { EstadoCarga } from '../constants/estados'

export function useCarga(id: string, isOnline: boolean = true) {
  const [carga, setCarga] = useState<Carga | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Hidratar inmediato desde cache, así la pantalla nunca queda en blanco
    // (especialmente al abrir una carga creada offline).
    const cached = getCachedCarga(id)
    if (cached) {
      setCarga(cached)
      setLoading(false)
    }
    if (!isOnline) {
      if (!cached) setError('Sin conexión y sin datos guardados de esta carga')
      setLoading(false)
      return
    }

    try {
      const data = await getCarga(id)
      setCarga(data)
      cacheCarga(data)
      setError(null)
    } catch (e: unknown) {
      const fallback = cached ?? getCachedCarga(id)
      if (fallback) {
        setCarga(fallback)
      } else {
        setError(e instanceof Error ? e.message : 'Error al cargar carga')
      }
    } finally {
      setLoading(false)
    }
  }, [id, isOnline])

  useEffect(() => { refresh() }, [refresh])

  async function avanzar(nuevoEstado: EstadoCarga) {
    const hora = new Date().toISOString()
    setCarga(prev => {
      if (!prev) return prev
      const next: Carga = { ...prev, estado: nuevoEstado }
      if (nuevoEstado === 'en_carga')   next.hora_inicio_carga = hora
      if (nuevoEstado === 'finalizado') next.hora_fin_carga    = hora
      cacheCarga(next)
      return next
    })

    if (!isOnline) {
      enqueueOp({ type: 'AVANZAR_ESTADO', cargaId: id, nuevoEstado, hora })
      return
    }
    try {
      await avanzarEstado(id, nuevoEstado, hora)
    } catch {
      // Falló online: encolar para reintentar
      enqueueOp({ type: 'AVANZAR_ESTADO', cargaId: id, nuevoEstado, hora })
    }
  }

  async function registrarLlegada() {
    const hora = new Date().toISOString()
    setCarga(prev => {
      if (!prev) return prev
      const next = { ...prev, hora_llegada_camion: hora }
      cacheCarga(next)
      return next
    })

    if (!isOnline) {
      enqueueOp({ type: 'LLEGADA_CAMION', cargaId: id, hora })
      return
    }
    try {
      await registrarLlegadaCamion(id, hora)
    } catch {
      enqueueOp({ type: 'LLEGADA_CAMION', cargaId: id, hora })
    }
  }

  async function guardarNotaCarga(nota: string) {
    setCarga(prev => {
      if (!prev) return prev
      const next = { ...prev, notas: nota }
      cacheCarga(next)
      return next
    })

    if (!isOnline) {
      enqueueOp({ type: 'GUARDAR_NOTA', cargaId: id, nota })
      return
    }
    try {
      await guardarNota(id, nota)
    } catch {
      enqueueOp({ type: 'GUARDAR_NOTA', cargaId: id, nota })
    }
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
      enqueueOp({ type: 'CHECK_PALLET', palletId, hora_carga: hora })
      return
    }

    try {
      await checkPalletQuery(palletId, hora)
    } catch {
      enqueueOp({ type: 'CHECK_PALLET', palletId, hora_carga: hora })
    }
  }

  /**
   * Agrega un cliente a la carga. Genera UUID local, escribe en cache y
   * encola si está offline. La UI se actualiza inmediatamente.
   */
  async function addClienteCarga(payload: {
    nombre: string
    pallets_hoja_ruta?: number | null
    cajas_hoja_ruta?: number | null
  }): Promise<ClienteCarga> {
    const localId = genUuid()
    const orden = (carga?.clientes_carga?.length ?? 0) + 1
    const nuevo: ClienteCarga = {
      id: localId,
      carga_id: id,
      nombre: payload.nombre,
      orden,
      pallets_hoja_ruta: payload.pallets_hoja_ruta ?? null,
      cajas_hoja_ruta: payload.cajas_hoja_ruta ?? null,
      pallets: [],
    }

    cacheCliente(nuevo)
    setCarga(prev => prev ? {
      ...prev,
      clientes_carga: [...(prev.clientes_carga ?? []), nuevo],
    } : prev)

    const fullPayload = {
      id: localId,
      carga_id: id,
      nombre: payload.nombre,
      orden,
      pallets_hoja_ruta: payload.pallets_hoja_ruta ?? null,
      cajas_hoja_ruta: payload.cajas_hoja_ruta ?? null,
    }

    if (!isOnline) {
      enqueueOp({ type: 'ADD_CLIENTE', payload: fullPayload, localId })
      return nuevo
    }
    try {
      await addClienteRemote(fullPayload)
    } catch {
      enqueueOp({ type: 'ADD_CLIENTE', payload: fullPayload, localId })
    }
    return nuevo
  }

  async function deleteClienteCarga(clienteId: string) {
    deleteCachedCliente(clienteId)
    setCarga(prev => prev ? {
      ...prev,
      clientes_carga: prev.clientes_carga?.filter(c => c.id !== clienteId),
    } : prev)

    if (!isOnline) {
      enqueueOp({ type: 'DELETE_CLIENTE', clienteId })
      return
    }
    try {
      await deleteClienteRemote(clienteId)
    } catch {
      enqueueOp({ type: 'DELETE_CLIENTE', clienteId })
    }
  }

  async function addIncidenciaCarga(tipo: string, descripcion: string): Promise<Incidencia> {
    const localId = genUuid()
    const hora = new Date().toISOString()
    const nueva: Incidencia = {
      id: localId,
      carga_id: id,
      tipo,
      descripcion,
      hora,
    }

    cacheIncidencia(nueva)
    setCarga(prev => prev ? {
      ...prev,
      incidencias: [...(prev.incidencias ?? []), nueva],
    } : prev)

    if (!isOnline) {
      enqueueOp({ type: 'ADD_INCIDENCIA', cargaId: id, tipo, descripcion, localId, hora })
      return nueva
    }
    try {
      await addIncidenciaRemote({ id: localId, carga_id: id, tipo, descripcion, hora })
    } catch {
      enqueueOp({ type: 'ADD_INCIDENCIA', cargaId: id, tipo, descripcion, localId, hora })
    }
    return nueva
  }

  return {
    carga, loading, error, refresh,
    avanzar, registrarLlegada, guardarNotaCarga, checkPallet,
    addClienteCarga, deleteClienteCarga, addIncidenciaCarga,
  }
}
