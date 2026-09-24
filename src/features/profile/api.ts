import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(userId), profile)
      // Names appear in member lists and activity feeds.
      return queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
