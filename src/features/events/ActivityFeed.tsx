import { toast } from 'sonner'
import { formatDayHeading, formatTime } from '@/lib/dates'
import { formatAmount } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/States'
import { Spinner } from '@/components/Spinner'
import type { CounterWithTotal, TripEvent } from '@/types/database'
import { useDeleteEvent, useEvents } from './api'

type Props = {
  tripId: string
  userId: string
  isOwner: boolean
  counters: CounterWithTotal[]
  names: Map<string, string>
}

export function ActivityFeed({ tripId, userId, isOwner, counters, names }: Props) {
  const events = useEvents(tripId)
  const deleteEvent = useDeleteEvent(tripId)
  const counterById = new Map(counters.map((c) => [c.id, c]))

  async function handleDelete(event: TripEvent) {
    const counter = counterById.get(event.counter_id)
    if (!window.confirm(`Remove ${counter?.emoji ?? ''} +${formatAmount(Number(event.amount))}?`)) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Removed')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not remove the event.'))
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-xl font-black">Recent activity</h2>

      {events.isPending ? (
        <div className="flex justify-center py-8 text-accent">
          <Spinner className="size-7" />
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : events.data.length === 0 ? (
        <div className="card px-6 py-8 text-center text-ink-soft">
          <div className="mb-2 text-4xl">🌱</div>
          <p className="font-bold">Nothing yet. Tap a counter to start!</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {events.data.map((event, i) => {
            const counter = counterById.get(event.counter_id)
            const prev = events.data[i - 1]
            const heading = formatDayHeading(event.created_at)
            const showHeading = !prev || formatDayHeading(prev.created_at) !== heading
            const mine = event.user_id === userId
            const optimistic = event.id.startsWith('optimistic-')
            return (
              <li key={event.id} className={optimistic ? 'opacity-60' : ''}>
                {showHeading && (
                  <div className="bg-canvas/60 px-4 py-1.5 text-xs font-extrabold tracking-wide text-ink-soft uppercase">
                    {heading}
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl">{counter?.emoji ?? '❔'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">
                      <span className="font-extrabold">{mine ? 'You' : (names.get(event.user_id) ?? 'Someone')}</span>{' '}
                      <span className="text-ink-soft">added</span>{' '}
                      <span className="font-extrabold text-accent-strong">+{formatAmount(Number(event.amount))}</span>{' '}
                      <span className="font-semibold">{counter?.name ?? 'deleted counter'}</span>
                    </p>
                    <p className="text-sm font-semibold text-ink-soft tabular-nums">{formatTime(event.created_at)}</p>
                  </div>
                  {(mine || isOwner) && !optimistic && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(event)}
                      aria-label="Remove event"
                      className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-black/5"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
