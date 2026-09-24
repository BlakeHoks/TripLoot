import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}

/** Mobile bottom sheet (centered dialog-ish on wide screens). */
export function Sheet({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade-in bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-[520px] animate-sheet-in overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-sheet outline-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        {title && <h2 className="mb-4 text-center text-xl font-extrabold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
