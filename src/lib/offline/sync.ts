import { getQueue, removeOp } from './queue'
import { checkPallet, editPallet, deletePallet, addPallet, bulkInsertPallets } from '../queries/pallets'
import { guardarNota, avanzarEstado, registrarLlegadaCamion, eliminarCarga, crearCarga } from '../queries/cargas'
import { addIncidencia } from '../queries/incidencias'
import { addCliente, deleteCliente, updateClienteHojaRuta } from '../queries/clientes'
import { isNetworkReachable } from '../network'
import type { EstadoCarga } from '../../constants/estados'
import type { OfflineOp } from './queue'

export interface SyncResult {
  synced: number
  failed: number
  skipped?: boolean
}

// Mutex global. Evita que varios consumidores de `useNetworkStatus` o el
// AppState listener disparen syncs en paralelo, lo que causaba que el mismo
// op se ejecutara dos veces (e.g. pallets duplicados al reconectar).
let _syncRunning: Promise<SyncResult> | null = null

export function syncOfflineQueue(): Promise<SyncResult> {
  if (_syncRunning) return _syncRunning
  _syncRunning = (async (): Promise<SyncResult> => {
    try {
      const queue = getQueue()
      if (queue.length === 0) return { synced: 0, failed: 0 }
      const online = await isNetworkReachable()
      if (!online) return { synced: 0, failed: 0, skipped: true }

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
    } finally {
      _syncRunning = null
    }
  })()
  return _syncRunning
}

async function executeOp(op: OfflineOp): Promise<void> {
  switch (op.type) {
    case 'CHECK_PALLET':
      await checkPallet(op.palletId, op.hora_carga)
      break
    case 'EDIT_PALLET':
      await editPallet(op.palletId, op.cantidad_cajas)
      break
    case 'DELETE_PALLET':
      await deletePallet(op.palletId)
      break
    case 'CREATE_PALLET':
      await addPallet({
        id: op.palletId,
        cliente_carga_id: op.cliente_carga_id,
        cantidad_cajas: op.cantidad_cajas,
      })
      break
    case 'BULK_CREATE_PALLETS':
      await bulkInsertPallets(op.pallets)
      break
    case 'CREATE_CARGA':
      // El payload ya incluye `id` (mismo UUID que se cacheó localmente).
      await crearCarga(op.payload as Parameters<typeof crearCarga>[0])
      break
    case 'DELETE_CARGA':
      await eliminarCarga(op.cargaId)
      break
    case 'AVANZAR_ESTADO':
      await avanzarEstado(op.cargaId, op.nuevoEstado as EstadoCarga, op.hora)
      break
    case 'LLEGADA_CAMION':
      await registrarLlegadaCamion(op.cargaId, op.hora)
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
      await addIncidencia({
        id: op.localId,
        carga_id: op.cargaId,
        tipo: op.tipo,
        descripcion: op.descripcion,
        hora: op.hora,
      })
      break
  }
}
