import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { CounterWithTotal, TripEvent } from '@/types/database'

const FEED_LIMIT = 50

export function useEvents(tripId: string) {
  return useQuery({
    queryKey: queryKeys.events(tripId),
    queryFn: async (): Promise<TripEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)
      if (error) throw error
      return data
    },
  })
}

type AddEventInput = { counterId: string; amount: number; userId: string }

/** Adds an event with an optimistic bump of the counter total and the feed. */
export function useAddEvent(tripId: string) {
  const queryClient = useQueryClient()
  const countersKey = queryKeys.counters(tripId)
  const eventsKey = queryKeys.events(tripId)

  return useMutation({
    mutationFn: async ({ counterId, amount }: AddEventInput) => {
      // user_id is intentionally not sent: the database fills it from auth.uid().
      const { data, error } = await supabase
        .from('events')
        .insert({ trip_id: tripId, counter_id: counterId, amount })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ counterId, amount, userId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: countersKey }),
        queryClient.cancelQueries({ queryKey: eventsKey }),
      ])
      const prevCounters = queryClient.getQueryData<CounterWithTotal[]>(countersKey)
      const prevEvents = queryClient.getQueryData<TripEvent[]>(eventsKey)
      const now = new Date().toISOString()

      queryClient.setQueryData<CounterWithTotal[]>(countersKey, (old) =>
        old?.map((c) =>
          c.id === counterId
            ? { ...c, total: Number(c.total) + amount, event_count: c.event_count + 1, last_event_at: now }
            : c,
        ),
      )
      queryClient.setQueryData<TripEvent[]>(eventsKey, (old) => [
        {
          id: `optimistic-${crypto.randomUUID()}`,
          trip_id: tripId,
          counter_id: counterId,
          user_id: userId,
          amount,
          note: null,
          created_at: now,
        },
        ...(old ?? []),
      ])
      return { prevCounters, prevEvents }
    },
    onError: (_error, _vars, context) => {
      if (!context) return
      queryClient.setQueryData(countersKey, context.prevCounters)
      queryClient.setQueryData(eventsKey, context.prevEvents)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: countersKey }),
        queryClient.invalidateQueries({ queryKey: eventsKey }),
      ]),
  })
}

export function useDeleteEvent(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.from('events').delete().eq('id', eventId).select('id')
      if (error) throw error
      if (data.length === 0) throw { code: '42501' }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counters(tripId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events(tripId) }),
      ]),
  })
}
