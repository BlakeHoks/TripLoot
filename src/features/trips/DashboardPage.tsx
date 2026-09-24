import { Link } from 'react-router'
import { useAuth } from '@/features/auth/AuthContext'
import { useProfile } from '@/features/profile/api'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { plural, tripDayLabel, tripLengthDays } from '@/lib/dates'
import { emailName } from '@/lib/format'
import { useTrips } from './api'

export function DashboardPage() {
  const { user } = useAuth()
  const trips = useTrips()
  const profile = useProfile(user!.id)
  const name = profile.data?.display_name || emailName(user?.email)

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div>
          <p className="font-bold text-ink-soft">Hi, {name} 👋</p>
          <h1 className="text-3xl font-black tracking-tight">My trips</h1>
        </div>
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex size-12 items-center justify-center rounded-full bg-white text-xl font-black text-accent shadow-card"
        >
          {name.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {trips.isPending ? (
        <LoadingState />
      ) : trips.isError ? (
        <ErrorState error={trips.error} onRetry={() => void trips.refetch()} />
      ) : trips.data.length === 0 ? (
        <EmptyState
          emoji="🧳"
          title="No trips yet."
          action={
            <Link to="/trips/new" className="btn btn-primary btn-lg">
              Create trip
            </Link>
          }
        >
          Create one and start tracking the important stuff.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {trips.data.map((trip) => {
              const length = tripLengthDays(trip)
              return (
                <li key={trip.id}>
                  <Link
                    to={`/trips/${trip.id}`}
                    className="card flex items-center gap-4 p-4 transition active:scale-[0.98]"
                  >
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-canvas text-4xl">
                      {trip.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-extrabold">{trip.name}</span>
                      <span className="block font-semibold text-ink-soft">
                        {plural(trip.member_count, 'member', 'members')}
                        {' · '}
                        {length ? plural(length, 'day', 'days') : tripDayLabel(trip)}
                      </span>
                    </span>
                    <span className="text-2xl text-stone-300">›</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link to="/trips/new" className="btn btn-primary btn-lg mt-6 w-full">
            ＋ New trip
          </Link>
        </>
      )}
    </div>
  )
}
