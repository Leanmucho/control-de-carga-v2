import { dbEnqueueOp, dbGetQueue, dbRemoveOp, dbClearQueue, dbGetQueueCount } from './db'

export type OfflineOp =
  // Pallet ops
  | { type: 'CHECK_PALLET';    palletId: string; hora_carga?: string }
  | { type: 'EDIT_PALLET';     palletId: string; cantidad_cajas: number }
  | { type: 'DELETE_PALLET';   palletId: string }
  | { type: 'CREATE_PALLET';   palletId: string; cliente_carga_id: string; cantidad_cajas: number }
  | { type: 'BULK_CREATE_PALLETS'; pallets: Array<{ id: string; cliente_carga_id: string; cantidad_cajas: number }> }
  // Carga ops — payload incluye `id` ya generado para que el INSERT remoto
  // use el mismo UUID que cacheamos localmente.
  | { type: 'CREATE_CARGA';    payload: Record<string, unknown>; localId: string }
  | { type: 'DELETE_CARGA';    cargaId: string }
  | { type: 'AVANZAR_ESTADO';  cargaId: string;    nuevoEstado: string; hora?: string }
  | { type: 'LLEGADA_CAMION';  cargaId: string; hora?: string }
  | { type: 'GUARDAR_NOTA';    cargaId: string;    nota: string }
  // Cliente ops
  | { type: 'ADD_CLIENTE';     payload: Record<string, unknown>; localId: string }
  | { type: 'DELETE_CLIENTE';  clienteId: string }
  | { type: 'UPDATE_HOJA_RUTA'; clienteId: string; pallets_hoja_ruta: number | null; cajas_hoja_ruta: number | null }
  // Incidencia / nota — `id` y `hora` se generan al encolar para preservar
  // el orden y la hora real en la que el usuario registró la incidencia.
  | { type: 'ADD_INCIDENCIA';  cargaId: string; tipo: string; descripcion: string; localId: string; hora: string }

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function enqueueOp(op: OfflineOp): void {
  const id = genId()
  try {
    dbEnqueueOp(id, op.type, op)
  } catch {
    // SQLite not available (web) — silently skip queuing
  }
}

export function getQueue(): Array<{ id: string; op: OfflineOp }> {
  try {
    return dbGetQueue<OfflineOp>()
  } catch {
    return []
  }
}

export function removeOp(id: string): void {
  try {
    dbRemoveOp(id)
  } catch {
    // ignore
  }
}

export function clearQueue(): void {
  try {
    dbClearQueue()
  } catch {
    // ignore
  }
}

export function getPendingCount(): number {
  try {
    return dbGetQueueCount()
  } catch {
    return 0
  }
}

/**
 * Conjunto de IDs de cargas que tienen al menos una operación pendiente
 * (creación, edición, finalización, etc.). Sirve para mostrar un badge
 * "pendiente de sincronizar" en la UI.
 */
export function getPendingCargaIds(): Set<string> {
  const ids = new Set<string>()
  for (const { op } of getQueue()) {
    switch (op.type) {
      case 'CREATE_CARGA':
        ids.add(op.localId)
        break
      case 'DELETE_CARGA':
      case 'AVANZAR_ESTADO':
      case 'LLEGADA_CAMION':
      case 'GUARDAR_NOTA':
        ids.add(op.cargaId)
        break
      case 'ADD_INCIDENCIA':
        ids.add(op.cargaId)
        break
      default:
        break
    }
  }
  return ids
}
