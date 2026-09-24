import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    // getSession() waits for client initialisation, which includes parsing a
    // magic-link session out of the URL — so once it resolves we know the answer.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .catch((error: unknown) => console.error('Failed to restore session', error))
      .finally(() => {
        if (active) setIsLoading(false)
      })

    // Keep in sync with sign-in / sign-out / token refresh (also across tabs).
    // Don't call other supabase methods synchronously inside this callback.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setIsLoading(false)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, isLoading, signOut }),
    [session, isLoading, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
