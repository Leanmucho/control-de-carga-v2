import { dbEnqueueOp, dbGetQueue, dbRemoveOp, dbClearQueue, dbGetQueueCount } from './db'

export type OfflineOp =
  // Pallet ops
  | { type: 'CHECK_PALLET';    palletId: string }
  | { type: 'EDIT_PALLET';     palletId: string;   cantidad_cajas: number }
  | { type: 'DELETE_PALLET';   palletId: string }
  // Carga ops
  | { type: 'CREATE_CARGA';    payload: Record<string, unknown>; localId: string }
  | { type: 'DELETE_CARGA';    cargaId: string }
  | { type: 'AVANZAR_ESTADO';  cargaId: string;    nuevoEstado: string }
  | { type: 'LLEGADA_CAMION';  cargaId: string }
  | { type: 'GUARDAR_NOTA';    cargaId: string;    nota: string }
  // Cliente ops
  | { type: 'ADD_CLIENTE';     payload: Record<string, unknown>; localId: string }
  | { type: 'DELETE_CLIENTE';  clienteId: string }
  | { type: 'UPDATE_HOJA_RUTA'; clienteId: string; pallets_hoja_ruta: number | null; cajas_hoja_ruta: number | null }
  // Incidencia / nota
  | { type: 'ADD_INCIDENCIA';  cargaId: string;    tipo: string; descripcion: string }

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
