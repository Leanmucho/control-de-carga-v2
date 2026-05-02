import { useEffect, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { isNetworkReachable } from '../lib/network'

// ─── Singleton store ──────────────────────────────────────────────────────────
// Antes cada componente que usaba `useNetworkStatus` tenía su propio interval
// de 30s y su propio listener de AppState. Eso significaba que al volver la red
// se disparaban N `syncOfflineQueue()` en paralelo — y como antes no había
// lock, cada op se ejecutaba varias veces (pallets duplicados, etc).
// Ahora hay un único poller y un único set de listeners global. Cada hook
// solo se suscribe a cambios.

type Listener = (online: boolean) => void
let _isOnline = true
let _listeners: Set<Listener> | null = null
let _initialized = false
let _checking = false

async function refreshStatus() {
  if (_checking) return
  _checking = true
  try {
    const online = await isNetworkReachable()
    if (online === _isOnline) return
    _isOnline = online
    _listeners?.forEach(l => l(online))
    // NOTA: el drenado de la cola NO se dispara al reconectar.
    // La sincronización ocurre solo al cerrar el turno (ver app/(main)/turno/index.tsx)
    // para evitar carreras y dobles inserts mientras el operador sigue cargando.
  } finally {
    _checking = false
  }
}

function ensureInitialized() {
  if (_initialized) return
  _initialized = true
  _listeners = new Set()

  // Chequeo inicial
  refreshStatus()

  // Cuando la app vuelve al primer plano
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') refreshStatus()
  })

  // Polling periódico — un solo timer global
  setInterval(refreshStatus, 30_000)
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(_isOnline)

  useEffect(() => {
    ensureInitialized()
    const listener: Listener = (online) => setIsOnline(online)
    _listeners?.add(listener)
    // Sincronizar al montar por si el valor cambió antes de subscribirse
    setIsOnline(_isOnline)
    return () => { _listeners?.delete(listener) }
  }, [])

  return { isOnline }
}
