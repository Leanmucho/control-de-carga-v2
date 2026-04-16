import { supabase } from '../supabase'
import type { Carga } from '../../types/database'
import type { EstadoCarga } from '../../constants/estados'

export async function getCargas(turnoId: string): Promise<Carga[]> {
  const { data, error } = await supabase
    .from('cargas')
    .select(`
      *,
      clientes_carga(*, pallets(*)),
      incidencias(*)
    `)
    .eq('turno_id', turnoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCarga(id: string): Promise<Carga> {
  const { data, error } = await supabase
    .from('cargas')
    .select(`
      *,
      clientes_carga(id, nombre, orden, pallets(*)),
      incidencias(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearCarga(payload: {
  turno_id: string
  chofer: string
  transporte: string
  numero_remito?: string
  clarkista_nombre?: string
}): Promise<Carga> {
  const { data, error } = await supabase
    .from('cargas')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function avanzarEstado(
  cargaId: string,
  nuevoEstado: EstadoCarga
): Promise<void> {
  const update: Record<string, string> = { estado: nuevoEstado }
  if (nuevoEstado === 'en_carga')   update.hora_inicio_carga = new Date().toISOString()
  if (nuevoEstado === 'finalizado') update.hora_fin_carga    = new Date().toISOString()
  const { data, error } = await supabase
    .from('cargas')
    .update(update)
    .eq('id', cargaId)
    .select('id')
    .single()
  if (error) throw new Error(`Error al actualizar estado: ${error.message}`)
  if (!data) throw new Error('No se pudo actualizar el estado. Verificá los permisos en Supabase (RLS).')
}

export async function registrarLlegadaCamion(cargaId: string): Promise<void> {
  const { data, error } = await supabase
    .from('cargas')
    .update({ hora_llegada_camion: new Date().toISOString() })
    .eq('id', cargaId)
    .select('id')
    .single()
  if (error) throw new Error(`Error al registrar llegada: ${error.message}`)
  if (!data) throw new Error('No se pudo registrar la llegada. Verificá los permisos en Supabase (RLS).')
}

export async function guardarNota(cargaId: string, nota: string): Promise<void> {
  const { error } = await supabase
    .from('cargas').update({ notas: nota }).eq('id', cargaId)
  if (error) throw error
}

export async function eliminarCarga(cargaId: string): Promise<void> {
  const { error } = await supabase
    .from('cargas')
    .delete()
    .eq('id', cargaId)
  if (error) throw new Error(`Error al eliminar carga: ${error.message}`)
}

export async function buscarCargas(filtros: {
  chofer?: string
  transporte?: string
  fecha?: string
  cliente?: string
}): Promise<Carga[]> {
  let q = supabase
    .from('cargas')
    .select(`*, clientes_carga(nombre), incidencias(id)`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filtros.chofer)     q = q.ilike('chofer', `%${filtros.chofer}%`)
  if (filtros.transporte) q = q.ilike('transporte', `%${filtros.transporte}%`)
  if (filtros.fecha)      q = q.gte('created_at', filtros.fecha)
                               .lt('created_at', filtros.fecha + 'T23:59:59')

  const { data, error } = await q
  if (error) throw error

  if (filtros.cliente) {
    return (data ?? []).filter(c =>
      c.clientes_carga?.some((cl: { nombre: string }) =>
        cl.nombre.toLowerCase().includes(filtros.cliente!.toLowerCase())
      )
    )
  }
  return data ?? []
}
