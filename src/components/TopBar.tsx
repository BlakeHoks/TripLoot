import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  title?: ReactNode
  back?: string
  right?: ReactNode
}

export function TopBar({ title, back, right }: Props) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 flex min-h-14 items-center gap-2 bg-canvas/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:bg-canvas/95">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-2xl font-black hover:bg-black/5"
        >
          ‹
        </Link>
      )}
      <div className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</div>
      {right}
    </header>
  )
}
