import { supabase } from '../supabase'
import type { Pallet } from '../../types/database'

export async function checkPallet(palletId: string, hora?: string): Promise<void> {
  const { error } = await supabase
    .from('pallets')
    .update({ estado: 'cargado', hora_carga: hora ?? new Date().toISOString() })
    .eq('id', palletId)
  if (error) throw new Error(`Error al marcar pallet: ${error.message} [${error.code}]`)
}

export async function addPallet(payload: {
  id?: string
  cliente_carga_id: string
  cantidad_cajas: number
}): Promise<Pallet> {
  // upsert con ignoreDuplicates → si por alguna razón este pallet ya existe
  // (e.g. retry tras un éxito parcial de la cola), no genera duplicados ni error.
  const { data, error } = await supabase
    .from('pallets')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function bulkInsertPallets(
  rows: Array<{ id?: string; cliente_carga_id: string; cantidad_cajas: number }>
): Promise<Pallet[]> {
  const { data, error } = await supabase
    .from('pallets')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select()
  if (error) throw error
  return data ?? []
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
  return bulkInsertPallets(rows)
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
