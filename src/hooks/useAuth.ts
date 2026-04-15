import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Perfil } from '../types/database'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[auth] iniciando...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[auth] getSession:', session ? 'sesión activa' : 'sin sesión')
      setSession(session)
      setLoading(false)
      if (session) fetchPerfil(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('[auth] onAuthStateChange:', _event, session ? 'con sesión' : 'sin sesión')
        setSession(session)
        setLoading(false)
        if (session) fetchPerfil(session.user.id)
        else setPerfil(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPerfil(userId: string) {
    console.log('[auth] fetchPerfil userId:', userId)
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single()
      console.log('[auth] perfil resultado:', data, error)
      setPerfil(data)
    } catch (e) {
      console.log('[auth] fetchPerfil excepción:', e)
    }
  }

  async function signIn(email: string, password: string) {
    console.log('[auth] signIn intentando con:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('[auth] signIn resultado data:', JSON.stringify(data))
    console.log('[auth] signIn resultado error:', JSON.stringify(error))
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, perfil, loading, signIn, signOut }
}
