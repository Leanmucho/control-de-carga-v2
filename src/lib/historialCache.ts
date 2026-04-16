/**
 * historialCache.ts
 * Cache local del historial de cargas para soporte offline completo.
 * Guarda en AsyncStorage por usuario.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Carga } from '../types/database'

function cacheKey(userId: string) { return `historial_cargas_${userId}` }
function syncKey(userId: string)  { return `historial_sync_${userId}` }

// ── Persistencia ─────────────────────────────────────────────────────────────

export async function saveHistorialCache(userId: string, cargas: Carga[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(cargas))
  await AsyncStorage.setItem(syncKey(userId), new Date().toISOString())
}

export async function loadHistorialCache(userId: string): Promise<Carga[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function getLastSync(userId: string): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(syncKey(userId))
    return raw ? new Date(raw) : null
  } catch {
    return null
  }
}

// ── Filtros locales (sin red) ─────────────────────────────────────────────────

export interface FiltrosHistorial {
  chofer?: string
  transporte?: string
  fecha?: string   // formato DD/MM/YYYY
  cliente?: string
}

export function filtrarCargas(cargas: Carga[], filtros: FiltrosHistorial): Carga[] {
  return cargas.filter(c => {
    if (filtros.chofer?.trim()) {
      if (!c.chofer.toLowerCase().includes(filtros.chofer.trim().toLowerCase())) return false
    }
    if (filtros.transporte?.trim()) {
      if (!c.transporte.toLowerCase().includes(filtros.transporte.trim().toLowerCase())) return false
    }
    if (filtros.fecha?.trim()) {
      const iso = parseFechaFiltro(filtros.fecha.trim())
      if (iso && c.created_at.substring(0, 10) !== iso) return false
    }
    if (filtros.cliente?.trim()) {
      const hayCliente = c.clientes_carga?.some(cl =>
        cl.nombre.toLowerCase().includes(filtros.cliente!.trim().toLowerCase())
      )
      if (!hayCliente) return false
    }
    return true
  })
}

/** Convierte DD/MM/YYYY → YYYY-MM-DD. Devuelve null si el formato es inválido. */
function parseFechaFiltro(fecha: string): string | null {
  const parts = fecha.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null
  return `${y}-${m}-${d}`
}

// ── Agrupado por día ──────────────────────────────────────────────────────────

export interface DiaCargas {
  iso: string     // YYYY-MM-DD
  titulo: string  // "Miércoles 16 de abril de 2026"
  cargas: Carga[]
}

export function agruparPorDia(cargas: Carga[]): DiaCargas[] {
  const map = new Map<string, Carga[]>()

  for (const c of cargas) {
    const dia = c.created_at.substring(0, 10)
    if (!map.has(dia)) map.set(dia, [])
    map.get(dia)!.push(c)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // más reciente primero
    .map(([iso, items]) => ({
      iso,
      titulo: formatearDia(iso),
      cargas: items,
    }))
}

function formatearDia(iso: string): string {
  // iso = YYYY-MM-DD → parseamos con hora al mediodía para evitar off-by-one de timezone
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
