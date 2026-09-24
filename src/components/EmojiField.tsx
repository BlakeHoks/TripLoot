type Props = {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  id?: string
}

/** Free emoji input plus a row of quick picks. */
export function EmojiField({ value, onChange, suggestions, id }: Props) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={16}
        aria-label="Emoji"
        className="input size-16 shrink-0 px-0 text-center text-3xl"
      />
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`flex size-10 items-center justify-center rounded-xl text-2xl transition active:scale-90 ${
              value === emoji ? 'bg-accent-soft ring-2 ring-accent' : 'bg-canvas hover:bg-accent-soft'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
