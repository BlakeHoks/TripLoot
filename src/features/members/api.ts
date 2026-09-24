import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { MemberRole } from '@/types/database'

export type Member = {
  user_id: string
  role: MemberRole
  joined_at: string
  profile: { display_name: string | null; avatar_url: string | null } | null
}

export function useMembers(tripId: string) {
  return useQuery({
    queryKey: queryKeys.members(tripId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at, profile:profiles!trip_members_user_profile_fkey(display_name, avatar_url)')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true })
      if (error) throw error
      // Owner first, then by join date.
      return data.toSorted((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1))
    },
  })
}

/** Leave a trip (own row) or, as owner, remove a member. */
export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw error
      if (data.length === 0) throw { code: '42501' }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members(tripId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
      ]),
  })
}
