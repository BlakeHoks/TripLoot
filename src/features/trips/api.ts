import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { Trip } from '@/types/database'

export type TripListItem = Trip & { member_count: number }

export function useTrips() {
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: async (): Promise<TripListItem[]> => {
      const { data, error } = await supabase
        .from('trips')
        .select('*, trip_members(count)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(({ trip_members, ...trip }) => ({
        ...trip,
        member_count: (trip_members as unknown as { count: number }[])[0]?.count ?? 0,
      }))
    },
  })
}

/** Resolves to null when the trip doesn't exist or the user isn't a member (RLS). */
export function useTrip(tripId: string) {
  return useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type CreateTripInput = {
  name: string
  emoji: string
  description?: string
  startDate?: string
  endDate?: string
  withDefaultCounters: boolean
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const { data, error } = await supabase.rpc('create_trip', {
        p_name: input.name,
        p_emoji: input.emoji,
        p_description: input.description || null,
        p_start_date: input.startDate || null,
        p_end_date: input.endDate || null,
        p_with_default_counters: input.withDefaultCounters,
      })
      if (error) throw error
      return data
    },
    onSuccess: (trip) => {
      queryClient.setQueryData(queryKeys.trip(trip.id), trip)
      return queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    },
  })
}

export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { name: string; emoji: string; start_date: string | null; end_date: string | null }) => {
      const { data, error } = await supabase.from('trips').update(patch).eq('id', tripId).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (trip) => {
      queryClient.setQueryData(queryKeys.trip(tripId), trip)
      return queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    },
  })
}

export function useDeleteTrip(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('trips').delete().eq('id', tripId).select('id')
      if (error) throw error
      if (data.length === 0) throw { code: '42501' }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.trip(tripId) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    },
  })
}
