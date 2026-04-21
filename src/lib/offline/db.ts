import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
import type { Turno, Carga, ClienteCarga, Pallet, Incidencia } from '../../types/database'

// SQLite is only available on native (Android/iOS). All functions are no-ops on web.
const IS_NATIVE = Platform.OS !== 'web'

let _db: SQLite.SQLiteDatabase | null = null

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('controlcarga.db')
  return _db
}

export function initDb(): void {
  if (!IS_NATIVE) return
  const db = getDb()
  db.execSync(`PRAGMA journal_mode = WAL;`)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      op_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS turnos (
      id TEXT PRIMARY KEY,
      controlador_id TEXT,
      fecha_inicio TEXT,
      fecha_fin TEXT,
      activo INTEGER,
      created_at TEXT,
      raw TEXT
    );
    CREATE TABLE IF NOT EXISTS cargas (
      id TEXT PRIMARY KEY,
      turno_id TEXT,
      chofer TEXT,
      transporte TEXT,
      numero_remito TEXT,
      clarkista_nombre TEXT,
      estado TEXT,
      hora_llegada_camion TEXT,
      hora_inicio_carga TEXT,
      hora_fin_carga TEXT,
      notas TEXT,
      created_at TEXT,
      raw TEXT
    );
    CREATE TABLE IF NOT EXISTS clientes_carga (
      id TEXT PRIMARY KEY,
      carga_id TEXT,
      nombre TEXT,
      orden INTEGER,
      pallets_hoja_ruta INTEGER,
      cajas_hoja_ruta INTEGER
    );
    CREATE TABLE IF NOT EXISTS pallets (
      id TEXT PRIMARY KEY,
      cliente_carga_id TEXT,
      cantidad_cajas INTEGER,
      estado TEXT,
      hora_carga TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS incidencias (
      id TEXT PRIMARY KEY,
      carga_id TEXT,
      tipo TEXT,
      descripcion TEXT,
      hora TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cargas_turno ON cargas(turno_id);
    CREATE INDEX IF NOT EXISTS idx_clientes_carga ON clientes_carga(carga_id);
    CREATE INDEX IF NOT EXISTS idx_pallets_cliente ON pallets(cliente_carga_id);
    CREATE INDEX IF NOT EXISTS idx_incidencias_carga ON incidencias(carga_id);
  `)
}

// ─── Offline queue ────────────────────────────────────────────────────────────

export function dbEnqueueOp(id: string, opType: string, payload: unknown): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `INSERT INTO offline_queue (id, op_type, payload, created_at) VALUES (?,?,?,?)`,
    [id, opType, JSON.stringify(payload), Date.now()]
  )
}

export function dbGetQueue<T = unknown>(): Array<{ id: string; op: T }> {
  if (!IS_NATIVE) return []
  const rows = getDb().getAllSync<{ id: string; op_type: string; payload: string }>(
    `SELECT id, op_type, payload FROM offline_queue ORDER BY created_at ASC`
  )
  return rows.map(r => ({
    id: r.id,
    op: { ...JSON.parse(r.payload), type: r.op_type } as T,
  }))
}

export function dbRemoveOp(id: string): void {
  if (!IS_NATIVE) return
  getDb().runSync(`DELETE FROM offline_queue WHERE id = ?`, [id])
}

export function dbClearQueue(): void {
  if (!IS_NATIVE) return
  getDb().runSync(`DELETE FROM offline_queue`)
}

export function dbGetQueueCount(): number {
  if (!IS_NATIVE) return 0
  const row = getDb().getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM offline_queue`)
  return row?.n ?? 0
}

// ─── Turno ────────────────────────────────────────────────────────────────────

export function cacheTurno(t: Turno | null): void {
  if (!IS_NATIVE) return
  const db = getDb()
  db.runSync(`DELETE FROM turnos WHERE activo = 1`)
  if (!t) return
  db.runSync(
    `INSERT OR REPLACE INTO turnos VALUES (?,?,?,?,?,?,?)`,
    [t.id, t.controlador_id, t.fecha_inicio, t.fecha_fin ?? null,
     t.activo ? 1 : 0, t.created_at, JSON.stringify(t)]
  )
}

export function getCachedTurnoActivo(): Turno | null {
  if (!IS_NATIVE) return null
  const row = getDb().getFirstSync<{ raw: string }>(
    `SELECT raw FROM turnos WHERE activo = 1 LIMIT 1`
  )
  return row ? JSON.parse(row.raw) : null
}

// ─── Cargas ───────────────────────────────────────────────────────────────────

export function cacheCargas(cargas: Carga[]): void {
  if (!IS_NATIVE || cargas.length === 0) return
  const db = getDb()
  const turnoId = cargas[0].turno_id
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM cargas WHERE turno_id = ?`, [turnoId])
    for (const c of cargas) {
      db.runSync(
        `INSERT OR REPLACE INTO cargas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [c.id, c.turno_id, c.chofer, c.transporte, c.numero_remito ?? null,
         c.clarkista_nombre ?? null, c.estado,
         c.hora_llegada_camion ?? null, c.hora_inicio_carga ?? null,
         c.hora_fin_carga ?? null, c.notas ?? null, c.created_at, JSON.stringify(c)]
      )
      for (const cl of c.clientes_carga ?? []) {
        db.runSync(
          `INSERT OR REPLACE INTO clientes_carga VALUES (?,?,?,?,?,?)`,
          [cl.id, cl.carga_id, cl.nombre, cl.orden,
           cl.pallets_hoja_ruta ?? null, cl.cajas_hoja_ruta ?? null]
        )
        for (const p of cl.pallets ?? []) {
          db.runSync(
            `INSERT OR REPLACE INTO pallets VALUES (?,?,?,?,?,?)`,
            [p.id, p.cliente_carga_id, p.cantidad_cajas, p.estado,
             p.hora_carga ?? null, p.created_at]
          )
        }
      }
      for (const inc of c.incidencias ?? []) {
        db.runSync(
          `INSERT OR REPLACE INTO incidencias VALUES (?,?,?,?,?)`,
          [inc.id, inc.carga_id, inc.tipo, inc.descripcion, inc.hora]
        )
      }
    }
  })
}

export function cacheCarga(c: Carga): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `INSERT OR REPLACE INTO cargas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [c.id, c.turno_id, c.chofer, c.transporte, c.numero_remito ?? null,
     c.clarkista_nombre ?? null, c.estado,
     c.hora_llegada_camion ?? null, c.hora_inicio_carga ?? null,
     c.hora_fin_carga ?? null, c.notas ?? null, c.created_at, JSON.stringify(c)]
  )
}

export function getCachedCargas(turnoId: string): Carga[] {
  if (!IS_NATIVE) return []
  const rows = getDb().getAllSync<{ raw: string }>(
    `SELECT raw FROM cargas WHERE turno_id = ? ORDER BY created_at DESC`,
    [turnoId]
  )
  return rows.map(r => JSON.parse(r.raw))
}

export function getCachedCarga(id: string): Carga | null {
  if (!IS_NATIVE) return null
  const db = getDb()
  const row = db.getFirstSync<{ raw: string }>(
    `SELECT raw FROM cargas WHERE id = ?`, [id]
  )
  if (!row) return null
  const c: Carga = JSON.parse(row.raw)

  const clientes = db.getAllSync<ClienteCarga>(
    `SELECT * FROM clientes_carga WHERE carga_id = ? ORDER BY orden`, [id]
  )
  c.clientes_carga = clientes.map(cl => ({
    ...cl,
    pallets: db.getAllSync<Pallet>(
      `SELECT * FROM pallets WHERE cliente_carga_id = ?`, [cl.id]
    ),
  }))
  c.incidencias = db.getAllSync<Incidencia>(
    `SELECT * FROM incidencias WHERE carga_id = ?`, [id]
  )
  return c
}

export function deleteCachedCarga(id: string): void {
  if (!IS_NATIVE) return
  const db = getDb()
  db.withTransactionSync(() => {
    const clientes = db.getAllSync<{ id: string }>(
      `SELECT id FROM clientes_carga WHERE carga_id = ?`, [id]
    )
    for (const cl of clientes) {
      db.runSync(`DELETE FROM pallets WHERE cliente_carga_id = ?`, [cl.id])
    }
    db.runSync(`DELETE FROM clientes_carga WHERE carga_id = ?`, [id])
    db.runSync(`DELETE FROM incidencias WHERE carga_id = ?`, [id])
    db.runSync(`DELETE FROM cargas WHERE id = ?`, [id])
  })
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export function cacheCliente(cl: ClienteCarga): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `INSERT OR REPLACE INTO clientes_carga VALUES (?,?,?,?,?,?)`,
    [cl.id, cl.carga_id, cl.nombre, cl.orden,
     cl.pallets_hoja_ruta ?? null, cl.cajas_hoja_ruta ?? null]
  )
}

export function deleteCachedCliente(id: string): void {
  if (!IS_NATIVE) return
  const db = getDb()
  db.runSync(`DELETE FROM pallets WHERE cliente_carga_id = ?`, [id])
  db.runSync(`DELETE FROM clientes_carga WHERE id = ?`, [id])
}

// ─── Pallets ──────────────────────────────────────────────────────────────────

export function cachePallet(p: Pallet): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `INSERT OR REPLACE INTO pallets VALUES (?,?,?,?,?,?)`,
    [p.id, p.cliente_carga_id, p.cantidad_cajas, p.estado,
     p.hora_carga ?? null, p.created_at]
  )
}

export function updateCachedPalletEstado(palletId: string): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `UPDATE pallets SET estado = 'cargado', hora_carga = ? WHERE id = ?`,
    [new Date().toISOString(), palletId]
  )
}

export function updateCachedPalletCajas(palletId: string, cantidad_cajas: number): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `UPDATE pallets SET cantidad_cajas = ? WHERE id = ?`,
    [cantidad_cajas, palletId]
  )
}

export function deleteCachedPallet(palletId: string): void {
  if (!IS_NATIVE) return
  getDb().runSync(`DELETE FROM pallets WHERE id = ?`, [palletId])
}

// ─── Incidencias ──────────────────────────────────────────────────────────────

export function cacheIncidencia(inc: Incidencia): void {
  if (!IS_NATIVE) return
  getDb().runSync(
    `INSERT OR REPLACE INTO incidencias VALUES (?,?,?,?,?)`,
    [inc.id, inc.carga_id, inc.tipo, inc.descripcion, inc.hora]
  )
}
