import { Spinner } from './Spinner'

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-accent">
      <Spinner className="size-9" />
      {label && <p className="font-bold text-ink-soft">{label}</p>}
    </div>
  )
}
