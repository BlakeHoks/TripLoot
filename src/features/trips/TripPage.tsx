import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { useUser } from '@/features/auth/AuthContext'
import { useCounters } from '@/features/counters/api'
import { CounterCard } from '@/features/counters/CounterCard'
import { AddEventSheet } from '@/features/counters/AddEventSheet'
import { CounterFormSheet } from '@/features/counters/CounterFormSheet'
import { useAddEvent, useDeleteEvent } from '@/features/events/api'
import { ActivityFeed } from '@/features/events/ActivityFeed'
import { useMembers } from '@/features/members/api'
import { tripDayLabel } from '@/lib/dates'
import { displayName, formatAmount } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import type { CounterWithTotal } from '@/types/database'
import { useTrip } from './api'
import { useTripRealtime } from './useTripRealtime'

type SheetState =
  | { kind: 'closed' }
  | { kind: 'add'; counterId: string | null }
  | { kind: 'form'; counter: CounterWithTotal | null }

export function TripPage() {
  const { tripId = '' } = useParams()
  const user = useUser()
  const trip = useTrip(tripId)
  const counters = useCounters(tripId)
  const members = useMembers(tripId)
  const addEvent = useAddEvent(tripId)
  const deleteEvent = useDeleteEvent(tripId)
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })
  const closeSheet = useCallback(() => setSheet({ kind: 'closed' }), [])

  useTripRealtime(tripId)

  const isOwner = trip.data?.owner_id === user.id
  const names = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.user_id, displayName(m.profile)])),
    [members.data],
  )

  const canEdit = (counter: CounterWithTotal) => isOwner || counter.created_by === user.id

  function add(counter: CounterWithTotal, amount: number) {
    addEvent.mutate(
      { counterId: counter.id, amount, userId: user.id },
      {
        onSuccess: (event) => {
          toast.success(`${counter.emoji} +${formatAmount(amount)} ${counter.name}`, {
            id: `added-${counter.id}`,
            duration: 2500,
            action: {
              label: 'Undo',
              onClick: () =>
                deleteEvent.mutate(event.id, {
                  onError: (error) => toast.error(getErrorMessage(error, 'Could not undo.')),
                }),
            },
          })
        },
        onError: (error) => toast.error(getErrorMessage(error, `Could not add ${counter.name}.`)),
      },
    )
  }

  if (trip.isPending) return <LoadingState />
  if (trip.isError)
    return (
      <>
        <TopBar back="/" />
        <ErrorState error={trip.error} onRetry={() => void trip.refetch()} />
      </>
    )
  if (!trip.data)
    return (
      <>
        <TopBar back="/" />
        <EmptyState
          emoji="🧭"
          title="Trip not found"
          action={
            <Link to="/" className="btn btn-primary">
              Back to my trips
            </Link>
          }
        >
          It doesn’t exist or you’re not a member.
        </EmptyState>
      </>
    )

  const t = trip.data
  const counterList = counters.data ?? []

  return (
    <div className="pb-28">
      <TopBar
        back="/"
        right={
          <Link to={`/trips/${tripId}/members`} className="btn btn-secondary btn-sm">
            👥 Members{members.data ? ` · ${members.data.length}` : ''}
          </Link>
        }
      />

      <div className="mb-6 px-1">
        <div className="text-5xl">{t.emoji}</div>
        <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight">{t.name}</h1>
        <p className="mt-1 text-lg font-bold text-accent-strong">{tripDayLabel(t)}</p>
      </div>

      {counters.isPending ? (
        <LoadingState />
      ) : counters.isError ? (
        <ErrorState error={counters.error} onRetry={() => void counters.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {counterList.map((counter) => (
            <CounterCard
              key={counter.id}
              counter={counter}
              onIncrement={() => add(counter, 1)}
              onOpen={() => setSheet({ kind: 'add', counterId: counter.id })}
            />
          ))}
          <button
            type="button"
            onClick={() => setSheet({ kind: 'form', counter: null })}
            className="flex aspect-[1/1] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-300 font-extrabold text-ink-soft transition hover:border-accent hover:text-accent active:scale-[0.96]"
          >
            <span className="text-4xl">＋</span>
            New counter
          </button>
        </div>
      )}

      {counterList.length > 0 && (
        <p className="mt-3 text-center text-sm font-semibold text-ink-soft">
          Tap to add 1 · hold or ⋯ for more
        </p>
      )}

      <ActivityFeed tripId={tripId} userId={user.id} isOwner={isOwner} counters={counterList} names={names} />

      {counterList.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="pointer-events-auto w-full"
            onClick={() => setSheet({ kind: 'add', counterId: null })}
          >
            ＋ Add event
          </Button>
        </div>
      )}

      <AddEventSheet
        open={sheet.kind === 'add'}
        onClose={closeSheet}
        counters={counterList}
        counterId={sheet.kind === 'add' ? sheet.counterId : null}
        canEdit={canEdit}
        onAdd={add}
        onEdit={(counter) => setSheet({ kind: 'form', counter })}
      />
      <CounterFormSheet
        tripId={tripId}
        open={sheet.kind === 'form'}
        onClose={closeSheet}
        counter={sheet.kind === 'form' ? sheet.counter : null}
      />
    </div>
  )
}
