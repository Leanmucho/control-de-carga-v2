import { useEffect, useState, useCallback } from 'react'
import { getTurnoActivo, iniciarTurno, finalizarTurno } from '../lib/queries/turnos'
import { cacheTurno, getCachedTurnoActivo } from '../lib/offline/db'
import type { Turno } from '../types/database'

export function useTurnoActivo() {
  const [turno, setTurno] = useState<Turno | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getTurnoActivo()
      setTurno(data)
      cacheTurno(data)
      setError(null)
    } catch (e: unknown) {
      // Sin conexión: leer del cache
      const cached = getCachedTurnoActivo()
      setTurno(cached)
      if (!cached) {
        setError(e instanceof Error ? e.message : 'Error al cargar turno')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function iniciar(controladorId: string) {
    const t = await iniciarTurno(controladorId)
    setTurno(t)
    cacheTurno(t)
    return t
  }

  async function finalizar(turnoId: string) {
    await finalizarTurno(turnoId)
    setTurno(null)
    cacheTurno(null)
  }

  return { turno, loading, error, refresh, iniciar, finalizar }
}
