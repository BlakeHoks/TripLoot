import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`
}

/** Current active invite for a trip — created on first request. */
export function useTripInvite(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invite(tripId),
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_or_create_invite', { p_trip_id: tripId })
      if (error) throw error
      return data
    },
  })
}

/** Revokes the current link and issues a new one. */
export function useResetInvite(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data: revoked, error: revokeError } = await supabase
        .from('trip_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId)
        .select('id')
      if (revokeError) throw revokeError
      if (revoked.length === 0) throw { code: '42501' }
      const { data, error } = await supabase.rpc('get_or_create_invite', { p_trip_id: tripId })
      if (error) throw error
      return data
    },
    onSuccess: (invite) => queryClient.setQueryData(queryKeys.invite(tripId), invite),
  })
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.invitePreview(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token })
      if (error) throw error
      return data[0] ?? null
    },
  })
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
  })
}
