import { supabase } from '../supabase'
import type { Pallet } from '../../types/database'

export async function checkPallet(palletId: string): Promise<void> {
  const { error } = await supabase
    .from('pallets')
    .update({ estado: 'cargado', hora_carga: new Date().toISOString() })
    .eq('id', palletId)
  if (error) throw new Error(`Error al marcar pallet: ${error.message} [${error.code}]`)
}

export async function addPallet(payload: {
  cliente_carga_id: string
  cantidad_cajas: number
}): Promise<Pallet> {
  const { data, error } = await supabase
    .from('pallets')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function bulkAddPallets(
  clienteCargaId: string,
  cantidad_cajas: number,
  cantidad_pallets: number
): Promise<Pallet[]> {
  const rows = Array.from({ length: cantidad_pallets }, () => ({
    cliente_carga_id: clienteCargaId,
    cantidad_cajas,
  }))
  const { data, error } = await supabase
    .from('pallets')
    .insert(rows)
    .select()
  if (error) throw error
  return data ?? []
}

export async function editPallet(
  palletId: string,
  cantidad_cajas: number
): Promise<void> {
  const { error } = await supabase
    .from('pallets')
    .update({ cantidad_cajas })
    .eq('id', palletId)
  if (error) throw error
}

export async function deletePallet(palletId: string): Promise<void> {
  const { error } = await supabase
    .from('pallets')
    .delete()
    .eq('id', palletId)
  if (error) throw error
}

export async function getPallets(clienteCargaId: string): Promise<Pallet[]> {
  const { data, error } = await supabase
    .from('pallets')
    .select('*')
    .eq('cliente_carga_id', clienteCargaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
