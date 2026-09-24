const DAY_MS = 24 * 60 * 60 * 1000

/** Parses a `YYYY-MM-DD` date as a local calendar day. */
function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

type TripDates = { start_date: string | null; end_date: string | null; created_at: string }

/** "Day 4", "Starts in 3 days", "Finished" — a short status for the trip header. */
export function tripDayLabel(trip: TripDates): string {
  const today = startOfToday()
  const start = trip.start_date ? parseDate(trip.start_date) : new Date(trip.created_at)
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  if (trip.end_date && daysBetween(parseDate(trip.end_date), today) > 0) return 'Finished'

  const diff = daysBetween(startDay, today)
  if (diff < 0) return diff === -1 ? 'Starts tomorrow' : `Starts in ${-diff} days`
  return `Day ${diff + 1}`
}

/** Trip length in days if both dates are set. */
export function tripLengthDays(trip: TripDates): number | null {
  if (!trip.start_date || !trip.end_date) return null
  return daysBetween(parseDate(trip.start_date), parseDate(trip.end_date)) + 1
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "Today", "Yesterday" or a short date — used to group the activity feed. */
export function formatDayHeading(iso: string): string {
  const date = new Date(iso)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = daysBetween(day, startOfToday())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
