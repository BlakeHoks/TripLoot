import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/app/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { JoinPage } from '@/features/invites/JoinPage'
import { DashboardPage } from '@/features/trips/DashboardPage'
import { NewTripPage } from '@/features/trips/NewTripPage'
import { TripPage } from '@/features/trips/TripPage'
import { MembersPage } from '@/features/members/MembersPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      // Public: shows a preview to signed-out users; joining requires auth.
      { path: '/join/:token', element: <JoinPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/trips/new', element: <NewTripPage /> },
          { path: '/trips/:tripId', element: <TripPage /> },
          { path: '/trips/:tripId/members', element: <MembersPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
