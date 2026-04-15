import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// SecureStore tiene límite de 2048 chars por key — para tokens JWT grandes usamos chunks
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Si el valor es muy largo para SecureStore, lo guardamos en partes
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
      // Limpiar chunks si existen
      const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`)
      if (chunksStr) {
        const chunks = parseInt(chunksStr)
        await SecureStore.deleteItemAsync(`${key}_chunks`)
        for (let i = 0; i < chunks; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`)
        }
      }
    }
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
