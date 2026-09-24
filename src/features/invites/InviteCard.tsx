import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { getErrorMessage } from '@/lib/errors'
import { inviteUrl, useResetInvite, useTripInvite } from './api'

type Props = { tripId: string; tripName: string; canReset: boolean }

export function InviteCard({ tripId, tripName, canReset }: Props) {
  const [requested, setRequested] = useState(false)
  const invite = useTripInvite(tripId, requested)
  const reset = useResetInvite(tripId)
  const url = invite.data ? inviteUrl(invite.data.token) : null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied — send it to your friends')
    } catch {
      toast.error('Could not copy. Long-press the link to copy it manually.')
    }
  }

  async function share() {
    if (!url) return
    try {
      await navigator.share({ title: `Join ${tripName}`, text: `Join “${tripName}” on Trip Counter`, url })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') void copy()
    }
  }

  async function handleReset() {
    if (!invite.data) return
    if (!window.confirm('Reset the link? The old link will stop working.')) return
    try {
      await reset.mutateAsync(invite.data.id)
      toast.success('New link created')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reset the link.'))
    }
  }

  if (!requested) {
    return (
      <Button size="lg" className="w-full" onClick={() => setRequested(true)}>
        💌 Invite friends
      </Button>
    )
  }

  return (
    <div className="card p-5">
      <p className="mb-3 text-lg font-extrabold">💌 Invite link</p>
      {invite.isPending ? (
        <div className="flex justify-center py-4 text-accent">
          <Spinner className="size-7" />
        </div>
      ) : invite.isError ? (
        <div className="text-center">
          <p className="font-semibold text-danger">{getErrorMessage(invite.error, 'Could not create an invite.')}</p>
          <Button variant="secondary" className="mt-3" onClick={() => void invite.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <p className="rounded-2xl bg-canvas px-4 py-3 font-mono text-sm break-all select-all">{url}</p>
          <p className="mt-2 text-sm text-ink-soft">Anyone with this link can join the trip.</p>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={() => void copy()}>
              Copy link
            </Button>
            {'share' in navigator && (
              <Button variant="secondary" className="flex-1" onClick={() => void share()}>
                Share…
              </Button>
            )}
          </div>
          {canReset && (
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={reset.isPending}
              className="mt-3 w-full text-sm font-bold text-ink-soft"
            >
              {reset.isPending ? 'Resetting…' : 'Reset link'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
