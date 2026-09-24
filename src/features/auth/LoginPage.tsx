import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { useAuth } from './AuthContext'
import { getPendingInvite, postLoginPath } from './pendingInvite'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string }

export function LoginPage() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const hasInvite = getPendingInvite() !== null

  if (isLoading) return <FullScreenLoader />
  if (user) {
    // Signed in (possibly in another tab via the magic link) — move on.
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={hasInvite ? postLoginPath() : (from ?? '/')} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus({ kind: 'sending' })
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    if (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error, 'Could not send the link. Please try again.') })
    } else {
      setStatus({ kind: 'sent', email: trimmed })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="mb-4 text-6xl">🥟🍷🐈</div>
        <h1 className="text-3xl font-black tracking-tight">Trip Counter</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {hasInvite ? 'Sign in to join your friends’ trip' : 'Count the important stuff. Together.'}
        </p>
      </div>

      {status.kind === 'sent' ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <div className="mb-3 text-5xl">📬</div>
          <p className="text-xl font-extrabold">Check your email — we sent you a login link</p>
          <p className="mt-2 text-ink-soft">
            Sent to <span className="font-bold text-ink">{status.email}</span>. Open it on this device.
          </p>
          <button
            type="button"
            className="mt-5 font-bold text-accent"
            onClick={() => setStatus({ kind: 'idle' })}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-card" noValidate>
          <label htmlFor="email" className="mb-2 block text-sm font-bold text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            disabled={status.kind === 'sending'}
          />
          {status.kind === 'error' && (
            <p role="alert" className="mt-3 font-semibold text-danger">
              {status.message}
            </p>
          )}
          <Button type="submit" className="mt-5 w-full" size="lg" loading={status.kind === 'sending'} disabled={!email.trim()}>
            Send magic link
          </Button>
          <p className="mt-4 text-center text-sm text-ink-soft">No password needed — new here? Same button.</p>
        </form>
      )}
    </div>
  )
}
