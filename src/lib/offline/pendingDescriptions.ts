import type { OfflineOp } from './queue'

export function describeOfflineOp(op: OfflineOp): { title: string; detail: string } {
  switch (op.type) {
    case 'CREATE_CARGA':
      return { title: 'Crear carga', detail: String(op.payload.chofer ?? op.localId) }
    case 'DELETE_CARGA':
      return { title: 'Eliminar carga', detail: op.cargaId }
    case 'ADD_CLIENTE':
      return { title: 'Agregar cliente', detail: String(op.payload.nombre ?? op.localId) }
    case 'DELETE_CLIENTE':
      return { title: 'Eliminar cliente', detail: op.clienteId }
    case 'UPDATE_HOJA_RUTA':
      return { title: 'Actualizar hoja de ruta', detail: op.clienteId }
    case 'CREATE_PALLET':
      return { title: 'Crear pallet', detail: `${op.cantidad_cajas} cajas` }
    case 'BULK_CREATE_PALLETS':
      return { title: 'Crear pallets', detail: `${op.pallets.length} pallet(s)` }
    case 'CHECK_PALLET':
      return { title: 'Marcar pallet cargado', detail: op.palletId }
    case 'EDIT_PALLET':
      return { title: 'Editar cajas de pallet', detail: `${op.cantidad_cajas} cajas` }
    case 'DELETE_PALLET':
      return { title: 'Eliminar pallet', detail: op.palletId }
    case 'AVANZAR_ESTADO':
      return { title: 'Cambiar estado de carga', detail: op.nuevoEstado }
    case 'LLEGADA_CAMION':
      return { title: 'Registrar llegada de camión', detail: op.cargaId }
    case 'GUARDAR_NOTA':
      return { title: 'Guardar nota', detail: op.nota ? op.nota.slice(0, 50) : op.cargaId }
    case 'ADD_INCIDENCIA':
      return { title: 'Agregar incidencia', detail: `${op.tipo}: ${op.descripcion}` }
  }
}
