import type { Turno, Carga, ClienteCarga, Pallet, Incidencia } from '../../types/database'

export function initDb(): void {}
export function dbEnqueueOp(_id: string, _opType: string, _payload: unknown): void {}
export function dbGetQueue<T = unknown>(): Array<{ id: string; op: T }> { return [] }
export function dbRemoveOp(_id: string): void {}
export function dbClearQueue(): void {}
export function dbGetQueueCount(): number { return 0 }
export function cacheTurno(_t: Turno | null): void {}
export function getCachedTurnoActivo(): Turno | null { return null }
export function cacheCargas(_cargas: Carga[], _preserveIds?: Set<string>): void {}
export function cacheCarga(_c: Carga): void {}
export function getCachedCargas(_turnoId: string): Carga[] { return [] }
export function getCachedCarga(_id: string): Carga | null { return null }
export function deleteCachedCarga(_id: string): void {}
export function cacheCliente(_cl: ClienteCarga): void {}
export function deleteCachedCliente(_id: string): void {}
export function cachePallet(_p: Pallet): void {}
export function getCachedPallets(_clienteCargaId: string): Pallet[] { return [] }
export function updateCachedPalletEstado(_palletId: string): void {}
export function updateCachedPalletCajas(_palletId: string, _cantidad_cajas: number): void {}
export function deleteCachedPallet(_palletId: string): void {}
export function cacheIncidencia(_inc: Incidencia): void {}
