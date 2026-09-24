import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  /** True until the initial session (incl. one coming from a magic link) is resolved. */
  isLoading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For components rendered only inside protected routes. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser must be used inside a protected route')
  return user
}
