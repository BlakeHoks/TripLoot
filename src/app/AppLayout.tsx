import { Outlet } from 'react-router'
import { isSupabaseConfigured } from '@/lib/supabase'

/** Phone-sized column; on desktop it floats like a device in the middle of the screen. */
export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] bg-canvas px-4 sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2.5rem] sm:shadow-2xl sm:ring-1 sm:ring-black/5">
      {!isSupabaseConfigured && (
        <div className="mt-4 rounded-2xl bg-danger-soft p-4 text-sm font-bold text-danger">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and restart the dev
          server.
        </div>
      )}
      <Outlet />
    </div>
  )
}
