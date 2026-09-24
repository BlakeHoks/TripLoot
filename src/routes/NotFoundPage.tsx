import { Link } from 'react-router'
import { EmptyState } from '@/components/States'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col justify-center">
      <EmptyState
        emoji="🗺️"
        title="Lost?"
        action={
          <Link to="/" className="btn btn-primary">
            Go home
          </Link>
        }
      >
        This page doesn’t exist.
      </EmptyState>
    </div>
  )
}
