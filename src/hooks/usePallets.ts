import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getPallets, checkPallet, addPallet, bulkAddPallets, editPallet, deletePallet } from '../lib/queries/pallets'
import { enqueueOp } from '../lib/offline/queue'
import type { Pallet } from '../types/database'

export function usePallets(clienteCargaId: string, isOnline: boolean) {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getPallets(clienteCargaId)
      setPallets(data)
    } finally {
      setLoading(false)
    }
  }, [clienteCargaId])

  useEffect(() => { refresh() }, [refresh])

  // Realtime subscription
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
    // Optimistic update
    setPallets(prev =>
      prev.map(p =>
        p.id === palletId
          ? { ...p, estado: 'cargado', hora_carga: new Date().toISOString() }
          : p
      )
    )

    if (!isOnline) {
      await enqueueOp({ type: 'CHECK_PALLET', palletId, timestamp: Date.now() })
      return
    }

    try {
      await checkPallet(palletId)
    } catch {
      // Roll back optimistic update
      await refresh()
    }
  }

  async function add(cantidad_cajas: number) {
    const p = await addPallet({ cliente_carga_id: clienteCargaId, cantidad_cajas })
    setPallets(prev => [...prev, p])
  }

  async function addBulk(cantidad_cajas: number, cantidad_pallets: number) {
    const nuevos = await bulkAddPallets(clienteCargaId, cantidad_cajas, cantidad_pallets)
    setPallets(prev => [...prev, ...nuevos])
  }

  async function edit(palletId: string, cantidad_cajas: number) {
    setPallets(prev =>
      prev.map(p => p.id === palletId ? { ...p, cantidad_cajas } : p)
    )
    if (!isOnline) {
      await enqueueOp({ type: 'EDIT_PALLET', palletId, cantidad_cajas, timestamp: Date.now() })
      return
    }
    await editPallet(palletId, cantidad_cajas)
  }

  async function remove(palletId: string) {
    setPallets(prev => prev.filter(p => p.id !== palletId))
    if (!isOnline) {
      await enqueueOp({ type: 'DELETE_PALLET', palletId, timestamp: Date.now() })
      return
    }
    await deletePallet(palletId)
  }

  return { pallets, loading, refresh, check, add, addBulk, edit, remove }
}
