import { supabase } from '../supabase'
import type { ClienteCarga } from '../../types/database'

export async function addCliente(payload: {
  carga_id: string
  nombre: string
  orden: number
}): Promise<ClienteCarga> {
  const { data, error } = await supabase
    .from('clientes_carga')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from('clientes_carga')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function reordenarClientes(
  ids: string[]
): Promise<void> {
  const updates = ids.map((id, i) =>
    supabase.from('clientes_carga').update({ orden: i + 1 }).eq('id', id)
  )
  await Promise.all(updates)
}
