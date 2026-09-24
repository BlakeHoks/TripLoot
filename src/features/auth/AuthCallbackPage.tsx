import { Link, Navigate } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { useAuth } from './AuthContext'
import { postLoginPath } from './pendingInvite'

/** Supabase puts errors in the query string (PKCE) or in the hash (implicit flow). */
function readAuthError(): string | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = query.get('error_code') ?? hash.get('error_code')
  const description = query.get('error_description') ?? hash.get('error_description')
  if (!code && !description) return null
  if (code === 'otp_expired') return 'This login link has expired or was already used.'
  return description?.replace(/\+/g, ' ') ?? 'Login failed.'
}

export function AuthCallbackPage() {
  const { user, isLoading } = useAuth()

  // Wait until supabase-js has consumed the tokens/code from the URL.
  if (isLoading) return <FullScreenLoader label="Signing you in…" />

  if (user) return <Navigate to={postLoginPath()} replace />

  const error = readAuthError()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-6xl">🔗</div>
      <h1 className="text-2xl font-black">Couldn’t sign you in</h1>
      <p className="mt-2 max-w-xs text-ink-soft">
        {error ?? 'The login link is invalid or has expired.'} Request a new one — it only takes a second.
      </p>
      <Link to="/login" replace className="btn btn-primary btn-lg mt-6">
        Back to login
      </Link>
    </div>
  )
}
