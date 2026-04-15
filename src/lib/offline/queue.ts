import * as SecureStore from 'expo-secure-store'

const QUEUE_KEY = 'offline_queue'

export type OfflineOp =
  | { type: 'CHECK_PALLET';   palletId: string;   timestamp: number }
  | { type: 'ADD_NOTE';       cargaId: string;    nota: string;        timestamp: number }
  | { type: 'ADD_INCIDENCIA'; cargaId: string;    tipo: string;        descripcion: string; timestamp: number }
  | { type: 'EDIT_PALLET';    palletId: string;   cantidad_cajas: number; timestamp: number }
  | { type: 'DELETE_PALLET';  palletId: string;   timestamp: number }

export async function enqueueOp(op: OfflineOp): Promise<void> {
  const current = await getQueue()
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify([...current, op]))
}

export async function getQueue(): Promise<OfflineOp[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function clearQueue(): Promise<void> {
  await SecureStore.deleteItemAsync(QUEUE_KEY)
}

export async function removeOp(timestamp: number): Promise<void> {
  const current = await getQueue()
  const filtered = current.filter(op => op.timestamp !== timestamp)
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(filtered))
}
