import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState } from '@/components/States'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { useAuth } from '@/features/auth/AuthContext'
import { clearPendingInvite, isValidToken, savePendingInvite } from '@/features/auth/pendingInvite'
import { getErrorMessage } from '@/lib/errors'
import { plural } from '@/lib/dates'
import { useAcceptInvite, useInvitePreview } from './api'

const INVALID_COPY = {
  invalid: 'This invite link doesn’t exist.',
  revoked: 'This invite link was reset by the trip owner.',
  expired: 'This invite link has expired.',
} as const

export function JoinPage() {
  const { token = '' } = useParams()
  if (!isValidToken(token)) return <InvalidInvite reason="This invite link is broken." />
  return <JoinInvite token={token} />
}

function JoinInvite({ token }: { token: string }) {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const preview = useInvitePreview(token)
  const accept = useAcceptInvite()

  // Remember the invite so /auth/callback can bring the user back here.
  useEffect(() => {
    if (!isLoading && !user) savePendingInvite(token)
  }, [isLoading, user, token])

  if (isLoading || preview.isPending) return <FullScreenLoader />
  if (preview.isError)
    return (
      <Centered>
        <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
      </Centered>
    )

  const data = preview.data
  if (!data || data.status !== 'valid' || !data.trip_id) {
    const reason = data && data.status !== 'valid' ? INVALID_COPY[data.status] : INVALID_COPY.invalid
    return <InvalidInvite reason={reason} onSeen={clearPendingInvite} />
  }

  if (user && data.is_member) {
    clearPendingInvite()
    return <Navigate to={`/trips/${data.trip_id}`} replace />
  }

  async function handleJoin() {
    try {
      const tripId = await accept.mutateAsync(token)
      clearPendingInvite()
      toast.success(`Welcome to ${data!.trip_name}! 🎉`)
      navigate(`/trips/${tripId}`, { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not join the trip.'))
      void preview.refetch()
    }
  }

  return (
    <Centered>
      <div className="card px-6 py-10 text-center">
        <p className="text-lg font-bold text-ink-soft">You’re invited to</p>
        <div className="mt-4 text-7xl">{data.trip_emoji}</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{data.trip_name}</h1>
        <p className="mt-1 text-lg font-semibold text-ink-soft">{plural(data.member_count ?? 0, 'member', 'members')}</p>

        {user ? (
          <Button size="lg" className="mt-8 w-full" loading={accept.isPending} onClick={() => void handleJoin()}>
            Join trip
          </Button>
        ) : (
          <>
            <Link to="/login" className="btn btn-primary btn-lg mt-8 w-full">
              Sign in to join
            </Link>
            <p className="mt-3 text-sm text-ink-soft">We’ll email you a magic link — no password.</p>
          </>
        )}
      </div>
    </Centered>
  )
}

function InvalidInvite({ reason, onSeen }: { reason: string; onSeen?: () => void }) {
  useEffect(() => onSeen?.(), [onSeen])
  return (
    <Centered>
      <EmptyState
        emoji="🥲"
        title="Invite not valid"
        action={
          <Link to="/" className="btn btn-primary">
            Go to my trips
          </Link>
        }
      >
        {reason} Ask a friend for a fresh link.
      </EmptyState>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col justify-center py-10">{children}</div>
}

