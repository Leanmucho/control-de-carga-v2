import { getQueue, removeOp } from './queue'
import { checkPallet, editPallet, deletePallet } from '../queries/pallets'
import { guardarNota, avanzarEstado, registrarLlegadaCamion, eliminarCarga, crearCarga } from '../queries/cargas'
import { addIncidencia } from '../queries/incidencias'
import { addCliente, deleteCliente, updateClienteHojaRuta } from '../queries/clientes'
import type { EstadoCarga } from '../../constants/estados'
import type { OfflineOp } from './queue'

export interface SyncResult {
  synced: number
  failed: number
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const { id, op } of queue) {
    try {
      await executeOp(op)
      removeOp(id)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

async function executeOp(op: OfflineOp): Promise<void> {
  switch (op.type) {
    case 'CHECK_PALLET':
      await checkPallet(op.palletId)
      break
    case 'EDIT_PALLET':
      await editPallet(op.palletId, op.cantidad_cajas)
      break
    case 'DELETE_PALLET':
      await deletePallet(op.palletId)
      break
    case 'CREATE_CARGA':
      await crearCarga(op.payload as Parameters<typeof crearCarga>[0])
      break
    case 'DELETE_CARGA':
      await eliminarCarga(op.cargaId)
      break
    case 'AVANZAR_ESTADO':
      await avanzarEstado(op.cargaId, op.nuevoEstado as EstadoCarga)
      break
    case 'LLEGADA_CAMION':
      await registrarLlegadaCamion(op.cargaId)
      break
    case 'GUARDAR_NOTA':
      await guardarNota(op.cargaId, op.nota)
      break
    case 'ADD_CLIENTE':
      await addCliente(op.payload as Parameters<typeof addCliente>[0])
      break
    case 'DELETE_CLIENTE':
      await deleteCliente(op.clienteId)
      break
    case 'UPDATE_HOJA_RUTA':
      await updateClienteHojaRuta(op.clienteId, op.pallets_hoja_ruta, op.cajas_hoja_ruta)
      break
    case 'ADD_INCIDENCIA':
      await addIncidencia({ carga_id: op.cargaId, tipo: op.tipo, descripcion: op.descripcion })
      break
  }
}
