import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getPallets, checkPallet, addPallet, bulkInsertPallets, editPallet, deletePallet } from '../lib/queries/pallets'
import { enqueueOp } from '../lib/offline/queue'
import {
  cachePallet, updateCachedPalletEstado, updateCachedPalletCajas, deleteCachedPallet,
  getCachedPallets,
} from '../lib/offline/db'
import { genUuid } from '../lib/uuid'
import type { Pallet } from '../types/database'

export function usePallets(clienteCargaId: string, isOnline: boolean) {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Hidratar desde cache primero
    const cached = getCachedPallets(clienteCargaId)
    if (cached.length > 0) {
      setPallets(cached)
      setLoading(false)
    }
    if (!isOnline) {
      setLoading(false)
      return
    }
    try {
      const data = await getPallets(clienteCargaId)
      setPallets(data)
      for (const p of data) cachePallet(p)
    } catch {
      // mantener cache si falla
      if (cached.length === 0) {
        const fresh = getCachedPallets(clienteCargaId)
        if (fresh.length > 0) setPallets(fresh)
      }
    } finally {
      setLoading(false)
    }
  }, [clienteCargaId, isOnline])

  useEffect(() => { refresh() }, [refresh])

  // Realtime solo cuando hay red — el suscribe falla silencioso pero gasta batería
  useEffect(() => {
    if (!isOnline) return
    const channel = supabase
      .channel(`pallets:${clienteCargaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pallets',
          filter: `cliente_carga_id=eq.${clienteCargaId}`,
        },
        () => { refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteCargaId, refresh, isOnline])

  async function check(palletId: string) {
    const hora = new Date().toISOString()
    setPallets(prev =>
      prev.map(p =>
        p.id === palletId ? { ...p, estado: 'cargado', hora_carga: hora } : p
      )
    )
    updateCachedPalletEstado(palletId)

    if (!isOnline) {
      enqueueOp({ type: 'CHECK_PALLET', palletId, hora_carga: hora })
      return
    }
    try {
      await checkPallet(palletId, hora)
    } catch {
      enqueueOp({ type: 'CHECK_PALLET', palletId, hora_carga: hora })
    }
  }

  async function add(cantidad_cajas: number) {
    const localId = genUuid()
    const nuevo: Pallet = {
      id: localId,
      cliente_carga_id: clienteCargaId,
      cantidad_cajas,
      estado: 'en_piso',
      hora_carga: null,
      created_at: new Date().toISOString(),
    }
    cachePallet(nuevo)
    setPallets(prev => [...prev, nuevo])

    if (!isOnline) {
      enqueueOp({ type: 'CREATE_PALLET', palletId: localId, cliente_carga_id: clienteCargaId, cantidad_cajas })
      return
    }
    try {
      await addPallet({ id: localId, cliente_carga_id: clienteCargaId, cantidad_cajas })
    } catch {
      enqueueOp({ type: 'CREATE_PALLET', palletId: localId, cliente_carga_id: clienteCargaId, cantidad_cajas })
    }
  }

  async function addBulk(cantidad_cajas: number, cantidad_pallets: number) {
    const now = new Date().toISOString()
    const rows = Array.from({ length: cantidad_pallets }, (): Pallet => ({
      id: genUuid(),
      cliente_carga_id: clienteCargaId,
      cantidad_cajas,
      estado: 'en_piso',
      hora_carga: null,
      created_at: now,
    }))
    for (const p of rows) cachePallet(p)
    setPallets(prev => [...prev, ...rows])

    const insertRows = rows.map(p => ({
      id: p.id,
      cliente_carga_id: clienteCargaId,
      cantidad_cajas,
    }))

    if (!isOnline) {
      enqueueOp({ type: 'BULK_CREATE_PALLETS', pallets: insertRows })
      return
    }
    try {
      await bulkInsertPallets(insertRows)
    } catch {
      enqueueOp({ type: 'BULK_CREATE_PALLETS', pallets: insertRows })
    }
  }

  async function edit(palletId: string, cantidad_cajas: number) {
    setPallets(prev =>
      prev.map(p => p.id === palletId ? { ...p, cantidad_cajas } : p)
    )
    updateCachedPalletCajas(palletId, cantidad_cajas)

    if (!isOnline) {
      enqueueOp({ type: 'EDIT_PALLET', palletId, cantidad_cajas })
      return
    }
    try {
      await editPallet(palletId, cantidad_cajas)
    } catch {
      enqueueOp({ type: 'EDIT_PALLET', palletId, cantidad_cajas })
    }
  }

  async function remove(palletId: string) {
    const snapshot = pallets
    setPallets(prev => prev.filter(p => p.id !== palletId))
    deleteCachedPallet(palletId)

    if (!isOnline) {
      enqueueOp({ type: 'DELETE_PALLET', palletId })
      return
    }
    try {
      await deletePallet(palletId)
    } catch (e) {
      // En vez de revertir, encolamos para reintentar (mejor UX offline)
      enqueueOp({ type: 'DELETE_PALLET', palletId })
      void snapshot
      void e
    }
  }

  return { pallets, loading, refresh, check, add, addBulk, edit, remove }
}
