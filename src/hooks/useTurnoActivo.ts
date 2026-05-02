import { useEffect, useState, useCallback } from 'react'
import { getTurnoActivo, iniciarTurno, finalizarTurno } from '../lib/queries/turnos'
import { cacheTurno, getCachedTurnoActivo } from '../lib/offline/db'
import { useNetworkStatus } from './useNetworkStatus'
import type { Turno } from '../types/database'

export function useTurnoActivo() {
  const { isOnline } = useNetworkStatus()
  const [turno, setTurno] = useState<Turno | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const refresh = useCallback(async () => {
    // 1) Hidratar siempre desde cache primero — la UI nunca queda sin turno
    //    mientras esperamos a Supabase (crítico en startup offline).
    const cached = getCachedTurnoActivo()
    if (cached) {
      setTurno(cached)
      setFromCache(true)
    }
    setLoading(false)

    // 2) Si estamos offline, NO consultamos Supabase. Confiamos 100% en cache.
    //    Esto evita que cualquier respuesta vacía/error borre el turno cacheado.
    if (!isOnline) {
      return
    }

    try {
      const data = await getTurnoActivo()
      // Solo confiamos en `data` cuando el fetch fue exitoso.
      // Si el server dice "no hay turno", recién ahí limpiamos el cache.
      setTurno(data)
      cacheTurno(data)
      setFromCache(false)
      setError(null)
    } catch (e: unknown) {
      // Sin conexión / error de red: mantener lo que ya esté en cache.
      // NO sobreescribir con null — eso es lo que rompía la app offline.
      const fallback = cached ?? getCachedTurnoActivo()
      setTurno(fallback)
      setFromCache(!!fallback)
      if (!fallback) {
        setError(e instanceof Error ? e.message : 'Error al cargar turno')
      }
    }
  }, [isOnline])

  useEffect(() => { refresh() }, [refresh])

  async function iniciar(controladorId: string) {
    const t = await iniciarTurno(controladorId)
    setTurno(t)
    cacheTurno(t)
    setFromCache(false)
    return t
  }

  async function finalizar(turnoId: string) {
    await finalizarTurno(turnoId)
    setTurno(null)
    cacheTurno(null)
    setFromCache(false)
  }

  return { turno, loading, error, refresh, iniciar, finalizar, fromCache }
}
