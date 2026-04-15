import { useEffect, useState, useCallback } from 'react'
import { AppState, AppStateStatus, Platform } from 'react-native'
import { syncOfflineQueue } from '../lib/offline/sync'

async function checkOnline(): Promise<boolean> {
  // navigator.onLine es suficiente en web y evita errores de CORS
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }
  try {
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-cache',
    })
    return res.status === 204 || res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  const refresh = useCallback(async () => {
    const online = await checkOnline()
    setIsOnline(prev => {
      if (!prev && online) {
        // Volvimos a tener conexión — sincronizar cola offline
        syncOfflineQueue().catch(() => {})
      }
      return online
    })
  }, [])

  useEffect(() => {
    refresh()

    // Chequear cuando la app vuelve al primer plano
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh()
    })

    // Chequear cada 30 segundos
    const interval = setInterval(refresh, 30_000)

    return () => {
      sub.remove()
      clearInterval(interval)
    }
  }, [refresh])

  return { isOnline }
}
