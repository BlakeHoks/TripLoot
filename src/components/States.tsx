import type { ReactNode } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { Button } from './Button'
import { Spinner } from './Spinner'

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-accent">
      <Spinner className="size-8" />
      {label && <p className="font-bold text-ink-soft">{label}</p>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-5xl">😵‍💫</div>
      <p className="text-lg font-extrabold">Couldn’t load this</p>
      <p className="mt-1 text-ink-soft">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  emoji,
  title,
  children,
  action,
}: {
  emoji: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 text-6xl">{emoji}</div>
      <p className="text-xl font-extrabold">{title}</p>
      {children && <p className="mt-2 max-w-xs text-ink-soft">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
