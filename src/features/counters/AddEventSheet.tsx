import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { formatAmount } from '@/lib/format'
import type { CounterWithTotal } from '@/types/database'
import { AmountStepper } from './AmountStepper'

type Props = {
  open: boolean
  onClose: () => void
  counters: CounterWithTotal[]
  /** Preselected counter; if absent the user picks one first. */
  counterId: string | null
  canEdit: (counter: CounterWithTotal) => boolean
  onAdd: (counter: CounterWithTotal, amount: number) => void
  onEdit: (counter: CounterWithTotal) => void
}

export function AddEventSheet({ open, onClose, counters, counterId, canEdit, onAdd, onEdit }: Props) {
  return (
    <Sheet open={open} onClose={onClose}>
      {/* keyed so state resets every time the sheet opens for a counter */}
      <AddEventBody
        key={`${open}-${counterId}`}
        counters={counters}
        initialCounterId={counterId}
        canEdit={canEdit}
        onAdd={(c, n) => {
          onAdd(c, n)
          onClose()
        }}
        onEdit={onEdit}
      />
    </Sheet>
  )
}

function AddEventBody({
  counters,
  initialCounterId,
  canEdit,
  onAdd,
  onEdit,
}: Omit<Props, 'open' | 'onClose' | 'counterId'> & { initialCounterId: string | null }) {
  const [selectedId, setSelectedId] = useState(initialCounterId)
  const [amount, setAmount] = useState(1)
  const counter = counters.find((c) => c.id === selectedId)
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 10000

  if (!counter) {
    return (
      <>
        <h2 className="mb-4 text-center text-xl font-extrabold">What happened?</h2>
        <div className="grid grid-cols-3 gap-2">
          {counters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-canvas p-3 transition active:scale-95"
            >
              <span className="text-4xl">{c.emoji}</span>
              <span className="line-clamp-1 text-sm font-bold">{c.name}</span>
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-6xl">{counter.emoji}</div>
      <h2 className="mt-2 text-2xl font-black">{counter.name}</h2>
      <p className="mb-6 font-semibold text-ink-soft">
        Total: {formatAmount(Number(counter.total))} {counter.unit ?? ''}
      </p>

      <AmountStepper value={amount} onChange={setAmount} />

      <div className="mt-4 flex gap-2">
        {[2, 3, 5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setAmount(n)}
            className={`rounded-xl px-4 py-2 font-extrabold transition active:scale-95 ${
              amount === n ? 'bg-accent text-white' : 'bg-canvas'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <Button size="lg" className="mt-6 w-full" disabled={!valid} onClick={() => onAdd(counter, amount)}>
        Add {valid ? formatAmount(amount) : ''} {counter.unit ?? ''}
      </Button>

      {canEdit(counter) && (
        <Button variant="ghost" className="mt-2 w-full text-ink-soft" onClick={() => onEdit(counter)}>
          ✏️ Edit counter
        </Button>
      )}
    </div>
  )
}
