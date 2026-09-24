import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // Never render private UI until the session is known.
  if (isLoading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  return <Outlet />
}
