import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import { Spinner } from '@/components/Spinner'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
const GIS_SRC = 'https://accounts.google.com/gsi/client'

type Props = { onError: (message: string) => void }

/**
 * With VITE_GOOGLE_CLIENT_ID set, uses Google Identity Services on our own
 * origin and hands the ID token to Supabase (signInWithIdToken), so Google's
 * dialog shows this site instead of <project-ref>.supabase.co.
 * Without it, falls back to the Supabase OAuth redirect.
 */
export function GoogleSignInButton({ onError }: Props) {
  return GOOGLE_CLIENT_ID ? (
    <GoogleIdentityButton clientId={GOOGLE_CLIENT_ID} onError={onError} />
  ) : (
    <GoogleRedirectButton onError={onError} />
  )
}

// ---------------------------------------------------------------------------
// Google Identity Services (preferred)
// ---------------------------------------------------------------------------

type CredentialResponse = { credential: string }

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        nonce?: string
        ux_mode?: 'popup' | 'redirect'
        use_fedcm_for_button?: boolean
        auto_select?: boolean
      }) => void
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: 'standard' | 'icon'
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'large' | 'medium' | 'small'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
          logo_alignment?: 'left' | 'center'
          width?: number
          locale?: string
        },
      ) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let gisPromise: Promise<GoogleIdentity> | null = null

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  gisPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.addEventListener('load', () =>
      window.google ? resolve(window.google) : reject(new Error('Google script failed')),
    )
    script.addEventListener('error', () => {
      gisPromise = null
      reject(new TypeError('Failed to fetch Google sign-in'))
    })
    document.head.appendChild(script)
  })
  return gisPromise
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function GoogleIdentityButton({ clientId, onError }: { clientId: string; onError: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'signing-in' | 'failed'>('loading')
  // Keep the latest callback without re-initialising Google on every render.
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const google = await loadGoogleIdentity()
        // Google receives the hashed nonce, Supabase the raw one, and verifies they match.
        const rawNonce = crypto.randomUUID()
        const hashedNonce = await sha256Hex(rawNonce)
        if (cancelled || !containerRef.current) return

        google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            setState('signing-in')
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: credential,
              nonce: rawNonce,
            })
            // On success onAuthStateChange sets the session and LoginPage redirects.
            if (error) {
              setState('ready')
              onErrorRef.current(getErrorMessage(error, 'Google sign-in failed. Please try again.'))
            }
          },
        })
        google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          locale: 'en',
          width: Math.min(400, Math.round(containerRef.current.clientWidth)),
        })
        setState('ready')
      } catch (error) {
        if (cancelled) return
        setState('failed')
        console.error('Google Identity Services failed to load', error)
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [clientId])

  // Blocked script (ad-blockers, strict privacy settings): offer the redirect flow instead.
  if (state === 'failed') return <GoogleRedirectButton onError={onError} />

  return (
    <div className="relative flex min-h-11 w-full items-center justify-center">
      <div ref={containerRef} className={`flex w-full justify-center ${state === 'ready' ? '' : 'invisible'}`} />
      {state !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 font-bold text-ink-soft">
          <Spinner className="size-5" />
          {state === 'signing-in' && 'Signing in…'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Supabase OAuth redirect (fallback)
// ---------------------------------------------------------------------------

function GoogleRedirectButton({ onError }: Props) {
  const [redirecting, setRedirecting] = useState(false)

  async function handleClick() {
    setRedirecting(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    // On success the browser is already navigating away.
    if (error) {
      setRedirecting(false)
      onError(getErrorMessage(error, 'Could not start Google sign-in.'))
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={redirecting}
      className="btn btn-lg w-full border-2 border-line bg-white px-4 text-base whitespace-nowrap text-ink hover:bg-stone-50"
    >
      {redirecting ? <Spinner className="size-5 text-ink-soft" /> : <GoogleLogo />}
      Continue with Google
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}
