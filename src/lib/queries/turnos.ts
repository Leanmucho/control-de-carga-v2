import { supabase } from '../supabase'
import type { Turno } from '../../types/database'

export async function getTurnoActivo(): Promise<Turno | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('turnos')
    .select('*, controlador:perfiles(nombre)')
    .eq('activo', true)
    .eq('controlador_id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[turnos] getTurnoActivo error:', error.message)
    return null
  }
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
