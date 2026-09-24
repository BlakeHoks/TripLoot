import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/Button'
import { ErrorState, LoadingState } from '@/components/States'
import { useUser } from '@/features/auth/AuthContext'
import { InviteCard } from '@/features/invites/InviteCard'
import { useDeleteTrip, useTrip } from '@/features/trips/api'
import { TripSettingsCard } from '@/features/trips/TripSettingsCard'
import { displayName } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { useMembers, useRemoveMember, type Member } from './api'

export function MembersPage() {
  const { tripId = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const removeMember = useRemoveMember(tripId)
  const deleteTrip = useDeleteTrip(tripId)
  const isOwner = trip.data?.owner_id === user.id

  async function handleRemove(member: Member) {
    const self = member.user_id === user.id
    const question = self ? 'Leave this trip?' : `Remove ${displayName(member.profile)} from the trip?`
    if (!window.confirm(question)) return
    try {
      await removeMember.mutateAsync(member.user_id)
      if (self) {
        toast.success('You left the trip')
        navigate('/', { replace: true })
      } else {
        toast.success('Member removed')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove the member.'))
    }
  }

  async function handleDeleteTrip() {
    if (!trip.data) return
    if (!window.confirm(`Delete “${trip.data.name}” for everyone? This cannot be undone.`)) return
    try {
      await deleteTrip.mutateAsync()
      toast.success('Trip deleted')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete the trip.'))
    }
  }

  const back = `/trips/${tripId}`

  if (trip.isPending || members.isPending) return <LoadingState />
  if (trip.isError || members.isError || !trip.data) {
    return (
      <>
        <TopBar back={back} title="Members" />
        <ErrorState error={trip.error ?? members.error ?? { code: 'PGRST116' }} onRetry={() => void members.refetch()} />
      </>
    )
  }

  const me = members.data.find((m) => m.user_id === user.id)

  return (
    <div className="space-y-6 pb-10">
      <TopBar back={back} title={`${trip.data.emoji} ${trip.data.name}`} />

      <section>
        <h1 className="mb-3 px-1 text-3xl font-black">Members</h1>
        <ul className="card divide-y divide-line">
          {members.data.map((member) => {
            const name = displayName(member.profile)
            const canRemove = isOwner && member.role !== 'owner'
            return (
              <li key={member.user_id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-lg font-black text-accent-strong">
                  {member.role === 'owner' ? '👑' : name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold">
                    {name}
                    {member.user_id === user.id && <span className="font-semibold text-ink-soft"> (you)</span>}
                  </span>
                  <span className="block font-semibold text-ink-soft">{member.role === 'owner' ? 'Owner' : 'Member'}</span>
                </span>
                {canRemove && (
                  <Button variant="ghost" size="sm" className="text-ink-soft" onClick={() => void handleRemove(member)}>
                    Remove
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <InviteCard tripId={tripId} tripName={trip.data.name} canReset={isOwner} />

      {isOwner && <TripSettingsCard trip={trip.data} />}

      <div className="pt-2">
        {isOwner ? (
          <Button variant="danger" className="w-full" loading={deleteTrip.isPending} onClick={() => void handleDeleteTrip()}>
            Delete trip
          </Button>
        ) : (
          me && (
            <Button variant="danger" className="w-full" loading={removeMember.isPending} onClick={() => void handleRemove(me)}>
              Leave trip
            </Button>
          )
        )}
      </div>
    </div>
  )
}
