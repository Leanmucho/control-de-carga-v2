import { supabase } from '../supabase'
import type { Turno } from '../../types/database'

export async function getTurnoActivo(): Promise<Turno | null> {
  // getSession() lee de AsyncStorage local — funciona offline.
  // (getUser() hace una llamada HTTP que falla sin red y rompe el cache.)
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const { data, error } = await supabase
    .from('turnos')
    .select('*, controlador:perfiles(nombre)')
    .eq('activo', true)
    .eq('controlador_id', user.id)
    .maybeSingle()

  // Tirar errores reales (red, RLS, etc.) para que el caller pueda caer al cache.
  // `data === null` con `error === null` significa "no hay turno activo" (caso real).
  if (error) {
    console.warn('[turnos] getTurnoActivo error:', error.message)
    throw new Error(error.message)
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
  if (error) throw new Error(`Error al finalizar turno: ${error.message} [${error.code}]`)
}
