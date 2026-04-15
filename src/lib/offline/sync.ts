import { getQueue, removeOp } from './queue'
import { checkPallet, editPallet, deletePallet } from '../queries/pallets'
import { guardarNota } from '../queries/cargas'
import { addIncidencia } from '../queries/incidencias'

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const op of queue) {
    try {
      switch (op.type) {
        case 'CHECK_PALLET':
          await checkPallet(op.palletId)
          break
        case 'ADD_NOTE':
          await guardarNota(op.cargaId, op.nota)
          break
        case 'ADD_INCIDENCIA':
          await addIncidencia({ carga_id: op.cargaId, tipo: op.tipo, descripcion: op.descripcion })
          break
        case 'EDIT_PALLET':
          await editPallet(op.palletId, op.cantidad_cajas)
          break
        case 'DELETE_PALLET':
          await deletePallet(op.palletId)
          break
      }
      await removeOp(op.timestamp)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
