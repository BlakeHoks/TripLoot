import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { router } from '@/routes/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't hammer on permission/validation errors.
        const code = (error as { code?: string }).code
        if (code && /^(42501|22P02|PGRST)/.test(code)) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          richColors
          closeButton={false}
          offset={{ top: 'max(12px, env(safe-area-inset-top))' }}
          mobileOffset={{ top: 'max(12px, env(safe-area-inset-top))' }}
          toastOptions={{ className: 'font-sans !rounded-2xl !font-bold' }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
