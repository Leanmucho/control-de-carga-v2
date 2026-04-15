import { useEffect, useState, useCallback } from 'react'
import { getTurnoActivo, iniciarTurno, finalizarTurno } from '../lib/queries/turnos'
import type { Turno } from '../types/database'

export function useTurnoActivo() {
  const [turno, setTurno] = useState<Turno | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getTurnoActivo()
      setTurno(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar turno')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function iniciar(controladorId: string) {
    const t = await iniciarTurno(controladorId)
    setTurno(t)
    return t
  }

  async function finalizar(turnoId: string) {
    await finalizarTurno(turnoId)
    setTurno(null)
  }

  return { turno, loading, error, refresh, iniciar, finalizar }
}
