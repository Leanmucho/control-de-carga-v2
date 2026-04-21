import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getPallets, checkPallet, addPallet, bulkAddPallets, editPallet, deletePallet } from '../lib/queries/pallets'
import { enqueueOp } from '../lib/offline/queue'
import { cachePallet, updateCachedPalletEstado, updateCachedPalletCajas, deleteCachedPallet } from '../lib/offline/db'
import type { Pallet } from '../types/database'

export function usePallets(clienteCargaId: string, isOnline: boolean) {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getPallets(clienteCargaId)
      setPallets(data)
      for (const p of data) cachePallet(p)
    } finally {
      setLoading(false)
    }
  }, [clienteCargaId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
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
  }, [clienteCargaId, refresh])

  async function check(palletId: string) {
    setPallets(prev =>
      prev.map(p =>
        p.id === palletId
          ? { ...p, estado: 'cargado', hora_carga: new Date().toISOString() }
          : p
      )
    )
    updateCachedPalletEstado(palletId)

    if (!isOnline) {
      enqueueOp({ type: 'CHECK_PALLET', palletId })
      return
    }

    try {
      await checkPallet(palletId)
    } catch {
      await refresh()
    }
  }

  async function add(cantidad_cajas: number) {
    if (!isOnline) {
      throw new Error('Sin conexión: guardá los pallets cuando recuperes la red')
    }
    const p = await addPallet({ cliente_carga_id: clienteCargaId, cantidad_cajas })
    cachePallet(p)
    setPallets(prev => [...prev, p])
  }

  async function addBulk(cantidad_cajas: number, cantidad_pallets: number) {
    if (!isOnline) {
      throw new Error('Sin conexión: guardá los pallets cuando recuperes la red')
    }
    const nuevos = await bulkAddPallets(clienteCargaId, cantidad_cajas, cantidad_pallets)
    for (const p of nuevos) cachePallet(p)
    setPallets(prev => [...prev, ...nuevos])
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
    await editPallet(palletId, cantidad_cajas)
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
      setPallets(snapshot)
      throw e
    }
  }

  return { pallets, loading, refresh, check, add, addBulk, edit, remove }
}
