import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// En web usamos localStorage directamente — expo-secure-store no garantiza
// que sus Promises resuelvan en web, lo que cuelga signInWithPassword.
// En nativo usamos SecureStore con chunking para tokens JWT > 2048 chars.

const webStorage = {
  getItem: (key: string): Promise<string | null> => {
    try {
      return Promise.resolve(localStorage.getItem(key))
    } catch {
      return Promise.resolve(null)
    }
  },
  setItem: (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Ignorar errores de cuota
    }
    return Promise.resolve()
  },
  removeItem: (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignorar
    }
    return Promise.resolve()
  },
}

const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Intentar leer directo
      const direct = await SecureStore.getItemAsync(key)
      if (direct) return direct
      // Si fue guardado en chunks, reconstruir
      const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`)
      if (!chunksStr) return null
      const chunks = parseInt(chunksStr)
      let result = ''
      for (let i = 0; i < chunks; i++) {
        const part = await SecureStore.getItemAsync(`${key}_${i}`)
        result += part ?? ''
      }
      return result || null
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Valor muy largo — guardar en chunks de 1800 chars
      const chunks = Math.ceil(value.length / 1800)
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunks))
      for (let i = 0; i < chunks; i++) {
        await SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * 1800, (i + 1) * 1800))
      }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // ignorar
    }
    // Limpiar chunks si existen
    try {
      const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`)
      if (chunksStr) {
        const chunks = parseInt(chunksStr)
        await SecureStore.deleteItemAsync(`${key}_chunks`)
        for (let i = 0; i < chunks; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`)
        }
      }
    } catch {
      // ignorar
    }
  },
}

const storage = Platform.OS === 'web' ? webStorage : nativeStorage

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
