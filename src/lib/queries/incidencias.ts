import { supabase } from '../supabase'
import type { Incidencia } from '../../types/database'

export async function addIncidencia(payload: {
  carga_id: string
  tipo: string
  descripcion: string
}): Promise<Incidencia> {
  const { data, error } = await supabase
    .from('incidencias')
    .insert({ ...payload, hora: new Date().toISOString() })
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
