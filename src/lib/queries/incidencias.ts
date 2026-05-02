import { supabase } from '../supabase'
import type { Incidencia } from '../../types/database'

export async function addIncidencia(payload: {
  id?: string
  carga_id: string
  tipo: string
  descripcion: string
  hora?: string
}): Promise<Incidencia> {
  // Idempotente — los IDs se generan client-side al encolar, así que un
  // retry del mismo op no duplica la incidencia.
  const { data, error } = await supabase
    .from('incidencias')
    .upsert(
      { ...payload, hora: payload.hora ?? new Date().toISOString() },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteIncidencia(id: string): Promise<void> {
  const { error } = await supabase
    .from('incidencias')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getIncidencias(cargaId: string): Promise<Incidencia[]> {
  const { data, error } = await supabase
    .from('incidencias')
    .select('*')
    .eq('carga_id', cargaId)
    .order('hora', { ascending: true })
  if (error) throw error
  return data ?? []
}
