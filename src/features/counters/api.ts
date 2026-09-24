import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { CounterWithTotal } from '@/types/database'

export function useCounters(tripId: string) {
  return useQuery({
    queryKey: queryKeys.counters(tripId),
    queryFn: async (): Promise<CounterWithTotal[]> => {
      const { data, error } = await supabase
        .from('counters_with_totals')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export type CounterInput = { name: string; emoji: string; unit: string | null }

export function useCreateCounter(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CounterInput) => {
      const { data, error } = await supabase
        .from('counters')
        .insert({ trip_id: tripId, ...input })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.counters(tripId) }),
  })
}

export function useUpdateCounter(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: CounterInput & { id: string }) => {
      const { data, error } = await supabase.from('counters').update(patch).eq('id', id).select('id')
      if (error) throw error
      // RLS hides rows the user may not modify: zero rows means "not allowed".
      if (data.length === 0) throw { code: '42501' }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.counters(tripId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events(tripId) }),
      ]),
  })
}

export function useDeleteCounter(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('counters').delete().eq('id', id).select('id')
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
