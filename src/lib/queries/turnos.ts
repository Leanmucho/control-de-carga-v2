import { supabase } from '../supabase'
import type { Turno } from '../../types/database'

export async function getTurnoActivo(): Promise<Turno | null> {
  const { data } = await supabase
    .from('turnos')
    .select('*, controlador:perfiles(nombre)')
    .eq('activo', true)
    .single()
  return data
}

export async function iniciarTurno(controladorId: string): Promise<Turno> {
  const { data, error } = await supabase
    .from('turnos')
    .insert({ controlador_id: controladorId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function finalizarTurno(turnoId: string): Promise<void> {
  const { error } = await supabase
    .from('turnos')
    .update({ activo: false, fecha_fin: new Date().toISOString() })
    .eq('id', turnoId)
  if (error) throw error
}
