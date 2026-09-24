import { useRef, useState, type PointerEvent } from 'react'
import { formatAmount } from '@/lib/format'
import type { CounterWithTotal } from '@/types/database'

const LONG_PRESS_MS = 450

type Props = {
  counter: CounterWithTotal
  onIncrement: () => void
  onOpen: () => void
}

/** Tap = +1. Long-press or the corner button = custom amount / edit. */
export function CounterCard({ counter, onIncrement, onOpen }: Props) {
  const [bursts, setBursts] = useState<number[]>([])
  const [popKey, setPopKey] = useState(0)
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    longPressed.current = false
    clearTimer()
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      navigator.vibrate?.(15)
      onOpen()
    }, LONG_PRESS_MS)
  }

  function handleClick() {
    clearTimer()
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    navigator.vibrate?.(8)
    const id = Date.now() + Math.random()
    setBursts((b) => [...b, id])
    window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 700)
    setPopKey((k) => k + 1)
    onIncrement()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        aria-label={`Add 1 ${counter.name}`}
        className="card relative flex aspect-[1/1] w-full flex-col items-center justify-center gap-1 overflow-hidden p-3 text-center transition select-none [-webkit-touch-callout:none] active:scale-[0.96] active:bg-accent-soft/40"
      >
        <span className="text-5xl leading-none">{counter.emoji}</span>
        <span key={popKey} className="mt-1 animate-pop text-4xl font-black tabular-nums">
          {formatAmount(Number(counter.total))}
        </span>
        <span className="line-clamp-1 text-base font-bold text-ink-soft">{counter.name}</span>
        {bursts.map((id) => (
          <span
            key={id}
            className="pointer-events-none absolute top-1/3 animate-float-up text-2xl font-black text-accent"
          >
            +1
          </span>
        ))}
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`More options for ${counter.name}`}
        className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full text-lg font-black text-ink-soft hover:bg-black/5"
      >
        ⋯
      </button>
    </div>
  )
}
