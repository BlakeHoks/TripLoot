type Props = {
  value: number
  onChange: (value: number) => void
}

export function AmountStepper({ value, onChange }: Props) {
  const step = (delta: number) => onChange(Math.max(1, Math.round((value + delta) * 100) / 100))

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= 1}
        aria-label="Decrease"
        className="flex size-16 items-center justify-center rounded-full bg-canvas text-3xl font-black transition active:scale-90 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0.01}
        step="any"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Amount"
        className="w-28 bg-transparent text-center text-6xl font-black tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Increase"
        className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-3xl font-black text-accent-strong transition active:scale-90"
      >
        +
      </button>
    </div>
  )
}
