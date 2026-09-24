import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Live updates for a trip: other members' events/counters/joins invalidate the
 * relevant queries. Realtime respects RLS, so only visible rows are delivered.
 */
export function useTripRealtime(tripId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const filter = `trip_id=eq.${tripId}`
    const invalidate = (...keys: (readonly unknown[])[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
    }

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, () =>
        invalidate(queryKeys.events(tripId), queryKeys.counters(tripId)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters', filter }, () =>
        invalidate(queryKeys.counters(tripId), queryKeys.events(tripId)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter }, () =>
        invalidate(queryKeys.members(tripId), queryKeys.trips),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tripId, queryClient])
}
